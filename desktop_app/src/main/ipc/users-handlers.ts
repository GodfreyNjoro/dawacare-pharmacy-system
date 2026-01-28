import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import DatabaseManager from '../database/database-manager';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  branchId: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function registerUsersHandlers(): void {
  console.log('[IPC] Registering users handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get users with pagination
  ipcMain.handle('getUsersPaginated', async (_, filters: UserFilters = {}) => {
    const { search = '', role = '', status = '', page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };

    try {
      let whereClause = 'WHERE 1=1';
      const params: (string | number)[] = [];

      if (search) {
        whereClause += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }
      if (role) {
        whereClause += ` AND u.role = ?`;
        params.push(role);
      }
      if (status) {
        whereClause += ` AND u.status = ?`;
        params.push(status);
      }

      const countResult = await prisma.$queryRaw(
        `SELECT COUNT(*) as count FROM "User" u ${whereClause}`,
        ...params
      );
      const total = Number(countResult[0]?.count || 0);

      const users = await prisma.$queryRaw(
        `SELECT u.id, u.email, u.name, u.role, u.status, u."branchId", 
                b.name as "branchName", b.code as "branchCode",
                u."createdAt", u."updatedAt"
         FROM "User" u
         LEFT JOIN "Branch" b ON u."branchId" = b.id
         ${whereClause}
         ORDER BY u."createdAt" DESC
         LIMIT ? OFFSET ?`,
        ...params, limit, offset
      );

      return {
        success: true,
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('[Users] Error getting users:', error);
      return { success: false, error: 'Failed to fetch users' };
    }
  });

  // Create user
  ipcMain.handle('createUser', async (_, userData: {
    email: string;
    name?: string;
    password: string;
    role: string;
    branchId?: string;
  }) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      // Validation
      if (!userData.email || !userData.password || !userData.role) {
        return { success: false, error: 'Email, password, and role are required' };
      }
      if (!userData.email.includes('@')) {
        return { success: false, error: 'Invalid email format' };
      }
      if (userData.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }
      const validRoles = ['ADMIN', 'PHARMACIST', 'CASHIER'];
      if (!validRoles.includes(userData.role)) {
        return { success: false, error: 'Invalid role' };
      }

      // Check email uniqueness
      const existing = await prisma.$queryRaw(
        'SELECT id FROM "User" WHERE email = ?',
        userData.email
      );
      if (existing.length > 0) {
        return { success: false, error: 'Email already in use' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      await prisma.$queryRaw(
        `INSERT INTO "User" (id, email, name, password, role, status, "branchId", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
        id, userData.email, userData.name || null, hashedPassword, 
        userData.role, userData.branchId || null, now, now
      );

      // Add to sync queue
      await prisma.$queryRaw(
        `INSERT INTO "SyncQueue" (id, "entityType", "entityId", operation, payload, status, "createdAt", "updatedAt")
         VALUES (?, 'USER', ?, 'CREATE', '{}', 'PENDING', ?, ?)`,
        randomUUID(), id, now, now
      );

      return { success: true, id };
    } catch (error) {
      console.error('[Users] Error creating user:', error);
      return { success: false, error: 'Failed to create user' };
    }
  });

  // Update user
  ipcMain.handle('updateUser', async (_, userId: string, userData: {
    email?: string;
    name?: string;
    password?: string;
    role?: string;
    status?: string;
    branchId?: string | null;
  }) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const now = new Date().toISOString();

    try {
      const updates: string[] = [];
      const params: (string | null)[] = [];

      if (userData.email) {
        // Check email uniqueness
        const existing = await prisma.$queryRaw(
          'SELECT id FROM "User" WHERE email = ? AND id != ?',
          userData.email, userId
        );
        if (existing.length > 0) {
          return { success: false, error: 'Email already in use' };
        }
        updates.push('email = ?');
        params.push(userData.email);
      }
      if (userData.name !== undefined) {
        updates.push('name = ?');
        params.push(userData.name || null);
      }
      if (userData.password && userData.password.length >= 6) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
      }
      if (userData.role) {
        updates.push('role = ?');
        params.push(userData.role);
      }
      if (userData.status) {
        updates.push('status = ?');
        params.push(userData.status);
      }
      if (userData.branchId !== undefined) {
        updates.push('"branchId" = ?');
        params.push(userData.branchId || null);
      }

      if (updates.length === 0) {
        return { success: false, error: 'No updates provided' };
      }

      updates.push('"updatedAt" = ?');
      params.push(now);
      params.push(userId);

      await prisma.$queryRaw(
        `UPDATE "User" SET ${updates.join(', ')} WHERE id = ?`,
        ...params
      );

      // Add to sync queue
      await prisma.$queryRaw(
        `INSERT INTO "SyncQueue" (id, "entityType", "entityId", operation, payload, status, "createdAt", "updatedAt")
         VALUES (?, 'USER', ?, 'UPDATE', '{}', 'PENDING', ?, ?)`,
        randomUUID(), userId, now, now
      );

      return { success: true };
    } catch (error) {
      console.error('[Users] Error updating user:', error);
      return { success: false, error: 'Failed to update user' };
    }
  });

  // Delete user (soft delete)
  ipcMain.handle('deleteUser', async (_, userId: string, currentUserId?: string) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const now = new Date().toISOString();

    try {
      // Prevent self-deletion
      if (userId === currentUserId) {
        return { success: false, error: 'Cannot delete your own account' };
      }

      await prisma.$queryRaw(
        `UPDATE "User" SET status = 'INACTIVE', "updatedAt" = ? WHERE id = ?`,
        now, userId
      );

      // Add to sync queue
      await prisma.$queryRaw(
        `INSERT INTO "SyncQueue" (id, "entityType", "entityId", operation, payload, status, "createdAt", "updatedAt")
         VALUES (?, 'USER', ?, 'UPDATE', '{}', 'PENDING', ?, ?)`,
        randomUUID(), userId, now, now
      );

      return { success: true };
    } catch (error) {
      console.error('[Users] Error deleting user:', error);
      return { success: false, error: 'Failed to delete user' };
    }
  });

  console.log('[IPC] Users handlers registered');
}
