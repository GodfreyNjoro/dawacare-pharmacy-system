import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';
import { randomUUID } from 'crypto';

interface GRNItemData {
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  quantityReceived: number;
  unitCost: number;
}

interface CreateGRNData {
  purchaseOrderId: string;
  items: GRNItemData[];
  notes?: string;
  addToInventory?: boolean;
}

// Use explicit character codes to avoid encoding issues
const Q = String.fromCharCode(39); // single quote
const DQ = String.fromCharCode(34); // double quote

function generateGRNNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'GRN-' + y + m + d + '-' + random;
}

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
    console.error('[GRN] Failed to add to sync queue:', error);
  }
}

export function registerGRNHandlers() {
  console.log('[IPC] Registering GRN handlers...');
  const dbManager = DatabaseManager.getInstance();

  ipcMain.handle('getGRNsPaginated', async (_, params: { page?: number; limit?: number; search?: string; }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const page = (params && params.page) || 1;
      const limit = (params && params.limit) || 10;
      const search = params && params.search;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';

      if (search && search.trim()) {
        const searchEsc = escId(search.trim());
        whereClause = whereClause + ' AND (g.' + col('grnNumber') + ' LIKE ' + Q + '%' + searchEsc + '%' + Q + ' OR po.' + col('poNumber') + ' LIKE ' + Q + '%' + searchEsc + '%' + Q + ')';
      }

      const countSql = 'SELECT COUNT(*) as count FROM ' + col('GoodsReceivedNote') + ' g LEFT JOIN ' + col('PurchaseOrder') + ' po ON g.' + col('purchaseOrderId') + ' = po.' + col('id') + ' ' + whereClause;
      const countResult: any[] = await prisma.$queryRawUnsafe(countSql);
      const totalCount = Number(countResult[0]?.count || 0);

      const selectSql = 'SELECT g.*, po.' + col('poNumber') + ', s.' + col('name') + ' as supplierName FROM ' + col('GoodsReceivedNote') + ' g LEFT JOIN ' + col('PurchaseOrder') + ' po ON g.' + col('purchaseOrderId') + ' = po.' + col('id') + ' LEFT JOIN ' + col('Supplier') + ' s ON po.' + col('supplierId') + ' = s.' + col('id') + ' ' + whereClause + ' ORDER BY g.' + col('receivedDate') + ' DESC LIMIT ' + limit + ' OFFSET ' + offset;
      const grns: any[] = await prisma.$queryRawUnsafe(selectSql);

      for (const grn of grns) {
        const grnIdEsc = escId(grn.id);
        const itemsSql = 'SELECT * FROM ' + col('GRNItem') + ' WHERE ' + col('grnId') + ' = ' + Q + grnIdEsc + Q;
        grn.items = await prisma.$queryRawUnsafe(itemsSql);
        grn.purchaseOrder = { id: grn.purchaseOrderId, poNumber: grn.poNumber, supplier: { name: grn.supplierName } };
      }

      return { success: true, grns: grns, pagination: { page: page, limit: limit, totalCount: totalCount, totalPages: Math.ceil(totalCount / limit) } };
    } catch (error) {
      console.error('[GRN] Error fetching GRNs:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('getGRNById', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const idEsc = escId(id);
      const grnSql = 'SELECT g.*, po.' + col('poNumber') + ', po.' + col('status') + ' as poStatus, s.' + col('name') + ' as supplierName FROM ' + col('GoodsReceivedNote') + ' g LEFT JOIN ' + col('PurchaseOrder') + ' po ON g.' + col('purchaseOrderId') + ' = po.' + col('id') + ' LEFT JOIN ' + col('Supplier') + ' s ON po.' + col('supplierId') + ' = s.' + col('id') + ' WHERE g.' + col('id') + ' = ' + Q + idEsc + Q;
      const grns: any[] = await prisma.$queryRawUnsafe(grnSql);

      if (grns.length === 0) return { success: false, error: 'GRN not found' };

      const grn = grns[0];
      const itemsSql = 'SELECT * FROM ' + col('GRNItem') + ' WHERE ' + col('grnId') + ' = ' + Q + idEsc + Q;
      grn.items = await prisma.$queryRawUnsafe(itemsSql);
      grn.purchaseOrder = { id: grn.purchaseOrderId, poNumber: grn.poNumber, status: grn.poStatus, supplier: { name: grn.supplierName } };

      return { success: true, grn: grn };
    } catch (error) {
      console.error('[GRN] Error fetching GRN:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('getPendingPurchaseOrders', async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const ordersSql = 'SELECT po.*, s.' + col('name') + ' as supplierName FROM ' + col('PurchaseOrder') + ' po LEFT JOIN ' + col('Supplier') + ' s ON po.' + col('supplierId') + ' = s.' + col('id') + ' WHERE po.' + col('status') + ' IN (' + Q + 'SENT' + Q + ', ' + Q + 'PARTIAL' + Q + ') ORDER BY po.' + col('createdAt') + ' DESC';
      const orders: any[] = await prisma.$queryRawUnsafe(ordersSql);

      for (const order of orders) {
        const orderIdEsc = escId(order.id);
        const itemsSql = 'SELECT * FROM ' + col('PurchaseOrderItem') + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + orderIdEsc + Q;
        order.items = await prisma.$queryRawUnsafe(itemsSql);
        order.supplier = { id: order.supplierId, name: order.supplierName };
      }

      return { success: true, orders: orders };
    } catch (error) {
      console.error('[GRN] Error fetching pending POs:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('createGRN', async (_, data: CreateGRNData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.purchaseOrderId) return { success: false, error: 'Purchase order is required' };
      if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

      const validItems = data.items.filter(function(item) {
        return item.medicineName && item.medicineName.trim() && item.batchNumber && item.batchNumber.trim() && item.expiryDate && item.quantityReceived > 0 && item.unitCost > 0;
      });
      if (validItems.length === 0) return { success: false, error: 'All items must have name, batch, expiry, quantity, and cost' };

      const now = formatDateTime();
      const grnId = randomUUID();
      const grnNumber = generateGRNNumber();
      const notesVal = esc(data.notes);
      const poIdEsc = escId(data.purchaseOrderId);

      const insertGrnSql = 'INSERT INTO ' + col('GoodsReceivedNote') + ' (' + col('id') + ', ' + col('grnNumber') + ', ' + col('purchaseOrderId') + ', ' + col('receivedDate') + ', ' + col('notes') + ', ' + col('status') + ', ' + col('createdAt') + ', ' + col('updatedAt') + ') VALUES (' + Q + grnId + Q + ', ' + Q + grnNumber + Q + ', ' + Q + poIdEsc + Q + ', ' + Q + now + Q + ', ' + notesVal + ', ' + Q + 'RECEIVED' + Q + ', ' + Q + now + Q + ', ' + Q + now + Q + ')';
      await prisma.$executeRawUnsafe(insertGrnSql);

      for (const item of validItems) {
        const itemId = randomUUID();
        const itemTotal = item.quantityReceived * item.unitCost;
        const addToInv = data.addToInventory !== false ? 1 : 0;
        const medicineNameEsc = escId(item.medicineName.trim());
        const batchNumberEsc = escId(item.batchNumber.trim());
        const expiryDate = formatDateTime(item.expiryDate);

        const insertItemSql = 'INSERT INTO ' + col('GRNItem') + ' (' + col('id') + ', ' + col('grnId') + ', ' + col('medicineName') + ', ' + col('batchNumber') + ', ' + col('expiryDate') + ', ' + col('quantityReceived') + ', ' + col('unitCost') + ', ' + col('total') + ', ' + col('addedToInventory') + ') VALUES (' + Q + itemId + Q + ', ' + Q + grnId + Q + ', ' + Q + medicineNameEsc + Q + ', ' + Q + batchNumberEsc + Q + ', ' + Q + expiryDate + Q + ', ' + item.quantityReceived + ', ' + item.unitCost + ', ' + itemTotal + ', ' + addToInv + ')';
        await prisma.$executeRawUnsafe(insertItemSql);

        const updatePoItemSql = 'UPDATE ' + col('PurchaseOrderItem') + ' SET ' + col('receivedQty') + ' = ' + col('receivedQty') + ' + ' + item.quantityReceived + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + poIdEsc + Q + ' AND LOWER(' + col('medicineName') + ') = LOWER(' + Q + medicineNameEsc + Q + ')';
        await prisma.$executeRawUnsafe(updatePoItemSql);

        if (data.addToInventory !== false) {
          const existingSql = 'SELECT ' + col('id') + ', ' + col('quantity') + ' FROM ' + col('Medicine') + ' WHERE ' + col('batchNumber') + ' = ' + Q + batchNumberEsc + Q + ' AND LOWER(' + col('name') + ') = LOWER(' + Q + medicineNameEsc + Q + ')';
          const existing: any[] = await prisma.$queryRawUnsafe(existingSql);

          if (existing.length > 0) {
            const existingIdEsc = escId(existing[0].id);
            const updateMedSql = 'UPDATE ' + col('Medicine') + ' SET ' + col('quantity') + ' = ' + col('quantity') + ' + ' + item.quantityReceived + ', ' + col('updatedAt') + ' = ' + Q + now + Q + ' WHERE ' + col('id') + ' = ' + Q + existingIdEsc + Q;
            await prisma.$executeRawUnsafe(updateMedSql);
            await addToSyncQueue(prisma, 'MEDICINE', existing[0].id, 'UPDATE', { quantityAdded: item.quantityReceived });
          } else {
            const medicineId = randomUUID();
            const sellingPrice = item.unitCost * 1.3;
            const insertMedSql = 'INSERT INTO ' + col('Medicine') + ' (' + col('id') + ', ' + col('name') + ', ' + col('batchNumber') + ', ' + col('expiryDate') + ', ' + col('quantity') + ', ' + col('reorderLevel') + ', ' + col('unitPrice') + ', ' + col('category') + ', ' + col('syncStatus') + ', ' + col('createdAt') + ', ' + col('updatedAt') + ') VALUES (' + Q + medicineId + Q + ', ' + Q + medicineNameEsc + Q + ', ' + Q + batchNumberEsc + Q + ', ' + Q + expiryDate + Q + ', ' + item.quantityReceived + ', 10, ' + sellingPrice + ', ' + Q + 'General' + Q + ', ' + Q + 'LOCAL' + Q + ', ' + Q + now + Q + ', ' + Q + now + Q + ')';
            await prisma.$executeRawUnsafe(insertMedSql);
            await addToSyncQueue(prisma, 'MEDICINE', medicineId, 'CREATE', {});
          }
        }
      }

      const poItemsSql = 'SELECT ' + col('quantity') + ', ' + col('receivedQty') + ' FROM ' + col('PurchaseOrderItem') + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + poIdEsc + Q;
      const poItems: any[] = await prisma.$queryRawUnsafe(poItemsSql);

      let totalOrdered = 0;
      let totalReceived = 0;
      for (const i of poItems) {
        totalOrdered = totalOrdered + Number(i.quantity || 0);
        totalReceived = totalReceived + Number(i.receivedQty || 0);
      }

      const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 'PARTIAL';
      const updatePoSql = 'UPDATE ' + col('PurchaseOrder') + ' SET ' + col('status') + ' = ' + Q + newStatus + Q + ', ' + col('updatedAt') + ' = ' + Q + now + Q + ' WHERE ' + col('id') + ' = ' + Q + poIdEsc + Q;
      await prisma.$executeRawUnsafe(updatePoSql);

      await addToSyncQueue(prisma, 'GRN', grnId, 'CREATE', {});
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', data.purchaseOrderId, 'UPDATE', { status: newStatus });

      return { success: true, grnId: grnId, grnNumber: grnNumber };
    } catch (error) {
      console.error('[GRN] Error creating GRN:', error);
      return { success: false, error: String(error) };
    }
  });
}
