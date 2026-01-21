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
    console.error('[PurchaseOrders] Failed to add to sync queue:', error);
  }
}

export function registerPurchaseOrdersHandlers() {
  console.log('[IPC] Registering Purchase Orders handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get purchase orders with pagination
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
        const searchEsc = escapeId(search.trim());
        whereClause = whereClause + " AND (po.\"poNumber\" LIKE '%" + searchEsc + "%' ESCAPE '\\' OR s.\"name\" LIKE '%" + searchEsc + "%' ESCAPE '\\')";
      }
      if (status && status.trim()) {
        const statusEsc = escapeId(status.trim());
        whereClause = whereClause + " AND po.\"status\" = '" + statusEsc + "'";
      }

      const countSql = 'SELECT COUNT(*) as count FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" ' + whereClause;
      const countResult: any[] = await prisma.$queryRawUnsafe(countSql);
      const totalCount = Number(countResult[0]?.count || 0);

      const selectSql = 'SELECT po.*, s."name" as supplierName FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" ' + whereClause + ' ORDER BY po."createdAt" DESC LIMIT ' + limit + ' OFFSET ' + offset;
      const orders: any[] = await prisma.$queryRawUnsafe(selectSql);

      for (const order of orders) {
        const orderId = escapeId(order.id);
        const itemsSql = 'SELECT * FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = \'' + orderId + '\'';
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

  // Get single purchase order
  ipcMain.handle('getPurchaseOrderById', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const idEsc = escapeId(id);
      const orderSql = 'SELECT po.*, s."name" as supplierName, s."phone" as supplierPhone, s."email" as supplierEmail FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" WHERE po."id" = \'' + idEsc + '\'';
      const orders: any[] = await prisma.$queryRawUnsafe(orderSql);

      if (orders.length === 0) return { success: false, error: 'Purchase order not found' };

      const order = orders[0];
      order.supplier = { id: order.supplierId, name: order.supplierName, phone: order.supplierPhone, email: order.supplierEmail };
      
      const itemsSql = 'SELECT * FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = \'' + idEsc + '\'';
      order.items = await prisma.$queryRawUnsafe(itemsSql);
      
      const grnSql = 'SELECT * FROM "GoodsReceivedNote" WHERE "purchaseOrderId" = \'' + idEsc + '\' ORDER BY "receivedDate" DESC';
      order.grns = await prisma.$queryRawUnsafe(grnSql);

      return { success: true, order: order };
    } catch (error) {
      console.error('[PurchaseOrders] Error fetching order:', error);
      return { success: false, error: String(error) };
    }
  });

  // Create purchase order
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

      const notesVal = escapeStr(data.notes);
      const expectedDateVal = data.expectedDate ? escapeStr(data.expectedDate) : 'NULL';
      const supplierIdEsc = escapeId(data.supplierId);

      const insertPoSql = 'INSERT INTO "PurchaseOrder" ("id", "poNumber", "supplierId", "status", "subtotal", "tax", "total", "notes", "expectedDate", "createdAt", "updatedAt") VALUES (\'' + poId + '\', \'' + poNumber + '\', \'' + supplierIdEsc + '\', \'DRAFT\', ' + subtotal + ', ' + tax + ', ' + total + ', ' + notesVal + ', ' + expectedDateVal + ', \'' + now + '\', \'' + now + '\')';
      await prisma.$executeRawUnsafe(insertPoSql);

      for (const item of validItems) {
        const itemId = randomUUID();
        const itemTotal = item.quantity * item.unitCost;
        const medicineNameEsc = escapeId(item.medicineName.trim());
        const genericNameVal = escapeStr(item.genericName ? item.genericName.trim() : null);
        const categoryVal = escapeStr(item.category);
        
        const insertItemSql = 'INSERT INTO "PurchaseOrderItem" ("id", "purchaseOrderId", "medicineName", "genericName", "quantity", "receivedQty", "unitCost", "total", "category") VALUES (\'' + itemId + '\', \'' + poId + '\', \'' + medicineNameEsc + '\', ' + genericNameVal + ', ' + item.quantity + ', 0, ' + item.unitCost + ', ' + itemTotal + ', ' + categoryVal + ')';
        await prisma.$executeRawUnsafe(insertItemSql);
      }

      await addToSyncQueue(prisma, 'PURCHASE_ORDER', poId, 'CREATE', {});
      return { success: true, orderId: poId, poNumber: poNumber };
    } catch (error) {
      console.error('[PurchaseOrders] Error creating order:', error);
      return { success: false, error: String(error) };
    }
  });

  // Update purchase order status
  ipcMain.handle('updatePurchaseOrderStatus', async (_, params: { id: string; status: string; }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const now = formatDateTime();
      const idEsc = escapeId(params.id);
      const statusEsc = escapeId(params.status);
      const updateSql = 'UPDATE "PurchaseOrder" SET "status" = \'' + statusEsc + '\', "updatedAt" = \'' + now + '\' WHERE "id" = \'' + idEsc + '\'';
      await prisma.$executeRawUnsafe(updateSql);
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', params.id, 'UPDATE', { status: params.status });
      return { success: true };
    } catch (error) {
      console.error('[PurchaseOrders] Error updating status:', error);
      return { success: false, error: String(error) };
    }
  });

  // Delete purchase order
  ipcMain.handle('deletePurchaseOrder', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const idEsc = escapeId(id);
      
      const grnCountSql = 'SELECT COUNT(*) as count FROM "GoodsReceivedNote" WHERE "purchaseOrderId" = \'' + idEsc + '\'';
      const grnCount: any[] = await prisma.$queryRawUnsafe(grnCountSql);
      if (Number(grnCount[0]?.count || 0) > 0) return { success: false, error: 'Cannot delete PO with received goods' };

      const statusSql = 'SELECT "status" FROM "PurchaseOrder" WHERE "id" = \'' + idEsc + '\'';
      const orders: any[] = await prisma.$queryRawUnsafe(statusSql);
      if (orders.length > 0 && orders[0].status !== 'DRAFT' && orders[0].status !== 'CANCELLED') {
        return { success: false, error: 'Can only delete draft or cancelled orders' };
      }

      const deleteItemsSql = 'DELETE FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = \'' + idEsc + '\'';
      await prisma.$executeRawUnsafe(deleteItemsSql);
      
      const deletePoSql = 'DELETE FROM "PurchaseOrder" WHERE "id" = \'' + idEsc + '\'';
      await prisma.$executeRawUnsafe(deletePoSql);
      
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', id, 'DELETE', { id: id });
      return { success: true };
    } catch (error) {
      console.error('[PurchaseOrders] Error deleting order:', error);
      return { success: false, error: String(error) };
    }
  });
}
