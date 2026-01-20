import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';
import { randomUUID } from 'crypto';

interface SupplierData {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

async function addToSyncQueue(prisma: any, operation: string, table: string, recordId: string) {
  const now = new Date().toISOString();
  try {
    await prisma.$executeRawUnsafe(`
      INSERT OR REPLACE INTO "SyncQueue" ("id", "operation", "table", "recordId", "status", "createdAt")
      VALUES (?, ?, ?, ?, 'PENDING', ?)
    `, randomUUID(), operation, table, recordId, now);
  } catch (error) {
    console.error('[Suppliers] Failed to add to sync queue:', error);
  }
}

export function registerSuppliersHandlers() {
  console.log('[IPC] Registering Suppliers handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get suppliers with pagination
  ipcMain.handle('getSuppliersPaginated', async (_, params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    all?: boolean;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const { page = 1, limit = 10, search, status, all = false } = params || {};
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ` AND ("name" LIKE ? OR "contactPerson" LIKE ? OR "email" LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (status) {
        whereClause += ` AND "status" = ?`;
        queryParams.push(status);
      } else if (all) {
        whereClause += ` AND "status" = 'ACTIVE'`;
      }

      const countResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "Supplier" ${whereClause}`,
        ...queryParams
      );
      const totalCount = Number(countResult[0]?.count || 0);

      let suppliers: any[];
      if (all) {
        suppliers = await prisma.$queryRawUnsafe(
          `SELECT * FROM "Supplier" ${whereClause} ORDER BY "name" ASC`,
          ...queryParams
        );
      } else {
        suppliers = await prisma.$queryRawUnsafe(
          `SELECT * FROM "Supplier" ${whereClause} ORDER BY "createdAt" DESC LIMIT ? OFFSET ?`,
          ...queryParams, limit, offset
        );
      }

      return {
        success: true,
        suppliers,
        pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) }
      };
    } catch (error) {
      console.error('[Suppliers] Error fetching suppliers:', error);
      return { success: false, error: String(error) };
    }
  });

  // Create supplier
  ipcMain.handle('createSupplier', async (_, data: SupplierData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.name?.trim()) {
        return { success: false, error: 'Supplier name is required' };
      }

      const now = new Date().toISOString();
      const id = randomUUID();

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Supplier" ("id", "name", "contactPerson", "email", "phone", "address", "status", "createdAt", "updatedAt")
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `,
        id,
        data.name.trim(),
        data.contactPerson?.trim() || null,
        data.email?.trim() || null,
        data.phone?.trim() || null,
        data.address?.trim() || null,
        now, now
      );

      await addToSyncQueue(prisma, 'CREATE', 'Supplier', id);

      const suppliers: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Supplier" WHERE "id" = ?`, id);
      return { success: true, supplier: suppliers[0] };
    } catch (error) {
      console.error('[Suppliers] Error creating supplier:', error);
      return { success: false, error: String(error) };
    }
  });

  // Update supplier
  ipcMain.handle('updateSupplier', async (_, data: SupplierData & { id: string }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.id) return { success: false, error: 'Supplier ID is required' };
      if (!data.name?.trim()) return { success: false, error: 'Supplier name is required' };

      const now = new Date().toISOString();

      await prisma.$executeRawUnsafe(`
        UPDATE "Supplier" SET "name" = ?, "contactPerson" = ?, "email" = ?, "phone" = ?, "address" = ?, "updatedAt" = ? WHERE "id" = ?
      `,
        data.name.trim(),
        data.contactPerson?.trim() || null,
        data.email?.trim() || null,
        data.phone?.trim() || null,
        data.address?.trim() || null,
        now, data.id
      );

      await addToSyncQueue(prisma, 'UPDATE', 'Supplier', data.id);

      const suppliers: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Supplier" WHERE "id" = ?`, data.id);
      return { success: true, supplier: suppliers[0] };
    } catch (error) {
      console.error('[Suppliers] Error updating supplier:', error);
      return { success: false, error: String(error) };
    }
  });

  // Delete supplier (soft delete if has POs)
  ipcMain.handle('deleteSupplier', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const poCount: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "PurchaseOrder" WHERE "supplierId" = ?`, id
      );

      if (Number(poCount[0]?.count || 0) > 0) {
        const now = new Date().toISOString();
        await prisma.$executeRawUnsafe(`UPDATE "Supplier" SET "status" = 'INACTIVE', "updatedAt" = ? WHERE "id" = ?`, now, id);
        await addToSyncQueue(prisma, 'UPDATE', 'Supplier', id);
        return { success: true, softDeleted: true };
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM "Supplier" WHERE "id" = ?`, id);
        await addToSyncQueue(prisma, 'DELETE', 'Supplier', id);
        return { success: true, softDeleted: false };
      }
    } catch (error) {
      console.error('[Suppliers] Error deleting supplier:', error);
      return { success: false, error: String(error) };
    }
  });
}
