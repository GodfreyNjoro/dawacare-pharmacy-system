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

// Use explicit character codes to avoid encoding issues
const Q = String.fromCharCode(39); // single quote
const DQ = String.fromCharCode(34); // double quote

function formatDateTime(date?: Date | string): string {
  if (!date) {
    const now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, 19);
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  const escaped = String(value).split(Q).join(Q + Q);
  return Q + escaped + Q;
}

function escId(value: string): string {
  return String(value).split(Q).join(Q + Q);
}

function col(name: string): string {
  return DQ + name + DQ;
}

async function addToSyncQueue(prisma: any, entityType: string, entityId: string, operation: string, payload: any = {}) {
  const now = formatDateTime();
  const id = randomUUID();
  const payloadStr = JSON.stringify(payload).split(Q).join(Q + Q);
  try {
    const sql = 'INSERT OR REPLACE INTO ' + col('SyncQueue') + ' (' + col('id') + ', ' + col('entityType') + ', ' + col('entityId') + ', ' + col('operation') + ', ' + col('payload') + ', ' + col('status') + ', ' + col('createdAt') + ', ' + col('updatedAt') + ') VALUES (' + Q + id + Q + ', ' + Q + entityType + Q + ', ' + Q + entityId + Q + ', ' + Q + operation + Q + ', ' + Q + payloadStr + Q + ', ' + Q + 'PENDING' + Q + ', ' + Q + now + Q + ', ' + Q + now + Q + ')';
    await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    console.error('[Suppliers] Failed to add to sync queue:', error);
  }
}

export function registerSuppliersHandlers() {
  console.log('[IPC] Registering Suppliers handlers...');
  const dbManager = DatabaseManager.getInstance();

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
        const searchEsc = escId(search.trim());
        whereClause = whereClause + ' AND (' + col('name') + ' LIKE ' + Q + '%' + searchEsc + '%' + Q + ' OR ' + col('contactPerson') + ' LIKE ' + Q + '%' + searchEsc + '%' + Q + ' OR ' + col('email') + ' LIKE ' + Q + '%' + searchEsc + '%' + Q + ')';
      }

      if (status && status.trim()) {
        const statusEsc = escId(status.trim());
        whereClause = whereClause + ' AND ' + col('status') + ' = ' + Q + statusEsc + Q;
      } else if (all) {
        whereClause = whereClause + ' AND ' + col('status') + ' = ' + Q + 'ACTIVE' + Q;
      }

      const countSql = 'SELECT COUNT(*) as count FROM ' + col('Supplier') + ' ' + whereClause;
      const countResult: any[] = await prisma.$queryRawUnsafe(countSql);
      const totalCount = Number(countResult[0]?.count || 0);

      let suppliers: any[];
      if (all) {
        const selectSql = 'SELECT * FROM ' + col('Supplier') + ' ' + whereClause + ' ORDER BY ' + col('name') + ' ASC';
        suppliers = await prisma.$queryRawUnsafe(selectSql);
      } else {
        const selectSql = 'SELECT * FROM ' + col('Supplier') + ' ' + whereClause + ' ORDER BY ' + col('createdAt') + ' DESC LIMIT ' + limit + ' OFFSET ' + offset;
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

  ipcMain.handle('createSupplier', async (_, data: SupplierData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.name || !data.name.trim()) {
        return { success: false, error: 'Supplier name is required' };
      }

      const now = formatDateTime();
      const id = randomUUID();
      const nameEsc = escId(data.name.trim());
      const contactPersonVal = esc(data.contactPerson ? data.contactPerson.trim() : null);
      const emailVal = esc(data.email ? data.email.trim() : null);
      const phoneVal = esc(data.phone ? data.phone.trim() : null);
      const addressVal = esc(data.address ? data.address.trim() : null);

      const insertSql = 'INSERT INTO ' + col('Supplier') + ' (' + col('id') + ', ' + col('name') + ', ' + col('contactPerson') + ', ' + col('email') + ', ' + col('phone') + ', ' + col('address') + ', ' + col('status') + ', ' + col('createdAt') + ', ' + col('updatedAt') + ') VALUES (' + Q + id + Q + ', ' + Q + nameEsc + Q + ', ' + contactPersonVal + ', ' + emailVal + ', ' + phoneVal + ', ' + addressVal + ', ' + Q + 'ACTIVE' + Q + ', ' + Q + now + Q + ', ' + Q + now + Q + ')';
      await prisma.$executeRawUnsafe(insertSql);

      const selectSql = 'SELECT * FROM ' + col('Supplier') + ' WHERE ' + col('id') + ' = ' + Q + id + Q;
      const suppliers: any[] = await prisma.$queryRawUnsafe(selectSql);
      await addToSyncQueue(prisma, 'SUPPLIER', id, 'CREATE', suppliers[0]);
      return { success: true, supplier: suppliers[0] };
    } catch (error) {
      console.error('[Suppliers] Error creating supplier:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('updateSupplier', async (_, data: SupplierData & { id: string }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.id) return { success: false, error: 'Supplier ID is required' };
      if (!data.name || !data.name.trim()) return { success: false, error: 'Supplier name is required' };

      const now = formatDateTime();
      const idEsc = escId(data.id);
      const nameEsc = escId(data.name.trim());
      const contactPersonVal = esc(data.contactPerson ? data.contactPerson.trim() : null);
      const emailVal = esc(data.email ? data.email.trim() : null);
      const phoneVal = esc(data.phone ? data.phone.trim() : null);
      const addressVal = esc(data.address ? data.address.trim() : null);

      const updateSql = 'UPDATE ' + col('Supplier') + ' SET ' + col('name') + ' = ' + Q + nameEsc + Q + ', ' + col('contactPerson') + ' = ' + contactPersonVal + ', ' + col('email') + ' = ' + emailVal + ', ' + col('phone') + ' = ' + phoneVal + ', ' + col('address') + ' = ' + addressVal + ', ' + col('updatedAt') + ' = ' + Q + now + Q + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
      await prisma.$executeRawUnsafe(updateSql);

      const selectSql = 'SELECT * FROM ' + col('Supplier') + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
      const suppliers: any[] = await prisma.$queryRawUnsafe(selectSql);
      await addToSyncQueue(prisma, 'SUPPLIER', data.id, 'UPDATE', suppliers[0]);
      return { success: true, supplier: suppliers[0] };
    } catch (error) {
      console.error('[Suppliers] Error updating supplier:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('deleteSupplier', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const idEsc = escId(id);
      const countSql = 'SELECT COUNT(*) as count FROM ' + col('PurchaseOrder') + ' WHERE ' + col('supplierId') + ' = ' + Q + idEsc + Q;
      const poCount: any[] = await prisma.$queryRawUnsafe(countSql);

      if (Number(poCount[0]?.count || 0) > 0) {
        const now = formatDateTime();
        const updateSql = 'UPDATE ' + col('Supplier') + ' SET ' + col('status') + ' = ' + Q + 'INACTIVE' + Q + ', ' + col('updatedAt') + ' = ' + Q + now + Q + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
        await prisma.$executeRawUnsafe(updateSql);
        const selectSql = 'SELECT * FROM ' + col('Supplier') + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
        const suppliers: any[] = await prisma.$queryRawUnsafe(selectSql);
        await addToSyncQueue(prisma, 'SUPPLIER', id, 'UPDATE', suppliers[0]);
        return { success: true, softDeleted: true };
      } else {
        const deleteSql = 'DELETE FROM ' + col('Supplier') + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
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
