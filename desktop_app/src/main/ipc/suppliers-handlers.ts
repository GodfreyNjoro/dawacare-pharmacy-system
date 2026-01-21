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

// Helper to format datetime for SQLite
function formatDateTime(date?: Date | string): string {
  if (!date) return new Date().toISOString().replace('T', ' ').replace('Z', '');
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

// Helper to escape SQL string values
function escapeSQL(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Helper to escape for LIKE clause
function escapeLike(value: string): string {
  return String(value).replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function addToSyncQueue(prisma: any, entityType: string, entityId: string, operation: string, payload: any = {}) {
  const now = formatDateTime();
  const id = randomUUID();
  const payloadStr = JSON.stringify(payload).replace(/'/g, "''");
  try {
    await prisma.$executeRawUnsafe(`
      INSERT OR REPLACE INTO "SyncQueue" ("id", "entityType", "entityId", "operation", "payload", "status", "createdAt", "updatedAt")
      VALUES ('${id}', '${entityType}', '${entityId}', '${operation}', '${payloadStr}', 'PENDING', '${now}', '${now}')
    `);
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

      if (search) {
        const searchEscaped = escapeLike(search);
        whereClause += ` AND ("name" LIKE '%${searchEscaped}%' OR "contactPerson" LIKE '%${searchEscaped}%' OR "email" LIKE '%${searchEscaped}%')`;
      }

      if (status) {
        const statusEscaped = status.replace(/'/g, "''");
        whereClause += ` AND "status" = '${statusEscaped}'`;
      } else if (all) {
        whereClause += ` AND "status" = 'ACTIVE'`;
      }

      const countResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "Supplier" ${whereClause}`
      );
      const totalCount = Number(countResult[0]?.count || 0);

      let suppliers: any[];
      if (all) {
        suppliers = await prisma.$queryRawUnsafe(
          `SELECT * FROM "Supplier" ${whereClause} ORDER BY "name" ASC`
        );
      } else {
        suppliers = await prisma.$queryRawUnsafe(
          `SELECT * FROM "Supplier" ${whereClause} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`
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

      const now = formatDateTime();
      const id = randomUUID();
      const name = data.name.trim().replace(/'/g, "''");
      const contactPerson = escapeSQL(data.contactPerson?.trim());
      const email = escapeSQL(data.email?.trim());
      const phone = escapeSQL(data.phone?.trim());
      const address = escapeSQL(data.address?.trim());

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Supplier" ("id", "name", "contactPerson", "email", "phone", "address", "status", "createdAt", "updatedAt")
        VALUES ('${id}', '${name}', ${contactPerson}, ${email}, ${phone}, ${address}, 'ACTIVE', '${now}', '${now}')
      `);

      const suppliers: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Supplier" WHERE "id" = '${id}'`);
      await addToSyncQueue(prisma, 'SUPPLIER', id, 'CREATE', suppliers[0]);
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

      const now = formatDateTime();
      const name = data.name.trim().replace(/'/g, "''");
      const contactPerson = escapeSQL(data.contactPerson?.trim());
      const email = escapeSQL(data.email?.trim());
      const phone = escapeSQL(data.phone?.trim());
      const address = escapeSQL(data.address?.trim());

      await prisma.$executeRawUnsafe(`
        UPDATE "Supplier" SET "name" = '${name}', "contactPerson" = ${contactPerson}, "email" = ${email}, "phone" = ${phone}, "address" = ${address}, "updatedAt" = '${now}' WHERE "id" = '${data.id}'
      `);

      const suppliers: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Supplier" WHERE "id" = '${data.id}'`);
      await addToSyncQueue(prisma, 'SUPPLIER', data.id, 'UPDATE', suppliers[0]);
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

      const poCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "PurchaseOrder" WHERE "supplierId" = '${id}'`);

      if (Number(poCount[0]?.count || 0) > 0) {
        const now = formatDateTime();
        await prisma.$executeRawUnsafe(`UPDATE "Supplier" SET "status" = 'INACTIVE', "updatedAt" = '${now}' WHERE "id" = '${id}'`);
        const suppliers: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Supplier" WHERE "id" = '${id}'`);
        await addToSyncQueue(prisma, 'SUPPLIER', id, 'UPDATE', suppliers[0]);
        return { success: true, softDeleted: true };
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM "Supplier" WHERE "id" = '${id}'`);
        await addToSyncQueue(prisma, 'SUPPLIER', id, 'DELETE', { id });
        return { success: true, softDeleted: false };
      }
    } catch (error) {
      console.error('[Suppliers] Error deleting supplier:', error);
      return { success: false, error: String(error) };
    }
  });
}
