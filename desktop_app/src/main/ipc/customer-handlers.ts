import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';

// IPC Channel names for Customers
const CUSTOMER_CHANNELS = {
  CUSTOMER_GET_ALL_PAGINATED: 'customer:get-all-paginated',
  CUSTOMER_GET_DETAILS: 'customer:get-details',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_TOGGLE_STATUS: 'customer:toggle-status',
} as const;

export function registerCustomerHandlers(): void {
  console.log('[IPC] Registering Customer handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get all customers with pagination and filtering
  ipcMain.handle(CUSTOMER_CHANNELS.CUSTOMER_GET_ALL_PAGINATED, async (_, options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
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
          { name: { contains: options.search } },
          { phone: { contains: options.search } },
          { email: { contains: options.search } },
        ];
      }
      
      if (options?.status) {
        whereClause.status = options.status;
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where: whereClause,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.customer.count({ where: whereClause }),
      ]);

      return {
        success: true,
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('[Customer] Error getting customers:', error);
      return { success: false, error: error.message };
    }
  });

  // Get customer details with sales history
  ipcMain.handle(CUSTOMER_CHANNELS.CUSTOMER_GET_DETAILS, async (_, customerId: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      // Get sales for this customer
      const sales = await prisma.sale.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get loyalty transactions
      const loyaltyTransactions = await prisma.loyaltyTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get credit transactions
      const creditTransactions = await prisma.creditTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Calculate total spent
      const totalSpent = await prisma.sale.aggregate({
        where: { customerId },
        _sum: { total: true },
        _count: { id: true },
      });

      return {
        success: true,
        customer: {
          ...customer,
          sales,
          loyaltyTransactions,
          creditTransactions,
        },
        stats: {
          totalSpent: totalSpent._sum.total || 0,
          totalPurchases: totalSpent._count.id || 0,
        },
      };
    } catch (error: any) {
      console.error('[Customer] Error getting customer details:', error);
      return { success: false, error: error.message };
    }
  });

  // Update customer
  ipcMain.handle(CUSTOMER_CHANNELS.CUSTOMER_UPDATE, async (_, customerId: string, data: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    dateOfBirth?: string;
    gender?: string;
    creditLimit?: number;
    notes?: string;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      // Check if phone already exists for another customer
      if (data.phone) {
        const existing = await prisma.customer.findFirst({
          where: {
            phone: data.phone,
            id: { not: customerId },
          },
        });
        if (existing) {
          return { success: false, error: 'Phone number already in use' };
        }
      }

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          ...data,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          syncStatus: 'PENDING_SYNC',
        },
      });

      return { success: true, customer };
    } catch (error: any) {
      console.error('[Customer] Error updating customer:', error);
      return { success: false, error: error.message };
    }
  });

  // Toggle customer status
  ipcMain.handle(CUSTOMER_CHANNELS.CUSTOMER_TOGGLE_STATUS, async (_, customerId: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      const newStatus = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      
      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: {
          status: newStatus,
          syncStatus: 'PENDING_SYNC',
        },
      });

      return { success: true, customer: updated };
    } catch (error: any) {
      console.error('[Customer] Error toggling customer status:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Customer handlers registered successfully');
}

export { CUSTOMER_CHANNELS };
