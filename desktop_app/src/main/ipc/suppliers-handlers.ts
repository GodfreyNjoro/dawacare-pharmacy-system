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

function formatDateTime(date?: Date | string): string {
  if (!date) {
    const now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, 19);
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function escapeStr(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  const escaped = String(value).replace(/'/g, "''");
  return "'" + escaped + "'";
}

function escapeId(value: string): string {
  return String(value).replace(/'/g, "''");
}

async function addToSyncQueue(prisma: any, entityType: string, entityId: string, operation: string, payload: any = {}) {
  const now = formatDateTime();
  const id = randomUUID();
  const payloadStr = JSON.stringify(payload).replace(/'/g, "''");
  try {
    const sql = "INSERT OR REPLACE INTO \"SyncQueue\" (\"id\", \"entityType\", \"entityId\", \"operation\", \"payload\", \"status\", \"createdAt\", \"updatedAt\") VALUES ('" + id + "', '" + entityType + "', '" + entityId + "', '" + operation + "', '" + payloadStr + "', 'PENDING', '" + now + "', '" + now + "')";
    await prisma.$executeRawUnsafe(sql);
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

      const page = (params && params.page) || 1;
      const limit = (params && params.limit) || 10;
      const search = params && params.search;
      const status = params && params.status;
      const all = params && params.all;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';

      if (search && search.trim()) {
        const searchEsc = escapeId(search.trim());
        whereClause = whereClause + " AND (\"name\" LIKE '%" + searchEsc + "%' OR \"contactPerson\" LIKE '%" + searchEsc + "%' OR \"email\" LIKE '%" + searchEsc + "%')";
      }

      if (status && status.trim()) {
        const statusEsc = escapeId(status.trim());
        whereClause = whereClause + " AND \"status\" = '" + statusEsc + "'";
      } else if (all) {
        whereClause = whereClause + " AND \"status\" = 'ACTIVE'";
      }

      const countSql = 'SELECT COUNT(*) as count FROM "Supplier" ' + whereClause;
      const countResult: any[] = await prisma.$queryRawUnsafe(countSql);
      const totalCount = Number(countResult[0]?.count || 0);

      let suppliers: any[];
      if (all) {
        const selectSql = 'SELECT * FROM "Supplier" ' + whereClause + ' ORDER BY "name" ASC';
        suppliers = await prisma.$queryRawUnsafe(selectSql);
      } else {
        const selectSql = 'SELECT * FROM "Supplier" ' + whereClause + ' ORDER BY "createdAt" DESC LIMIT ' + limit + ' OFFSET ' + offset;
        suppliers = await prisma.$queryRawUnsafe(selectSql);
      }

      return {
        success: true,
        suppliers: suppliers,
        pagination: { page: page, limit: limit, totalCount: totalCount, totalPages: Math.ceil(totalCount / limit) }
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

      if (!data.name || !data.name.trim()) {
        return { success: false, error: 'Supplier name is required' };
      }

      const now = formatDateTime();
      const id = randomUUID();
      const nameEsc = escapeId(data.name.trim());
      const contactPersonVal = escapeStr(data.contactPerson ? data.contactPerson.trim() : null);
      const emailVal = escapeStr(data.email ? data.email.trim() : null);
      const phoneVal = escapeStr(data.phone ? data.phone.trim() : null);
      const addressVal = escapeStr(data.address ? data.address.trim() : null);

      const insertSql = 'INSERT INTO "Supplier" ("id", "name", "contactPerson", "email", "phone", "address", "status", "createdAt", "updatedAt") VALUES (\'' + id + '\', \'' + nameEsc + '\', ' + contactPersonVal + ', ' + emailVal + ', ' + phoneVal + ', ' + addressVal + ', \'ACTIVE\', \'' + now + '\', \'' + now + '\')';
      await prisma.$executeRawUnsafe(insertSql);

      const selectSql = 'SELECT * FROM "Supplier" WHERE "id" = \'' + id + '\'';
      const suppliers: any[] = await prisma.$queryRawUnsafe(selectSql);
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
      if (!data.name || !data.name.trim()) return { success: false, error: 'Supplier name is required' };

      const now = formatDateTime();
      const idEsc = escapeId(data.id);
      const nameEsc = escapeId(data.name.trim());
      const contactPersonVal = escapeStr(data.contactPerson ? data.contactPerson.trim() : null);
      const emailVal = escapeStr(data.email ? data.email.trim() : null);
      const phoneVal = escapeStr(data.phone ? data.phone.trim() : null);
      const addressVal = escapeStr(data.address ? data.address.trim() : null);

      const updateSql = 'UPDATE "Supplier" SET "name" = \'' + nameEsc + '\', "contactPerson" = ' + contactPersonVal + ', "email" = ' + emailVal + ', "phone" = ' + phoneVal + ', "address" = ' + addressVal + ', "updatedAt" = \'' + now + '\' WHERE "id" = \'' + idEsc + '\'';
      await prisma.$executeRawUnsafe(updateSql);

      const selectSql = 'SELECT * FROM "Supplier" WHERE "id" = \'' + idEsc + '\'';
      const suppliers: any[] = await prisma.$queryRawUnsafe(selectSql);
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

      const idEsc = escapeId(id);
      const countSql = 'SELECT COUNT(*) as count FROM "PurchaseOrder" WHERE "supplierId" = \'' + idEsc + '\'';
      const poCount: any[] = await prisma.$queryRawUnsafe(countSql);

      if (Number(poCount[0]?.count || 0) > 0) {
        const now = formatDateTime();
        const updateSql = 'UPDATE "Supplier" SET "status" = \'INACTIVE\', "updatedAt" = \'' + now + '\' WHERE "id" = \'' + idEsc + '\'';
        await prisma.$executeRawUnsafe(updateSql);
        const selectSql = 'SELECT * FROM "Supplier" WHERE "id" = \'' + idEsc + '\'';
        const suppliers: any[] = await prisma.$queryRawUnsafe(selectSql);
        await addToSyncQueue(prisma, 'SUPPLIER', id, 'UPDATE', suppliers[0]);
        return { success: true, softDeleted: true };
      } else {
        const deleteSql = 'DELETE FROM "Supplier" WHERE "id" = \'' + idEsc + '\'';
        await prisma.$executeRawUnsafe(deleteSql);
        await addToSyncQueue(prisma, 'SUPPLIER', id, 'DELETE', { id: id });
        return { success: true, softDeleted: false };
      }
    } catch (error) {
      console.error('[Suppliers] Error deleting supplier:', error);
      return { success: false, error: String(error) };
    }
  });
}
