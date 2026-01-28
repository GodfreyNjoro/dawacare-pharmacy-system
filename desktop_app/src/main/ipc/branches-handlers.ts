import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import DatabaseManager from '../database/database-manager';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isMainBranch: boolean;
  status: string;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface BranchFilters {
  search?: string;
  status?: string;
  all?: boolean;
  page?: number;
  limit?: number;
}

export function registerBranchesHandlers(): void {
  console.log('[IPC] Registering branches handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get branches with pagination
  ipcMain.handle('getBranchesPaginated', async (_, filters: BranchFilters = {}) => {
    const { search = '', status = '', all = false, page = 1, limit = 10 } = filters;
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };

    try {
      // If all=true, return all active branches for dropdowns
      if (all) {
        const branches = await prisma.$queryRaw(
          `SELECT id, name, code, address, phone, email, "isMainBranch", status, "createdAt", "updatedAt"
           FROM "Branch" WHERE status = 'ACTIVE'
           ORDER BY "isMainBranch" DESC, name ASC`
        );
        return { success: true, branches };
      }

      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: (string | number)[] = [];

      if (search) {
        whereClause += ` AND (name ILIKE $1 OR code ILIKE $1 OR address ILIKE $1)`;
        params.push(`%${search}%`);
      }
      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const countResult = await prisma.$queryRaw(
        `SELECT COUNT(*) as count FROM "Branch" ${whereClause}`,
        ...params
      );
      const total = Number(countResult[0]?.count || 0);

      const branches = await prisma.$queryRaw(
        `SELECT b.id, b.name, b.code, b.address, b.phone, b.email, 
                b."isMainBranch", b.status, b."createdAt", b."updatedAt",
                (SELECT COUNT(*) FROM "User" WHERE "branchId" = b.id) as "userCount"
         FROM "Branch" b
         ${whereClause}
         ORDER BY b."isMainBranch" DESC, b."createdAt" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        ...params, limit, offset
      );

      return {
        success: true,
        branches: branches.map((b: Branch) => ({ ...b, userCount: Number(b.userCount || 0) })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('[Branches] Error getting branches:', error);
      return { success: false, error: 'Failed to fetch branches' };
    }
  });

  // Create branch
  ipcMain.handle('createBranch', async (_, branchData: {
    name: string;
    code: string;
    address?: string;
    phone?: string;
    email?: string;
    isMainBranch?: boolean;
  }) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      if (!branchData.name || !branchData.code) {
        return { success: false, error: 'Name and code are required' };
      }

      // Check code uniqueness
      const existing = await prisma.$queryRaw(
        'SELECT id FROM "Branch" WHERE code = $1',
        branchData.code.toUpperCase()
      );
      if (existing.length > 0) {
        return { success: false, error: 'Branch code already exists' };
      }

      // If main branch, unset others
      if (branchData.isMainBranch) {
        await prisma.$queryRaw(
          `UPDATE "Branch" SET "isMainBranch" = false WHERE "isMainBranch" = true`
        );
      }

      await prisma.$queryRaw(
        `INSERT INTO "Branch" (id, name, code, address, phone, email, "isMainBranch", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9)`,
        id, branchData.name, branchData.code.toUpperCase(),
        branchData.address || null, branchData.phone || null, branchData.email || null,
        branchData.isMainBranch ? true : false, now, now
      );

      // Add to sync queue
      await prisma.$queryRaw(
        `INSERT INTO "SyncQueue" (id, "entityType", "entityId", operation, payload, status, "createdAt", "updatedAt")
         VALUES ($1, 'BRANCH', $2, 'CREATE', '{}', 'PENDING', $3, $4)`,
        randomUUID(), id, now, now
      );

      return { success: true, id };
    } catch (error) {
      console.error('[Branches] Error creating branch:', error);
      return { success: false, error: 'Failed to create branch' };
    }
  });

  // Update branch
  ipcMain.handle('updateBranch', async (_, branchId: string, branchData: {
    name?: string;
    code?: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    status?: string;
    isMainBranch?: boolean;
  }) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const now = new Date().toISOString();

    try {
      // Check code uniqueness if changed
      if (branchData.code) {
        const existing = await prisma.$queryRaw(
          'SELECT id FROM "Branch" WHERE code = $1 AND id != $2',
          branchData.code.toUpperCase(), branchId
        );
        if (existing.length > 0) {
          return { success: false, error: 'Branch code already exists' };
        }
      }

      // If setting as main branch, unset others
      if (branchData.isMainBranch) {
        await prisma.$queryRaw(
          `UPDATE "Branch" SET "isMainBranch" = false WHERE "isMainBranch" = true AND id != $1`,
          branchId
        );
      }

      const updates: string[] = [];
      const params: (string | number | boolean | null)[] = [];
      let paramIndex = 1;

      if (branchData.name) {
        updates.push(`name = $${paramIndex++}`);
        params.push(branchData.name);
      }
      if (branchData.code) {
        updates.push(`code = $${paramIndex++}`);
        params.push(branchData.code.toUpperCase());
      }
      if (branchData.address !== undefined) {
        updates.push(`address = $${paramIndex++}`);
        params.push(branchData.address);
      }
      if (branchData.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        params.push(branchData.phone);
      }
      if (branchData.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        params.push(branchData.email);
      }
      if (branchData.status) {
        updates.push(`status = $${paramIndex++}`);
        params.push(branchData.status);
      }
      if (branchData.isMainBranch !== undefined) {
        updates.push(`"isMainBranch" = $${paramIndex++}`);
        params.push(branchData.isMainBranch);
      }

      if (updates.length === 0) {
        return { success: false, error: 'No updates provided' };
      }

      updates.push(`"updatedAt" = $${paramIndex++}`);
      params.push(now);
      params.push(branchId);

      await prisma.$queryRaw(
        `UPDATE "Branch" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        ...params
      );

      // Add to sync queue
      await prisma.$queryRaw(
        `INSERT INTO "SyncQueue" (id, "entityType", "entityId", operation, payload, status, "createdAt", "updatedAt")
         VALUES ($1, 'BRANCH', $2, 'UPDATE', '{}', 'PENDING', $3, $4)`,
        randomUUID(), branchId, now, now
      );

      return { success: true };
    } catch (error) {
      console.error('[Branches] Error updating branch:', error);
      return { success: false, error: 'Failed to update branch' };
    }
  });

  // Delete branch
  ipcMain.handle('deleteBranch', async (_, branchId: string) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const now = new Date().toISOString();

    try {
      // Check if it's main branch
      const branch = await prisma.$queryRaw(
        'SELECT id, "isMainBranch" FROM "Branch" WHERE id = $1',
        branchId
      );

      if (branch.length === 0) {
        return { success: false, error: 'Branch not found' };
      }
      if (branch[0].isMainBranch) {
        return { success: false, error: 'Cannot delete main branch' };
      }

      // Check if has users
      const userCount = await prisma.$queryRaw(
        'SELECT COUNT(*) as count FROM "User" WHERE "branchId" = $1',
        branchId
      );

      if (Number(userCount[0]?.count || 0) > 0) {
        // Soft delete
        await prisma.$queryRaw(
          `UPDATE "Branch" SET status = 'INACTIVE', "updatedAt" = $1 WHERE id = $2`,
          now, branchId
        );
        // Add to sync queue
        await prisma.$queryRaw(
          `INSERT INTO "SyncQueue" (id, "entityType", "entityId", operation, payload, status, "createdAt", "updatedAt")
           VALUES ($1, 'BRANCH', $2, 'UPDATE', '{}', 'PENDING', $3, $4)`,
          randomUUID(), branchId, now, now
        );
        return { success: true, softDelete: true };
      }

      // Hard delete
      await prisma.$queryRaw('DELETE FROM "Branch" WHERE id = $1', branchId);
      // Add to sync queue
      await prisma.$queryRaw(
        `INSERT INTO "SyncQueue" (id, "entityType", "entityId", operation, payload, status, "createdAt", "updatedAt")
         VALUES ($1, 'BRANCH', $2, 'DELETE', '{}', 'PENDING', $3, $4)`,
        randomUUID(), branchId, now, now
      );

      return { success: true };
    } catch (error) {
      console.error('[Branches] Error deleting branch:', error);
      return { success: false, error: 'Failed to delete branch' };
    }
  });

  console.log('[IPC] Branches handlers registered');
}
