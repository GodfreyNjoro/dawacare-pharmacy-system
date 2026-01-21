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
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PO-${dateStr}-${random}`;
}

// Helper to format datetime for SQLite
function formatDateTime(date?: Date | string): string {
  if (!date) return new Date().toISOString().replace('T', ' ').replace('Z', '');
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

// Helper to escape SQL string values - returns quoted string or NULL
function escapeSQL(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Helper to escape for LIKE clause - returns value without quotes (for use in LIKE pattern)
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

      const { page = 1, limit = 10, search, status } = params || {};
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';

      if (search) {
        const searchEscaped = escapeLike(search);
        whereClause += ` AND (po."poNumber" LIKE '%${searchEscaped}%' OR s."name" LIKE '%${searchEscaped}%')`;
      }
      if (status) {
        const statusEscaped = status.replace(/'/g, "''");
        whereClause += ` AND po."status" = '${statusEscaped}'`;
      }

      const countResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" ${whereClause}`
      );
      const totalCount = Number(countResult[0]?.count || 0);

      const orders: any[] = await prisma.$queryRawUnsafe(
        `SELECT po.*, s."name" as supplierName FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" ${whereClause} ORDER BY po."createdAt" DESC LIMIT ${limit} OFFSET ${offset}`
      );

      for (const order of orders) {
        const orderId = String(order.id).replace(/'/g, "''");
        const items: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = '${orderId}'`);
        order.items = items;
        order.supplier = { id: order.supplierId, name: order.supplierName };
      }

      return { success: true, orders, pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) } };
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

      const idEscaped = String(id).replace(/'/g, "''");
      const orders: any[] = await prisma.$queryRawUnsafe(
        `SELECT po.*, s."name" as supplierName, s."phone" as supplierPhone, s."email" as supplierEmail FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" WHERE po."id" = '${idEscaped}'`
      );

      if (orders.length === 0) return { success: false, error: 'Purchase order not found' };

      const order = orders[0];
      order.supplier = { id: order.supplierId, name: order.supplierName, phone: order.supplierPhone, email: order.supplierEmail };
      order.items = await prisma.$queryRawUnsafe(`SELECT * FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = '${idEscaped}'`);
      order.grns = await prisma.$queryRawUnsafe(`SELECT * FROM "GoodsReceivedNote" WHERE "purchaseOrderId" = '${idEscaped}' ORDER BY "receivedDate" DESC`);

      return { success: true, order };
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

      const validItems = data.items.filter(item => item.medicineName?.trim() && item.quantity > 0 && item.unitCost > 0);
      if (validItems.length === 0) return { success: false, error: 'At least one valid item is required' };

      const now = formatDateTime();
      const poId = randomUUID();
      const poNumber = generatePONumber();

      const subtotal = validItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
      const tax = data.tax || 0;
      const total = subtotal + tax;

      const notes = escapeSQL(data.notes);
      const expectedDate = data.expectedDate ? escapeSQL(data.expectedDate) : 'NULL';

      await prisma.$executeRawUnsafe(`
        INSERT INTO "PurchaseOrder" ("id", "poNumber", "supplierId", "status", "subtotal", "tax", "total", "notes", "expectedDate", "createdAt", "updatedAt")
        VALUES ('${poId}', '${poNumber}', '${data.supplierId}', 'DRAFT', ${subtotal}, ${tax}, ${total}, ${notes}, ${expectedDate}, '${now}', '${now}')
      `);

      for (const item of validItems) {
        const itemId = randomUUID();
        const itemTotal = item.quantity * item.unitCost;
        const medicineName = item.medicineName.trim().replace(/'/g, "''");
        const genericName = escapeSQL(item.genericName?.trim());
        const category = escapeSQL(item.category);
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PurchaseOrderItem" ("id", "purchaseOrderId", "medicineName", "genericName", "quantity", "receivedQty", "unitCost", "total", "category")
          VALUES ('${itemId}', '${poId}', '${medicineName}', ${genericName}, ${item.quantity}, 0, ${item.unitCost}, ${itemTotal}, ${category})
        `);
      }

      await addToSyncQueue(prisma, 'PURCHASE_ORDER', poId, 'CREATE', {});
      return { success: true, orderId: poId, poNumber };
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
      await prisma.$executeRawUnsafe(`UPDATE "PurchaseOrder" SET "status" = '${params.status}', "updatedAt" = '${now}' WHERE "id" = '${params.id}'`);
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

      const idEscaped = String(id).replace(/'/g, "''");
      
      const grnCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "GoodsReceivedNote" WHERE "purchaseOrderId" = '${idEscaped}'`);
      if (Number(grnCount[0]?.count || 0) > 0) return { success: false, error: 'Cannot delete PO with received goods' };

      const orders: any[] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "PurchaseOrder" WHERE "id" = '${idEscaped}'`);
      if (orders.length > 0 && !['DRAFT', 'CANCELLED'].includes(orders[0].status)) {
        return { success: false, error: 'Can only delete draft or cancelled orders' };
      }

      await prisma.$executeRawUnsafe(`DELETE FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = '${idEscaped}'`);
      await prisma.$executeRawUnsafe(`DELETE FROM "PurchaseOrder" WHERE "id" = '${idEscaped}'`);
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', id, 'DELETE', { id });
      return { success: true };
    } catch (error) {
      console.error('[PurchaseOrders] Error deleting order:', error);
      return { success: false, error: String(error) };
    }
  });
}
