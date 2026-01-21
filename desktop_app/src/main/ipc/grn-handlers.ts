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

function generateGRNNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'GRN-' + y + m + d + '-' + random;
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
    console.error('[GRN] Failed to add to sync queue:', error);
  }
}

export function registerGRNHandlers() {
  console.log('[IPC] Registering GRN handlers...');
  const dbManager = DatabaseManager.getInstance();

  ipcMain.handle('getGRNsPaginated', async (_, params: { page?: number; limit?: number; search?: string }) => {
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
          { grnNumber: { contains: params.search.trim() } },
          { purchaseOrder: { poNumber: { contains: params.search.trim() } } },
        ];
      }

      const [grns, totalCount] = await Promise.all([
        prisma.goodsReceivedNote.findMany({
          where: whereClause,
          include: {
            purchaseOrder: {
              include: { supplier: true },
            },
            items: true,
          },
          orderBy: { receivedDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.goodsReceivedNote.count({ where: whereClause }),
      ]);

      return {
        success: true,
        grns,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error: any) {
      console.error('[GRN] Error fetching GRNs:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('getGRNById', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const grn = await prisma.goodsReceivedNote.findUnique({
        where: { id },
        include: {
          purchaseOrder: {
            include: { supplier: true, items: true },
          },
          items: true,
        },
      });

      if (!grn) return { success: false, error: 'GRN not found' };

      return { success: true, grn };
    } catch (error: any) {
      console.error('[GRN] Error fetching GRN:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('getPendingPurchaseOrders', async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const orders = await prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['SENT', 'PARTIAL'] },
        },
        include: {
          supplier: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return { success: true, orders };
    } catch (error: any) {
      console.error('[GRN] Error fetching pending POs:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('createGRN', async (_, data: CreateGRNData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.purchaseOrderId) return { success: false, error: 'Purchase order is required' };
      if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

      const validItems = data.items.filter((item) =>
        item.medicineName && item.medicineName.trim() &&
        item.batchNumber && item.batchNumber.trim() &&
        item.expiryDate &&
        item.quantityReceived > 0 &&
        item.unitCost > 0
      );
      if (validItems.length === 0) {
        return { success: false, error: 'All items must have name, batch, expiry, quantity, and cost' };
      }

      const grnId = randomUUID();
      const grnNumber = generateGRNNumber();

      // Create GRN with items using Prisma ORM
      await prisma.goodsReceivedNote.create({
        data: {
          id: grnId,
          grnNumber,
          purchaseOrderId: data.purchaseOrderId,
          receivedDate: new Date(),
          notes: data.notes || null,
          status: 'RECEIVED',
          items: {
            create: validItems.map((item) => ({
              id: randomUUID(),
              medicineName: item.medicineName.trim(),
              batchNumber: item.batchNumber.trim(),
              expiryDate: new Date(item.expiryDate),
              quantityReceived: item.quantityReceived,
              unitCost: item.unitCost,
              total: item.quantityReceived * item.unitCost,
              addedToInventory: data.addToInventory !== false,
            })),
          },
        },
      });

      // Update PO items and potentially inventory
      for (const item of validItems) {
        // Update PO item received quantity
        const poItems = await prisma.purchaseOrderItem.findMany({
          where: {
            purchaseOrderId: data.purchaseOrderId,
            medicineName: { equals: item.medicineName.trim(), mode: 'insensitive' },
          },
        });

        if (poItems.length > 0) {
          await prisma.purchaseOrderItem.update({
            where: { id: poItems[0].id },
            data: {
              receivedQty: { increment: item.quantityReceived },
            },
          });
        }

        // Add to inventory if requested
        if (data.addToInventory !== false) {
          const existingMedicine = await prisma.medicine.findFirst({
            where: {
              batchNumber: item.batchNumber.trim(),
              name: { equals: item.medicineName.trim(), mode: 'insensitive' },
            },
          });

          if (existingMedicine) {
            await prisma.medicine.update({
              where: { id: existingMedicine.id },
              data: {
                quantity: { increment: item.quantityReceived },
              },
            });
            await addToSyncQueue(prisma, 'MEDICINE', existingMedicine.id, 'UPDATE', { quantityAdded: item.quantityReceived });
          } else {
            const medicineId = randomUUID();
            const sellingPrice = item.unitCost * 1.3;
            await prisma.medicine.create({
              data: {
                id: medicineId,
                name: item.medicineName.trim(),
                batchNumber: item.batchNumber.trim(),
                expiryDate: new Date(item.expiryDate),
                quantity: item.quantityReceived,
                reorderLevel: 10,
                unitPrice: sellingPrice,
                category: 'General',
                syncStatus: 'LOCAL',
              },
            });
            await addToSyncQueue(prisma, 'MEDICINE', medicineId, 'CREATE', {});
          }
        }
      }

      // Update PO status
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: data.purchaseOrderId },
      });

      let totalOrdered = 0;
      let totalReceived = 0;
      for (const i of poItems) {
        totalOrdered += Number(i.quantity || 0);
        totalReceived += Number(i.receivedQty || 0);
      }

      const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 'PARTIAL';
      await prisma.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: { status: newStatus },
      });

      await addToSyncQueue(prisma, 'GRN', grnId, 'CREATE', {});
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', data.purchaseOrderId, 'UPDATE', { status: newStatus });

      return { success: true, grnId, grnNumber };
    } catch (error: any) {
      console.error('[GRN] Error creating GRN:', error);
      return { success: false, error: error.message || String(error) };
    }
  });
}
