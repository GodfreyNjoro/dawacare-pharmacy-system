import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';
import { randomUUID } from 'crypto';

interface POItemData {
  medicineName: string;
  genericName?: string;
  quantity: number;
  unitCost: number;
  category?: string;
}

interface CreatePOData {
  supplierId: string;
  items: POItemData[];
  expectedDate?: string;
  notes?: string;
  tax?: number;
}

// Use explicit character codes to avoid encoding issues
const Q = String.fromCharCode(39); // single quote
const DQ = String.fromCharCode(34); // double quote

function generatePONumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'PO-' + y + m + d + '-' + random;
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
    console.error('[PurchaseOrders] Failed to add to sync queue:', error);
  }
}

export function registerPurchaseOrdersHandlers() {
  console.log('[IPC] Registering Purchase Orders handlers...');
  const dbManager = DatabaseManager.getInstance();

  ipcMain.handle('getPurchaseOrdersPaginated', async (_, params: {
    page?: number; limit?: number; search?: string; status?: string;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const page = (params && params.page) || 1;
      const limit = (params && params.limit) || 10;
      const search = params && params.search;
      const status = params && params.status;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';

      if (search && search.trim()) {
        const searchEsc = escId(search.trim());
        whereClause = whereClause + ' AND (po.' + col('poNumber') + ' LIKE ' + Q + '%' + searchEsc + '%' + Q + ' OR s.' + col('name') + ' LIKE ' + Q + '%' + searchEsc + '%' + Q + ')';
      }
      if (status && status.trim()) {
        const statusEsc = escId(status.trim());
        whereClause = whereClause + ' AND po.' + col('status') + ' = ' + Q + statusEsc + Q;
      }

      const countSql = 'SELECT COUNT(*) as count FROM ' + col('PurchaseOrder') + ' po LEFT JOIN ' + col('Supplier') + ' s ON po.' + col('supplierId') + ' = s.' + col('id') + ' ' + whereClause;
      console.log('[PurchaseOrders] Count SQL:', countSql);
      const countResult: any[] = await prisma.$queryRawUnsafe(countSql);
      const totalCount = Number(countResult[0]?.count || 0);

      const selectSql = 'SELECT po.*, s.' + col('name') + ' as supplierName FROM ' + col('PurchaseOrder') + ' po LEFT JOIN ' + col('Supplier') + ' s ON po.' + col('supplierId') + ' = s.' + col('id') + ' ' + whereClause + ' ORDER BY po.' + col('createdAt') + ' DESC LIMIT ' + limit + ' OFFSET ' + offset;
      console.log('[PurchaseOrders] Select SQL:', selectSql);
      const orders: any[] = await prisma.$queryRawUnsafe(selectSql);

      for (const order of orders) {
        const orderId = escId(order.id);
        const itemsSql = 'SELECT * FROM ' + col('PurchaseOrderItem') + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + orderId + Q;
        const items: any[] = await prisma.$queryRawUnsafe(itemsSql);
        order.items = items;
        order.supplier = { id: order.supplierId, name: order.supplierName };
      }

      return {
        success: true,
        orders: orders,
        pagination: { page: page, limit: limit, totalCount: totalCount, totalPages: Math.ceil(totalCount / limit) }
      };
    } catch (error) {
      console.error('[PurchaseOrders] Error fetching orders:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('getPurchaseOrderById', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const idEsc = escId(id);
      const orderSql = 'SELECT po.*, s.' + col('name') + ' as supplierName, s.' + col('phone') + ' as supplierPhone, s.' + col('email') + ' as supplierEmail FROM ' + col('PurchaseOrder') + ' po LEFT JOIN ' + col('Supplier') + ' s ON po.' + col('supplierId') + ' = s.' + col('id') + ' WHERE po.' + col('id') + ' = ' + Q + idEsc + Q;
      const orders: any[] = await prisma.$queryRawUnsafe(orderSql);

      if (orders.length === 0) return { success: false, error: 'Purchase order not found' };

      const order = orders[0];
      order.supplier = { id: order.supplierId, name: order.supplierName, phone: order.supplierPhone, email: order.supplierEmail };
      
      const itemsSql = 'SELECT * FROM ' + col('PurchaseOrderItem') + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + idEsc + Q;
      order.items = await prisma.$queryRawUnsafe(itemsSql);
      
      const grnSql = 'SELECT * FROM ' + col('GoodsReceivedNote') + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + idEsc + Q + ' ORDER BY ' + col('receivedDate') + ' DESC';
      order.grns = await prisma.$queryRawUnsafe(grnSql);

      return { success: true, order: order };
    } catch (error) {
      console.error('[PurchaseOrders] Error fetching order:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('createPurchaseOrder', async (_, data: CreatePOData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.supplierId) return { success: false, error: 'Supplier is required' };
      if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

      const validItems = data.items.filter(function(item) {
        return item.medicineName && item.medicineName.trim() && item.quantity > 0 && item.unitCost > 0;
      });
      if (validItems.length === 0) return { success: false, error: 'At least one valid item is required' };

      const now = formatDateTime();
      const poId = randomUUID();
      const poNumber = generatePONumber();

      let subtotal = 0;
      for (const item of validItems) {
        subtotal = subtotal + (item.quantity * item.unitCost);
      }
      const tax = data.tax || 0;
      const total = subtotal + tax;

      const notesVal = esc(data.notes);
      const expectedDateVal = data.expectedDate ? esc(data.expectedDate) : 'NULL';
      const supplierIdEsc = escId(data.supplierId);

      const insertPoSql = 'INSERT INTO ' + col('PurchaseOrder') + ' (' + col('id') + ', ' + col('poNumber') + ', ' + col('supplierId') + ', ' + col('status') + ', ' + col('subtotal') + ', ' + col('tax') + ', ' + col('total') + ', ' + col('notes') + ', ' + col('expectedDate') + ', ' + col('createdAt') + ', ' + col('updatedAt') + ') VALUES (' + Q + poId + Q + ', ' + Q + poNumber + Q + ', ' + Q + supplierIdEsc + Q + ', ' + Q + 'DRAFT' + Q + ', ' + subtotal + ', ' + tax + ', ' + total + ', ' + notesVal + ', ' + expectedDateVal + ', ' + Q + now + Q + ', ' + Q + now + Q + ')';
      await prisma.$executeRawUnsafe(insertPoSql);

      for (const item of validItems) {
        const itemId = randomUUID();
        const itemTotal = item.quantity * item.unitCost;
        const medicineNameEsc = escId(item.medicineName.trim());
        const genericNameVal = esc(item.genericName ? item.genericName.trim() : null);
        const categoryVal = esc(item.category);
        
        const insertItemSql = 'INSERT INTO ' + col('PurchaseOrderItem') + ' (' + col('id') + ', ' + col('purchaseOrderId') + ', ' + col('medicineName') + ', ' + col('genericName') + ', ' + col('quantity') + ', ' + col('receivedQty') + ', ' + col('unitCost') + ', ' + col('total') + ', ' + col('category') + ') VALUES (' + Q + itemId + Q + ', ' + Q + poId + Q + ', ' + Q + medicineNameEsc + Q + ', ' + genericNameVal + ', ' + item.quantity + ', 0, ' + item.unitCost + ', ' + itemTotal + ', ' + categoryVal + ')';
        await prisma.$executeRawUnsafe(insertItemSql);
      }

      await addToSyncQueue(prisma, 'PURCHASE_ORDER', poId, 'CREATE', {});
      return { success: true, orderId: poId, poNumber: poNumber };
    } catch (error) {
      console.error('[PurchaseOrders] Error creating order:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('updatePurchaseOrderStatus', async (_, params: { id: string; status: string; }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const now = formatDateTime();
      const idEsc = escId(params.id);
      const statusEsc = escId(params.status);
      const updateSql = 'UPDATE ' + col('PurchaseOrder') + ' SET ' + col('status') + ' = ' + Q + statusEsc + Q + ', ' + col('updatedAt') + ' = ' + Q + now + Q + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
      await prisma.$executeRawUnsafe(updateSql);
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', params.id, 'UPDATE', { status: params.status });
      return { success: true };
    } catch (error) {
      console.error('[PurchaseOrders] Error updating status:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('deletePurchaseOrder', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const idEsc = escId(id);
      
      const grnCountSql = 'SELECT COUNT(*) as count FROM ' + col('GoodsReceivedNote') + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + idEsc + Q;
      const grnCount: any[] = await prisma.$queryRawUnsafe(grnCountSql);
      if (Number(grnCount[0]?.count || 0) > 0) return { success: false, error: 'Cannot delete PO with received goods' };

      const statusSql = 'SELECT ' + col('status') + ' FROM ' + col('PurchaseOrder') + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
      const orders: any[] = await prisma.$queryRawUnsafe(statusSql);
      if (orders.length > 0 && orders[0].status !== 'DRAFT' && orders[0].status !== 'CANCELLED') {
        return { success: false, error: 'Can only delete draft or cancelled orders' };
      }

      const deleteItemsSql = 'DELETE FROM ' + col('PurchaseOrderItem') + ' WHERE ' + col('purchaseOrderId') + ' = ' + Q + idEsc + Q;
      await prisma.$executeRawUnsafe(deleteItemsSql);
      
      const deletePoSql = 'DELETE FROM ' + col('PurchaseOrder') + ' WHERE ' + col('id') + ' = ' + Q + idEsc + Q;
      await prisma.$executeRawUnsafe(deletePoSql);
      
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', id, 'DELETE', { id: id });
      return { success: true };
    } catch (error) {
      console.error('[PurchaseOrders] Error deleting order:', error);
      return { success: false, error: String(error) };
    }
  });
}
