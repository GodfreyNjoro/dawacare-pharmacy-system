import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';

// IPC Channel names for Controlled Substances
const CONTROLLED_CHANNELS = {
  GET_DASHBOARD: 'controlled:get-dashboard',
  GET_REGISTER: 'controlled:get-register',
  GET_CONTROLLED_MEDICINES: 'controlled:get-medicines',
  CREATE_ENTRY: 'controlled:create-entry',
  VERIFY_ENTRY: 'controlled:verify-entry',
  UPDATE_MEDICINE_CONTROLLED: 'controlled:update-medicine',
} as const;

// Helper function to generate entry number
function generateEntryNumber(branchCode: string): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `CSR-${branchCode || 'MAIN'}-${year}-${random}`;
}

export function registerControlledSubstancesHandlers(): void {
  console.log('[IPC] Registering Controlled Substances handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get Dashboard Stats
  ipcMain.handle(CONTROLLED_CHANNELS.GET_DASHBOARD, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      // Get total controlled medicines
      const totalControlled = await prisma.medicine.count({
        where: { isControlled: true },
      });

      // Get by schedule class
      const bySchedule = await prisma.medicine.groupBy({
        by: ['scheduleClass'],
        where: { isControlled: true, scheduleClass: { not: null } },
        _count: { id: true },
        _sum: { quantity: true },
      });

      // Get recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentTransactions = await prisma.controlledSubstanceRegister.count({
        where: {
          transactionDate: { gte: thirtyDaysAgo },
        },
      });

      // Get pending verifications
      const pendingVerifications = await prisma.controlledSubstanceRegister.count({
        where: { verifiedBy: null },
      });

      // Low stock controlled substances
      const lowStockControlled = await prisma.medicine.count({
        where: {
          isControlled: true,
          quantity: { lte: 10 },
        },
      });

      // Get total quantity tracked
      const totalQuantity = await prisma.medicine.aggregate({
        where: { isControlled: true },
        _sum: { quantity: true },
      });

      return {
        success: true,
        stats: {
          totalControlled,
          totalQuantity: totalQuantity._sum?.quantity || 0,
          recentTransactions,
          pendingVerifications,
          lowStockControlled,
          bySchedule: (bySchedule || []).map((s: any) => ({
            scheduleClass: s.scheduleClass || 'Unknown',
            count: s._count?.id || s._count || 0,
            quantity: s._sum?.quantity || 0,
          })),
        },
      };
    } catch (error: any) {
      console.error('[Controlled] Error getting dashboard:', error);
      return { success: false, error: error.message };
    }
  });

  // Get Controlled Medicines List
  ipcMain.handle(
    CONTROLLED_CHANNELS.GET_CONTROLLED_MEDICINES,
    async (
      _,
      options?: {
        page?: number;
        limit?: number;
        search?: string;
        scheduleClass?: string;
      }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const search = options?.search || '';
        const scheduleClass = options?.scheduleClass;

        const whereClause: any = {
          isControlled: true,
        };

        if (search) {
          const searchLower = search.toLowerCase();
          whereClause.OR = [
            { name: { contains: searchLower } },
            { genericName: { contains: searchLower } },
            { batchNumber: { contains: searchLower } },
          ];
        }

        if (scheduleClass && scheduleClass !== 'all') {
          whereClause.scheduleClass = scheduleClass;
        }

        const [medicines, total] = await Promise.all([
          prisma.medicine.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { name: 'asc' },
          }),
          prisma.medicine.count({ where: whereClause }),
        ]);

        return {
          success: true,
          medicines,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error: any) {
        console.error('[Controlled] Error getting medicines:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Get Register Entries
  ipcMain.handle(
    CONTROLLED_CHANNELS.GET_REGISTER,
    async (
      _,
      options?: {
        page?: number;
        limit?: number;
        search?: string;
        scheduleClass?: string;
        transactionType?: string;
        startDate?: string;
        endDate?: string;
      }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        const whereClause: any = {};

        if (options?.search) {
          const searchLower = options.search.toLowerCase();
          whereClause.OR = [
            { entryNumber: { contains: searchLower } },
            { medicineName: { contains: searchLower } },
            { patientName: { contains: searchLower } },
          ];
        }

        if (options?.scheduleClass && options.scheduleClass !== 'all') {
          whereClause.scheduleClass = options.scheduleClass;
        }

        if (options?.transactionType && options.transactionType !== 'all') {
          whereClause.transactionType = options.transactionType;
        }

        if (options?.startDate) {
          whereClause.transactionDate = {
            ...whereClause.transactionDate,
            gte: new Date(options.startDate),
          };
        }

        if (options?.endDate) {
          whereClause.transactionDate = {
            ...whereClause.transactionDate,
            lte: new Date(options.endDate),
          };
        }

        const [entries, total] = await Promise.all([
          prisma.controlledSubstanceRegister.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { transactionDate: 'desc' },
            include: {
              medicine: {
                select: { id: true, name: true, quantity: true },
              },
            },
          }),
          prisma.controlledSubstanceRegister.count({ where: whereClause }),
        ]);

        return {
          success: true,
          entries,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error: any) {
        console.error('[Controlled] Error getting register:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Create Register Entry
  ipcMain.handle(
    CONTROLLED_CHANNELS.CREATE_ENTRY,
    async (
      _,
      data: {
        medicineId: string;
        transactionType: string;
        quantityIn?: number;
        quantityOut?: number;
        patientName?: string;
        patientId?: string;
        prescriptionNumber?: string;
        prescriberName?: string;
        prescriberRegNo?: string;
        supplierName?: string;
        supplierLicense?: string;
        witnessName?: string;
        witnessRole?: string;
        destructionMethod?: string;
        notes?: string;
        recordedBy: string;
        recordedByName: string;
        recordedByRole: string;
        branchCode?: string;
      }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        // Validate medicine exists and is controlled
        const medicine = await prisma.medicine.findUnique({
          where: { id: data.medicineId },
        });

        if (!medicine) {
          return { success: false, error: 'Medicine not found' };
        }

        if (!medicine.isControlled) {
          return { success: false, error: 'Medicine is not marked as controlled' };
        }

        // Calculate balance
        const balanceBefore = medicine.quantity;
        const quantityIn = data.quantityIn || 0;
        const quantityOut = data.quantityOut || 0;
        const balanceAfter = balanceBefore + quantityIn - quantityOut;

        if (balanceAfter < 0) {
          return { success: false, error: 'Insufficient stock for this transaction' };
        }

        // Generate entry number
        const entryNumber = generateEntryNumber(data.branchCode || 'MAIN');

        // Create entry and update medicine quantity in transaction
        const [entry] = await prisma.$transaction([
          prisma.controlledSubstanceRegister.create({
            data: {
              entryNumber,
              medicineId: data.medicineId,
              medicineName: medicine.name,
              genericName: medicine.genericName,
              batchNumber: medicine.batchNumber,
              scheduleClass: medicine.scheduleClass || 'SCHEDULE_II',
              transactionType: data.transactionType,
              quantityIn,
              quantityOut,
              balanceBefore,
              balanceAfter,
              patientName: data.patientName,
              patientId: data.patientId,
              prescriptionNumber: data.prescriptionNumber,
              prescriberName: data.prescriberName,
              prescriberRegNo: data.prescriberRegNo,
              supplierName: data.supplierName,
              supplierLicense: data.supplierLicense,
              witnessName: data.witnessName,
              witnessRole: data.witnessRole,
              destructionMethod: data.destructionMethod,
              notes: data.notes,
              recordedBy: data.recordedBy,
              recordedByName: data.recordedByName,
              recordedByRole: data.recordedByRole,
            },
          }),
          prisma.medicine.update({
            where: { id: data.medicineId },
            data: { quantity: balanceAfter },
          }),
        ]);

        return { success: true, entry };
      } catch (error: any) {
        console.error('[Controlled] Error creating entry:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Verify Entry
  ipcMain.handle(
    CONTROLLED_CHANNELS.VERIFY_ENTRY,
    async (
      _,
      data: {
        entryId: string;
        verifiedBy: string;
        verifiedByName: string;
      }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        const entry = await prisma.controlledSubstanceRegister.update({
          where: { id: data.entryId },
          data: {
            verifiedBy: data.verifiedBy,
            verifiedByName: data.verifiedByName,
            verifiedAt: new Date(),
          },
        });

        return { success: true, entry };
      } catch (error: any) {
        console.error('[Controlled] Error verifying entry:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Update Medicine Controlled Status
  ipcMain.handle(
    CONTROLLED_CHANNELS.UPDATE_MEDICINE_CONTROLLED,
    async (
      _,
      data: {
        medicineId: string;
        isControlled: boolean;
        scheduleClass?: string;
      }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        const medicine = await prisma.medicine.update({
          where: { id: data.medicineId },
          data: {
            isControlled: data.isControlled,
            scheduleClass: data.isControlled ? data.scheduleClass : null,
          },
        });

        return { success: true, medicine };
      } catch (error: any) {
        console.error('[Controlled] Error updating medicine:', error);
        return { success: false, error: error.message };
      }
    }
  );

  console.log('[IPC] Controlled Substances handlers registered');
}
