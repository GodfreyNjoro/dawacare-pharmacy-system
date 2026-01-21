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

      const page = (params && params.page) || 1;
      const limit = (params && params.limit) || 10;
      const search = params && params.search;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';

      if (search && search.trim()) {
        const searchEsc = escapeId(search.trim());
        whereClause = whereClause + " AND (g.\"grnNumber\" LIKE '%" + searchEsc + "%' OR po.\"poNumber\" LIKE '%" + searchEsc + "%')";
      }

      const countSql = 'SELECT COUNT(*) as count FROM "GoodsReceivedNote" g LEFT JOIN "PurchaseOrder" po ON g."purchaseOrderId" = po."id" ' + whereClause;
      const countResult: any[] = await prisma.$queryRawUnsafe(countSql);
      const totalCount = Number(countResult[0]?.count || 0);

      const selectSql = 'SELECT g.*, po."poNumber", s."name" as supplierName FROM "GoodsReceivedNote" g LEFT JOIN "PurchaseOrder" po ON g."purchaseOrderId" = po."id" LEFT JOIN "Supplier" s ON po."supplierId" = s."id" ' + whereClause + ' ORDER BY g."receivedDate" DESC LIMIT ' + limit + ' OFFSET ' + offset;
      const grns: any[] = await prisma.$queryRawUnsafe(selectSql);

      for (const grn of grns) {
        const grnIdEsc = escapeId(grn.id);
        const itemsSql = 'SELECT * FROM "GRNItem" WHERE "grnId" = \'' + grnIdEsc + '\'';
        grn.items = await prisma.$queryRawUnsafe(itemsSql);
        grn.purchaseOrder = { id: grn.purchaseOrderId, poNumber: grn.poNumber, supplier: { name: grn.supplierName } };
      }

      return { success: true, grns: grns, pagination: { page: page, limit: limit, totalCount: totalCount, totalPages: Math.ceil(totalCount / limit) } };
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

      const idEsc = escapeId(id);
      const grnSql = 'SELECT g.*, po."poNumber", po."status" as poStatus, s."name" as supplierName FROM "GoodsReceivedNote" g LEFT JOIN "PurchaseOrder" po ON g."purchaseOrderId" = po."id" LEFT JOIN "Supplier" s ON po."supplierId" = s."id" WHERE g."id" = \'' + idEsc + '\'';
      const grns: any[] = await prisma.$queryRawUnsafe(grnSql);

      if (grns.length === 0) return { success: false, error: 'GRN not found' };

      const grn = grns[0];
      const itemsSql = 'SELECT * FROM "GRNItem" WHERE "grnId" = \'' + idEsc + '\'';
      grn.items = await prisma.$queryRawUnsafe(itemsSql);
      grn.purchaseOrder = { id: grn.purchaseOrderId, poNumber: grn.poNumber, status: grn.poStatus, supplier: { name: grn.supplierName } };

      return { success: true, grn: grn };
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

      const ordersSql = 'SELECT po.*, s."name" as supplierName FROM "PurchaseOrder" po LEFT JOIN "Supplier" s ON po."supplierId" = s."id" WHERE po."status" IN (\'SENT\', \'PARTIAL\') ORDER BY po."createdAt" DESC';
      const orders: any[] = await prisma.$queryRawUnsafe(ordersSql);

      for (const order of orders) {
        const orderIdEsc = escapeId(order.id);
        const itemsSql = 'SELECT * FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = \'' + orderIdEsc + '\'';
        order.items = await prisma.$queryRawUnsafe(itemsSql);
        order.supplier = { id: order.supplierId, name: order.supplierName };
      }

      return { success: true, orders: orders };
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

      const validItems = data.items.filter(function(item) {
        return item.medicineName && item.medicineName.trim() && item.batchNumber && item.batchNumber.trim() && item.expiryDate && item.quantityReceived > 0 && item.unitCost > 0;
      });
      if (validItems.length === 0) return { success: false, error: 'All items must have name, batch, expiry, quantity, and cost' };

      const now = formatDateTime();
      const grnId = randomUUID();
      const grnNumber = generateGRNNumber();
      const notesVal = escapeStr(data.notes);
      const poIdEsc = escapeId(data.purchaseOrderId);

      const insertGrnSql = 'INSERT INTO "GoodsReceivedNote" ("id", "grnNumber", "purchaseOrderId", "receivedDate", "notes", "status", "createdAt", "updatedAt") VALUES (\'' + grnId + '\', \'' + grnNumber + '\', \'' + poIdEsc + '\', \'' + now + '\', ' + notesVal + ', \'RECEIVED\', \'' + now + '\', \'' + now + '\')';
      await prisma.$executeRawUnsafe(insertGrnSql);

      for (const item of validItems) {
        const itemId = randomUUID();
        const itemTotal = item.quantityReceived * item.unitCost;
        const addToInv = data.addToInventory !== false ? 1 : 0;
        const medicineNameEsc = escapeId(item.medicineName.trim());
        const batchNumberEsc = escapeId(item.batchNumber.trim());
        const expiryDate = formatDateTime(item.expiryDate);

        const insertItemSql = 'INSERT INTO "GRNItem" ("id", "grnId", "medicineName", "batchNumber", "expiryDate", "quantityReceived", "unitCost", "total", "addedToInventory") VALUES (\'' + itemId + '\', \'' + grnId + '\', \'' + medicineNameEsc + '\', \'' + batchNumberEsc + '\', \'' + expiryDate + '\', ' + item.quantityReceived + ', ' + item.unitCost + ', ' + itemTotal + ', ' + addToInv + ')';
        await prisma.$executeRawUnsafe(insertItemSql);

        // Update PO item received quantity
        const updatePoItemSql = 'UPDATE "PurchaseOrderItem" SET "receivedQty" = "receivedQty" + ' + item.quantityReceived + ' WHERE "purchaseOrderId" = \'' + poIdEsc + '\' AND LOWER("medicineName") = LOWER(\'' + medicineNameEsc + '\')';
        await prisma.$executeRawUnsafe(updatePoItemSql);

        // Add to inventory if requested
        if (data.addToInventory !== false) {
          const existingSql = 'SELECT "id", "quantity" FROM "Medicine" WHERE "batchNumber" = \'' + batchNumberEsc + '\' AND LOWER("name") = LOWER(\'' + medicineNameEsc + '\')';
          const existing: any[] = await prisma.$queryRawUnsafe(existingSql);

          if (existing.length > 0) {
            const updateMedSql = 'UPDATE "Medicine" SET "quantity" = "quantity" + ' + item.quantityReceived + ', "updatedAt" = \'' + now + '\' WHERE "id" = \'' + escapeId(existing[0].id) + '\'';
            await prisma.$executeRawUnsafe(updateMedSql);
            await addToSyncQueue(prisma, 'MEDICINE', existing[0].id, 'UPDATE', { quantityAdded: item.quantityReceived });
          } else {
            const medicineId = randomUUID();
            const sellingPrice = item.unitCost * 1.3;
            const insertMedSql = 'INSERT INTO "Medicine" ("id", "name", "batchNumber", "expiryDate", "quantity", "reorderLevel", "unitPrice", "category", "syncStatus", "createdAt", "updatedAt") VALUES (\'' + medicineId + '\', \'' + medicineNameEsc + '\', \'' + batchNumberEsc + '\', \'' + expiryDate + '\', ' + item.quantityReceived + ', 10, ' + sellingPrice + ', \'General\', \'LOCAL\', \'' + now + '\', \'' + now + '\')';
            await prisma.$executeRawUnsafe(insertMedSql);
            await addToSyncQueue(prisma, 'MEDICINE', medicineId, 'CREATE', {});
          }
        }
      }

      // Update PO status based on received quantities
      const poItemsSql = 'SELECT "quantity", "receivedQty" FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = \'' + poIdEsc + '\'';
      const poItems: any[] = await prisma.$queryRawUnsafe(poItemsSql);

      let totalOrdered = 0;
      let totalReceived = 0;
      for (const i of poItems) {
        totalOrdered = totalOrdered + Number(i.quantity || 0);
        totalReceived = totalReceived + Number(i.receivedQty || 0);
      }

      const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 'PARTIAL';
      const updatePoSql = 'UPDATE "PurchaseOrder" SET "status" = \'' + newStatus + '\', "updatedAt" = \'' + now + '\' WHERE "id" = \'' + poIdEsc + '\'';
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
