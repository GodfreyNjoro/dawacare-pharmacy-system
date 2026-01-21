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

async function addToSyncQueue(prisma: any, entityType: string, entityId: string, operation: string, payload: any = {}) {
  try {
    await prisma.syncQueue.upsert({
      where: { id: entityId + '-' + operation },
      create: {
        id: randomUUID(),
        entityType,
        entityId,
        operation,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
      update: {
        payload: JSON.stringify(payload),
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });
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

      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const skip = (page - 1) * limit;

      // Build where clause using Prisma ORM
      const whereClause: any = {};

      if (params?.search && params.search.trim()) {
        whereClause.OR = [
          { poNumber: { contains: params.search.trim() } },
          { supplier: { name: { contains: params.search.trim() } } },
        ];
      }

      if (params?.status && params.status.trim()) {
        whereClause.status = params.status.trim();
      }

      const [orders, totalCount] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where: whereClause,
          include: {
            supplier: true,
            items: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.purchaseOrder.count({ where: whereClause }),
      ]);

      return {
        success: true,
        orders,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error: any) {
      console.error('[PurchaseOrders] Error fetching orders:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('getPurchaseOrderById', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: true,
          grns: true,
        },
      });

      if (!order) return { success: false, error: 'Purchase order not found' };

      return { success: true, order };
    } catch (error: any) {
      console.error('[PurchaseOrders] Error fetching order:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('createPurchaseOrder', async (_, data: CreatePOData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.supplierId) return { success: false, error: 'Supplier is required' };
      if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

      const validItems = data.items.filter((item) =>
        item.medicineName && item.medicineName.trim() && item.quantity > 0 && item.unitCost > 0
      );
      if (validItems.length === 0) return { success: false, error: 'At least one valid item is required' };

      const poId = randomUUID();
      const poNumber = generatePONumber();

      let subtotal = 0;
      for (const item of validItems) {
        subtotal += item.quantity * item.unitCost;
      }
      const tax = data.tax || 0;
      const total = subtotal + tax;

      // Create PO with items using Prisma ORM
      const order = await prisma.purchaseOrder.create({
        data: {
          id: poId,
          poNumber,
          supplierId: data.supplierId,
          status: 'DRAFT',
          subtotal,
          tax,
          total,
          notes: data.notes || null,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          items: {
            create: validItems.map((item) => ({
              id: randomUUID(),
              medicineName: item.medicineName.trim(),
              genericName: item.genericName?.trim() || null,
              quantity: item.quantity,
              receivedQty: 0,
              unitCost: item.unitCost,
              total: item.quantity * item.unitCost,
              category: item.category || null,
            })),
          },
        },
        include: { items: true },
      });

      await addToSyncQueue(prisma, 'PURCHASE_ORDER', poId, 'CREATE', {});
      return { success: true, orderId: poId, poNumber };
    } catch (error: any) {
      console.error('[PurchaseOrders] Error creating order:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('updatePurchaseOrderStatus', async (_, params: { id: string; status: string }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: { status: params.status },
      });

      await addToSyncQueue(prisma, 'PURCHASE_ORDER', params.id, 'UPDATE', { status: params.status });
      return { success: true };
    } catch (error: any) {
      console.error('[PurchaseOrders] Error updating status:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('deletePurchaseOrder', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      // Check for GRNs
      const grnCount = await prisma.goodsReceivedNote.count({
        where: { purchaseOrderId: id },
      });
      if (grnCount > 0) return { success: false, error: 'Cannot delete PO with received goods' };

      // Check status
      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        select: { status: true },
      });
      if (order && order.status !== 'DRAFT' && order.status !== 'CANCELLED') {
        return { success: false, error: 'Can only delete draft or cancelled orders' };
      }

      // Delete items first, then the order
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await prisma.purchaseOrder.delete({ where: { id } });

      await addToSyncQueue(prisma, 'PURCHASE_ORDER', id, 'DELETE', { id });
      return { success: true };
    } catch (error: any) {
      console.error('[PurchaseOrders] Error deleting order:', error);
      return { success: false, error: error.message || String(error) };
    }
  });
}
