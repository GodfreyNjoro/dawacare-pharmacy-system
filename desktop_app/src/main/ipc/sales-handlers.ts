import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';

// IPC Channel names for Sales
const SALES_CHANNELS = {
  SALE_GET_ALL: 'sales:get-all',
  SALE_GET_STATS: 'sales:get-stats',
  SALE_VOID: 'sales:void',
} as const;

export function registerSalesHandlers(): void {
  console.log('[IPC] Registering Sales handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get all sales with pagination and filtering
  ipcMain.handle(SALES_CHANNELS.SALE_GET_ALL, async (_, options?: {
    page?: number;
    limit?: number;
    search?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};
      
      if (options?.search) {
        whereClause.OR = [
          { invoiceNumber: { contains: options.search } },
          { customerName: { contains: options.search } },
          { customerPhone: { contains: options.search } },
        ];
      }
      
      if (options?.paymentMethod) {
        whereClause.paymentMethod = options.paymentMethod;
      }
      
      if (options?.startDate || options?.endDate) {
        whereClause.createdAt = {};
        if (options?.startDate) {
          whereClause.createdAt.gte = new Date(options.startDate);
        }
        if (options?.endDate) {
          const endDate = new Date(options.endDate);
          endDate.setHours(23, 59, 59, 999);
          whereClause.createdAt.lte = endDate;
        }
      }

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where: whereClause,
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.sale.count({ where: whereClause }),
      ]);

      return {
        success: true,
        sales,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('[Sales] Error getting sales:', error);
      return { success: false, error: error.message };
    }
  });

  // Get sales statistics
  ipcMain.handle(SALES_CHANNELS.SALE_GET_STATS, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Start of week (Monday)
      const startOfWeek = new Date(startOfToday);
      const dayOfWeek = startOfWeek.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diff);
      
      // Start of month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayStats, weekStats, monthStats, allTimeStats] = await Promise.all([
        // Today
        prisma.sale.aggregate({
          where: { createdAt: { gte: startOfToday } },
          _sum: { total: true },
          _count: { id: true },
        }),
        // This week
        prisma.sale.aggregate({
          where: { createdAt: { gte: startOfWeek } },
          _sum: { total: true },
          _count: { id: true },
        }),
        // This month
        prisma.sale.aggregate({
          where: { createdAt: { gte: startOfMonth } },
          _sum: { total: true },
          _count: { id: true },
        }),
        // All time
        prisma.sale.aggregate({
          _sum: { total: true },
          _count: { id: true },
        }),
      ]);

      return {
        success: true,
        stats: {
          today: { total: todayStats._sum.total || 0, count: todayStats._count.id || 0 },
          week: { total: weekStats._sum.total || 0, count: weekStats._count.id || 0 },
          month: { total: monthStats._sum.total || 0, count: monthStats._count.id || 0 },
          allTime: { total: allTimeStats._sum.total || 0, count: allTimeStats._count.id || 0 },
        },
      };
    } catch (error: any) {
      console.error('[Sales] Error getting stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Void a sale
  ipcMain.handle(SALES_CHANNELS.SALE_VOID, async (_, saleId: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      // Get sale with items
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });

      if (!sale) {
        return { success: false, error: 'Sale not found' };
      }

      if (sale.paymentStatus === 'VOIDED') {
        return { success: false, error: 'Sale is already voided' };
      }

      // Void sale and restore stock
      await prisma.$transaction(async (tx: any) => {
        // Restore medicine stock
        for (const item of sale.items) {
          await tx.medicine.update({
            where: { id: item.medicineId },
            data: {
              quantity: { increment: item.quantity },
              syncStatus: 'PENDING_SYNC',
            },
          });
        }

        // Update sale status
        await tx.sale.update({
          where: { id: saleId },
          data: {
            paymentStatus: 'VOIDED',
            syncStatus: 'PENDING',
          },
        });
      });

      return { success: true };
    } catch (error: any) {
      console.error('[Sales] Error voiding sale:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Sales handlers registered successfully');
}

export { SALES_CHANNELS };
