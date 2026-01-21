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
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `GRN-${dateStr}-${random}`;
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
    console.error('[GRN] Failed to add to sync queue:', error);
  }
}

export function registerGRNHandlers() {
  console.log('[IPC] Registering GRN handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get GRNs with pagination
  ipcMain.handle('getGRNsPaginated', async (_, params: { page?: number; limit?: number; search?: string; }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const { page = 1, limit = 10, search } = params || {};
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ` AND (g."grnNumber" LIKE ? OR po."poNumber" LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const countResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "GoodsReceivedNote" g LEFT JOIN "PurchaseOrder" po ON g."purchaseOrderId" = po."id" ${whereClause}`,
        ...queryParams
      );
      const totalCount = Number(countResult[0]?.count || 0);

      const grns: any[] = await prisma.$queryRawUnsafe(
        `SELECT g.*, po."poNumber", s."name" as supplierName FROM "GoodsReceivedNote" g LEFT JOIN "PurchaseOrder" po ON g."purchaseOrderId" = po."id" LEFT JOIN "Supplier" s ON po."supplierId" = s."id" ${whereClause} ORDER BY g."receivedDate" DESC LIMIT ? OFFSET ?`,
        ...queryParams, limit, offset
      );

      for (const grn of grns) {
        grn.items = await prisma.$queryRawUnsafe(`SELECT * FROM "GRNItem" WHERE "grnId" = ?`, grn.id);
        grn.purchaseOrder = { id: grn.purchaseOrderId, poNumber: grn.poNumber, supplier: { name: grn.supplierName } };
      }

      return { success: true, grns, pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) } };
    } catch (error) {
      console.error('[GRN] Error fetching GRNs:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get single GRN
  ipcMain.handle('getGRNById', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const grns: any[] = await prisma.$queryRawUnsafe(
        `SELECT g.*, po."poNumber", po."status" as poStatus, s."name" as supplierName FROM "GoodsReceivedNote" g LEFT JOIN "PurchaseOrder" po ON g."purchaseOrderId" = po."id" LEFT JOIN "Supplier" s ON po."supplierId" = s."id" WHERE g."id" = ?`, id
      );

      if (grns.length === 0) return { success: false, error: 'GRN not found' };

      const grn = grns[0];
      grn.items = await prisma.$queryRawUnsafe(`SELECT * FROM "GRNItem" WHERE "grnId" = ?`, id);
      grn.purchaseOrder = { id: grn.purchaseOrderId, poNumber: grn.poNumber, status: grn.poStatus, supplier: { name: grn.supplierName } };

      return { success: true, grn };
    } catch (error) {
      console.error('[GRN] Error fetching GRN:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get pending POs for GRN (SENT or PARTIAL status)
  ipcMain.handle('getPendingPurchaseOrders', async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const orders: any[] = await prisma.$queryRawUnsafe(
        `SELECT po.*, s."name" as supplierName FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" WHERE po."status" IN ('SENT', 'PARTIAL') ORDER BY po."createdAt" DESC`
      );

      for (const order of orders) {
        order.items = await prisma.$queryRawUnsafe(`SELECT * FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = ?`, order.id);
        order.supplier = { id: order.supplierId, name: order.supplierName };
      }

      return { success: true, orders };
    } catch (error) {
      console.error('[GRN] Error fetching pending POs:', error);
      return { success: false, error: String(error) };
    }
  });

  // Create GRN
  ipcMain.handle('createGRN', async (_, data: CreateGRNData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.purchaseOrderId) return { success: false, error: 'Purchase order is required' };
      if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

      const validItems = data.items.filter(item => 
        item.medicineName?.trim() && item.batchNumber?.trim() && item.expiryDate && item.quantityReceived > 0 && item.unitCost > 0
      );
      if (validItems.length === 0) return { success: false, error: 'All items must have name, batch, expiry, quantity, and cost' };

      const now = formatDateTime();
      const grnId = randomUUID();
      const grnNumber = generateGRNNumber();
      const notes = escapeSQL(data.notes);

      await prisma.$executeRawUnsafe(`
        INSERT INTO "GoodsReceivedNote" ("id", "grnNumber", "purchaseOrderId", "receivedDate", "notes", "status", "createdAt", "updatedAt")
        VALUES ('${grnId}', '${grnNumber}', '${data.purchaseOrderId}', '${now}', ${notes}, 'RECEIVED', '${now}', '${now}')
      `);

      for (const item of validItems) {
        const itemId = randomUUID();
        const itemTotal = item.quantityReceived * item.unitCost;
        const addToInv = data.addToInventory !== false ? 1 : 0;
        const medicineName = item.medicineName.trim().replace(/'/g, "''");
        const batchNumber = item.batchNumber.trim().replace(/'/g, "''");
        const expiryDate = formatDateTime(item.expiryDate);

        await prisma.$executeRawUnsafe(`
          INSERT INTO "GRNItem" ("id", "grnId", "medicineName", "batchNumber", "expiryDate", "quantityReceived", "unitCost", "total", "addedToInventory")
          VALUES ('${itemId}', '${grnId}', '${medicineName}', '${batchNumber}', '${expiryDate}', ${item.quantityReceived}, ${item.unitCost}, ${itemTotal}, ${addToInv})
        `);

        // Update PO item received quantity
        await prisma.$executeRawUnsafe(`
          UPDATE "PurchaseOrderItem" SET "receivedQty" = "receivedQty" + ${item.quantityReceived} WHERE "purchaseOrderId" = '${data.purchaseOrderId}' AND LOWER("medicineName") = LOWER('${medicineName}')
        `);

        // Add to inventory if requested
        if (data.addToInventory !== false) {
          const existing: any[] = await prisma.$queryRawUnsafe(
            `SELECT "id", "quantity" FROM "Medicine" WHERE "batchNumber" = '${batchNumber}' AND LOWER("name") = LOWER('${medicineName}')`
          );

          if (existing.length > 0) {
            await prisma.$executeRawUnsafe(`UPDATE "Medicine" SET "quantity" = "quantity" + ${item.quantityReceived}, "updatedAt" = '${now}' WHERE "id" = '${existing[0].id}'`);
            await addToSyncQueue(prisma, 'MEDICINE', existing[0].id, 'UPDATE', { quantityAdded: item.quantityReceived });
          } else {
            const medicineId = randomUUID();
            const sellingPrice = item.unitCost * 1.3;
            await prisma.$executeRawUnsafe(`
              INSERT INTO "Medicine" ("id", "name", "batchNumber", "expiryDate", "quantity", "reorderLevel", "unitPrice", "category", "syncStatus", "createdAt", "updatedAt")
              VALUES ('${medicineId}', '${medicineName}', '${batchNumber}', '${expiryDate}', ${item.quantityReceived}, 10, ${sellingPrice}, 'General', 'LOCAL', '${now}', '${now}')
            `);
            await addToSyncQueue(prisma, 'MEDICINE', medicineId, 'CREATE', {});
          }
        }
      }

      // Update PO status based on received quantities
      const poItems: any[] = await prisma.$queryRawUnsafe(
        `SELECT "quantity", "receivedQty" FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = '${data.purchaseOrderId}'`
      );

      const totalOrdered = poItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
      const totalReceived = poItems.reduce((sum: number, i: any) => sum + i.receivedQty, 0);

      const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 'PARTIAL';
      await prisma.$executeRawUnsafe(`UPDATE "PurchaseOrder" SET "status" = '${newStatus}', "updatedAt" = '${now}' WHERE "id" = '${data.purchaseOrderId}'`);

      await addToSyncQueue(prisma, 'GRN', grnId, 'CREATE', {});
      await addToSyncQueue(prisma, 'PURCHASE_ORDER', data.purchaseOrderId, 'UPDATE', { status: newStatus });

      return { success: true, grnId, grnNumber };
    } catch (error) {
      console.error('[GRN] Error creating GRN:', error);
      return { success: false, error: String(error) };
    }
  });
}
