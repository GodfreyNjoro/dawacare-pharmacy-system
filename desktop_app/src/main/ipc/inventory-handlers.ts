import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';

// IPC Channel names for Inventory
const INVENTORY_CHANNELS = {
  MEDICINE_CREATE: 'inventory:medicine-create',
  MEDICINE_UPDATE: 'inventory:medicine-update',
  MEDICINE_DELETE: 'inventory:medicine-delete',
  MEDICINE_GET_PAGINATED: 'inventory:medicine-get-paginated',
  MEDICINE_ADJUST_STOCK: 'inventory:medicine-adjust-stock',
} as const;

export function registerInventoryHandlers(): void {
  console.log('[IPC] Registering Inventory handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Create medicine
  ipcMain.handle(INVENTORY_CHANNELS.MEDICINE_CREATE, async (_, data: {
    name: string;
    genericName?: string;
    manufacturer?: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    reorderLevel?: number;
    unitPrice: number;
    category: string;
    description?: string;
    branchId?: string;
    isControlled?: boolean;
    scheduleClass?: string | null;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      // Validate required fields
      if (!data.name || !data.batchNumber || !data.expiryDate || data.unitPrice === undefined) {
        return { success: false, error: 'Missing required fields' };
      }

      // Validate controlled substance must have schedule class
      if (data.isControlled && !data.scheduleClass) {
        return { success: false, error: 'Controlled substances require a schedule class' };
      }

      // Check if batch number already exists
      const existing = await prisma.medicine.findFirst({
        where: { batchNumber: data.batchNumber },
      });
      if (existing) {
        return { success: false, error: 'Batch number already exists' };
      }

      // Validate expiry date is in the future
      const expiryDate = new Date(data.expiryDate);
      if (expiryDate <= new Date()) {
        return { success: false, error: 'Expiry date must be in the future' };
      }

      const medicine = await prisma.medicine.create({
        data: {
          name: data.name,
          genericName: data.genericName || null,
          manufacturer: data.manufacturer || null,
          batchNumber: data.batchNumber,
          expiryDate,
          quantity: data.quantity || 0,
          reorderLevel: data.reorderLevel || 10,
          unitPrice: data.unitPrice,
          category: data.category || 'Other',
          description: data.description || null,
          branchId: data.branchId || null,
          isControlled: data.isControlled || false,
          scheduleClass: data.isControlled ? (data.scheduleClass || null) : null,
          syncStatus: 'PENDING_SYNC',
        },
      });

      // Add to sync queue
      await addToSyncQueue(prisma, 'MEDICINE', medicine.id, 'CREATE', medicine);

      return { success: true, medicine };
    } catch (error: any) {
      console.error('[Inventory] Error creating medicine:', error);
      return { success: false, error: error.message };
    }
  });

  // Update medicine
  ipcMain.handle(INVENTORY_CHANNELS.MEDICINE_UPDATE, async (_, medicineId: string, data: {
    name?: string;
    genericName?: string;
    manufacturer?: string;
    batchNumber?: string;
    expiryDate?: string;
    quantity?: number;
    reorderLevel?: number;
    unitPrice?: number;
    category?: string;
    description?: string;
    isControlled?: boolean;
    scheduleClass?: string | null;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const existing = await prisma.medicine.findUnique({ where: { id: medicineId } });
      if (!existing) {
        return { success: false, error: 'Medicine not found' };
      }

      // Check if batch number is being changed and already exists
      if (data.batchNumber && data.batchNumber !== existing.batchNumber) {
        const batchExists = await prisma.medicine.findFirst({
          where: {
            batchNumber: data.batchNumber,
            id: { not: medicineId },
          },
        });
        if (batchExists) {
          return { success: false, error: 'Batch number already exists' };
        }
      }

      // Validate controlled substance must have schedule class
      const isControlled = data.isControlled !== undefined ? data.isControlled : existing.isControlled;
      if (isControlled && data.isControlled !== undefined && data.isControlled && !data.scheduleClass) {
        return { success: false, error: 'Controlled substances require a schedule class' };
      }

      const updateData: any = { ...data, syncStatus: 'PENDING_SYNC' };
      if (data.expiryDate) {
        updateData.expiryDate = new Date(data.expiryDate);
      }
      // Handle controlled substance fields
      if (data.isControlled === false) {
        updateData.scheduleClass = null;
      }

      const medicine = await prisma.medicine.update({
        where: { id: medicineId },
        data: updateData,
      });

      // Add to sync queue
      await addToSyncQueue(prisma, 'MEDICINE', medicine.id, 'UPDATE', medicine);

      return { success: true, medicine };
    } catch (error: any) {
      console.error('[Inventory] Error updating medicine:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete medicine
  ipcMain.handle(INVENTORY_CHANNELS.MEDICINE_DELETE, async (_, medicineId: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      // Check if medicine has been sold
      const salesCount = await prisma.saleItem.count({
        where: { medicineId },
      });

      if (salesCount > 0) {
        return { success: false, error: 'Cannot delete medicine with sales history. Set quantity to 0 instead.' };
      }

      await prisma.medicine.delete({ where: { id: medicineId } });

      // Add to sync queue
      await addToSyncQueue(prisma, 'MEDICINE', medicineId, 'DELETE', { id: medicineId });

      return { success: true };
    } catch (error: any) {
      console.error('[Inventory] Error deleting medicine:', error);
      return { success: false, error: error.message };
    }
  });

  // Get medicines with pagination
  ipcMain.handle(INVENTORY_CHANNELS.MEDICINE_GET_PAGINATED, async (_, options?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    stockFilter?: 'all' | 'low' | 'out';
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};
      
      if (options?.search) {
        whereClause.OR = [
          { name: { contains: options.search } },
          { genericName: { contains: options.search } },
          { batchNumber: { contains: options.search } },
        ];
      }
      
      if (options?.category && options.category !== 'All Categories') {
        whereClause.category = options.category;
      }

      if (options?.stockFilter === 'out') {
        whereClause.quantity = 0;
      } else if (options?.stockFilter === 'low') {
        whereClause.AND = [
          { quantity: { gt: 0 } },
          {
            quantity: {
              lte: prisma.medicine.fields.reorderLevel, // This won't work directly, need raw query
            },
          },
        ];
      }

      const [medicines, total] = await Promise.all([
        prisma.medicine.findMany({
          where: whereClause,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.medicine.count({ where: whereClause }),
      ]);

      // Filter low stock in application if needed (since Prisma doesn't easily support comparing columns)
      let filteredMedicines = medicines;
      if (options?.stockFilter === 'low') {
        filteredMedicines = medicines.filter((m: any) => m.quantity > 0 && m.quantity <= m.reorderLevel);
      }

      return {
        success: true,
        medicines: filteredMedicines,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('[Inventory] Error getting medicines:', error);
      return { success: false, error: error.message };
    }
  });

  // Adjust stock
  ipcMain.handle(INVENTORY_CHANNELS.MEDICINE_ADJUST_STOCK, async (_, medicineId: string, adjustment: number, reason?: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
      if (!medicine) {
        return { success: false, error: 'Medicine not found' };
      }

      const newQuantity = medicine.quantity + adjustment;
      if (newQuantity < 0) {
        return { success: false, error: 'Cannot adjust below zero' };
      }

      const updated = await prisma.medicine.update({
        where: { id: medicineId },
        data: {
          quantity: newQuantity,
          syncStatus: 'PENDING_SYNC',
        },
      });

      // Add to sync queue
      await addToSyncQueue(prisma, 'MEDICINE', medicineId, 'UPDATE', { adjustment, reason });

      return { success: true, medicine: updated };
    } catch (error: any) {
      console.error('[Inventory] Error adjusting stock:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Inventory handlers registered successfully');
}

// Helper function to add items to sync queue
async function addToSyncQueue(
  prisma: any,
  entityType: string,
  entityId: string,
  operation: string,
  payload: any
): Promise<void> {
  try {
    const { randomUUID } = await import('crypto');
    await prisma.syncQueue.create({
      data: {
        id: randomUUID(),
        entityType,
        entityId,
        operation,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
    });
  } catch (error) {
    console.error('[Inventory] Error adding to sync queue:', error);
  }
}

export { INVENTORY_CHANNELS };
