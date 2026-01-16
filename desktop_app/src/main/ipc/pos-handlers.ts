import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';

// IPC Channel names for POS
const POS_CHANNELS = {
  // Medicines
  MEDICINE_SEARCH: 'pos:medicine-search',
  MEDICINE_GET_ALL: 'pos:medicine-get-all',
  MEDICINE_GET_BY_ID: 'pos:medicine-get-by-id',
  MEDICINE_UPDATE_STOCK: 'pos:medicine-update-stock',
  
  // Customers
  CUSTOMER_SEARCH: 'pos:customer-search',
  CUSTOMER_GET_ALL: 'pos:customer-get-all',
  CUSTOMER_GET_BY_ID: 'pos:customer-get-by-id',
  CUSTOMER_CREATE: 'pos:customer-create',
  CUSTOMER_UPDATE: 'pos:customer-update',
  
  // Sales
  SALE_CREATE: 'pos:sale-create',
  SALE_GET_ALL: 'pos:sale-get-all',
  SALE_GET_BY_ID: 'pos:sale-get-by-id',
  SALE_GET_TODAY_STATS: 'pos:sale-get-today-stats',
  
  // Invoice
  INVOICE_GENERATE_NUMBER: 'pos:invoice-generate-number',
} as const;

export function registerPosHandlers(): void {
  console.log('[IPC] Registering POS handlers...');
  const dbManager = DatabaseManager.getInstance();

  // ==================== MEDICINES ====================
  
  // Search medicines
  ipcMain.handle(POS_CHANNELS.MEDICINE_SEARCH, async (_, query: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const medicines = await prisma.medicine.findMany({
        where: {
          AND: [
            { quantity: { gt: 0 } },
            {
              OR: [
                { name: { contains: query } },
                { genericName: { contains: query } },
                { batchNumber: { contains: query } },
              ],
            },
          ],
        },
        orderBy: { name: 'asc' },
        take: 50,
      });
      
      return { success: true, medicines };
    } catch (error: any) {
      console.error('[POS] Error searching medicines:', error);
      return { success: false, error: error.message };
    }
  });

  // Get all medicines with stock > 0
  ipcMain.handle(POS_CHANNELS.MEDICINE_GET_ALL, async (_, options?: { limit?: number }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const medicines = await prisma.medicine.findMany({
        where: { quantity: { gt: 0 } },
        orderBy: { name: 'asc' },
        take: options?.limit || 100,
      });
      
      return { success: true, medicines };
    } catch (error: any) {
      console.error('[POS] Error getting medicines:', error);
      return { success: false, error: error.message };
    }
  });

  // Get medicine by ID
  ipcMain.handle(POS_CHANNELS.MEDICINE_GET_BY_ID, async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const medicine = await prisma.medicine.findUnique({ where: { id } });
      
      if (!medicine) {
        return { success: false, error: 'Medicine not found' };
      }
      
      return { success: true, medicine };
    } catch (error: any) {
      console.error('[POS] Error getting medicine:', error);
      return { success: false, error: error.message };
    }
  });

  // ==================== CUSTOMERS ====================
  
  // Search customers
  ipcMain.handle(POS_CHANNELS.CUSTOMER_SEARCH, async (_, query: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { phone: { contains: query } },
            { email: { contains: query } },
          ],
          status: 'ACTIVE',
        },
        orderBy: { name: 'asc' },
        take: 20,
      });
      
      return { success: true, customers };
    } catch (error: any) {
      console.error('[POS] Error searching customers:', error);
      return { success: false, error: error.message };
    }
  });

  // Get all customers
  ipcMain.handle(POS_CHANNELS.CUSTOMER_GET_ALL, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const customers = await prisma.customer.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      });
      
      return { success: true, customers };
    } catch (error: any) {
      console.error('[POS] Error getting customers:', error);
      return { success: false, error: error.message };
    }
  });

  // Get customer by ID
  ipcMain.handle(POS_CHANNELS.CUSTOMER_GET_BY_ID, async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const customer = await prisma.customer.findUnique({ where: { id } });
      
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }
      
      return { success: true, customer };
    } catch (error: any) {
      console.error('[POS] Error getting customer:', error);
      return { success: false, error: error.message };
    }
  });

  // Create customer
  ipcMain.handle(POS_CHANNELS.CUSTOMER_CREATE, async (_, data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      // Check if customer with same phone exists
      const existing = await prisma.customer.findUnique({
        where: { phone: data.phone },
      });
      
      if (existing) {
        return { success: false, error: 'Customer with this phone number already exists' };
      }
      
      const customer = await prisma.customer.create({
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          syncStatus: 'PENDING_SYNC',
        },
      });
      
      // Add to sync queue
      await addToSyncQueue(prisma, 'CUSTOMER', customer.id, 'CREATE', customer);
      
      return { success: true, customer };
    } catch (error: any) {
      console.error('[POS] Error creating customer:', error);
      return { success: false, error: error.message };
    }
  });

  // ==================== SALES ====================
  
  // Generate invoice number
  ipcMain.handle(POS_CHANNELS.INVOICE_GENERATE_NUMBER, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get count of sales today
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const count = await prisma.sale.count({
        where: {
          createdAt: { gte: startOfDay },
        },
      });
      
      const invoiceNumber = `INV-${dateStr}-${String(count + 1).padStart(4, '0')}`;
      
      return { success: true, invoiceNumber };
    } catch (error: any) {
      console.error('[POS] Error generating invoice number:', error);
      return { success: false, error: error.message };
    }
  });

  // Create sale
  ipcMain.handle(POS_CHANNELS.SALE_CREATE, async (_, data: {
    items: Array<{
      medicineId: string;
      quantity: number;
    }>;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    discount?: number;
    loyaltyPointsUsed?: number;
    paymentMethod: string;
    notes?: string;
    soldBy?: string;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'No items in cart' };
      }
      
      // Generate invoice number
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const count = await prisma.sale.count({
        where: { createdAt: { gte: startOfDay } },
      });
      const invoiceNumber = `INV-${dateStr}-${String(count + 1).padStart(4, '0')}`;
      
      // Fetch medicines and validate stock
      const medicineIds = data.items.map(item => item.medicineId);
      const medicines = await prisma.medicine.findMany({
        where: { id: { in: medicineIds } },
      });
      
      type MedicineRecord = { id: string; name: string; batchNumber: string; quantity: number; unitPrice: number };
      const medicineMap = new Map<string, MedicineRecord>(medicines.map((m: MedicineRecord) => [m.id, m]));
      
      // Validate stock and calculate totals
      let subtotal = 0;
      const saleItems: Array<{
        medicineId: string;
        medicineName: string;
        batchNumber: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }> = [];
      
      for (const item of data.items) {
        const medicine: MedicineRecord | undefined = medicineMap.get(item.medicineId);
        if (!medicine) {
          return { success: false, error: `Medicine not found: ${item.medicineId}` };
        }
        if (medicine.quantity < item.quantity) {
          return { success: false, error: `Insufficient stock for ${medicine.name}` };
        }
        
        const itemTotal = medicine.unitPrice * item.quantity;
        subtotal += itemTotal;
        
        saleItems.push({
          medicineId: medicine.id,
          medicineName: medicine.name,
          batchNumber: medicine.batchNumber,
          quantity: item.quantity,
          unitPrice: medicine.unitPrice,
          total: itemTotal,
        });
      }
      
      const discount = data.discount || 0;
      const loyaltyPointsUsed = data.loyaltyPointsUsed || 0;
      const pointsDiscount = loyaltyPointsUsed; // 1 point = 1 KES
      const total = Math.max(0, subtotal - discount - pointsDiscount);
      
      // Calculate loyalty points earned (1 point per 100 KES)
      const loyaltyPointsEarned = data.customerId ? Math.floor(total / 100) : 0;
      
      // Create sale with transaction
      const sale = await prisma.$transaction(async (tx: any) => {
        // Create sale
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            customerId: data.customerId || null,
            customerName: data.customerName || null,
            customerPhone: data.customerPhone || null,
            subtotal,
            discount,
            loyaltyPointsUsed,
            loyaltyPointsEarned,
            total,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentMethod === 'CREDIT' ? 'PENDING' : 'PAID',
            notes: data.notes || null,
            soldBy: data.soldBy || null,
            syncStatus: 'PENDING',
            items: {
              create: saleItems,
            },
          },
          include: {
            items: true,
          },
        });
        
        // Update medicine stock
        for (const item of data.items) {
          await tx.medicine.update({
            where: { id: item.medicineId },
            data: {
              quantity: { decrement: item.quantity },
              syncStatus: 'PENDING_SYNC',
            },
          });
        }
        
        // Update customer loyalty points if applicable
        if (data.customerId) {
          // Deduct used points, add earned points
          await tx.customer.update({
            where: { id: data.customerId },
            data: {
              loyaltyPoints: {
                increment: loyaltyPointsEarned - loyaltyPointsUsed,
              },
              ...(data.paymentMethod === 'CREDIT' ? {
                creditBalance: { increment: total },
              } : {}),
            },
          });
          
          // Record loyalty transaction
          if (loyaltyPointsUsed > 0) {
            await tx.loyaltyTransaction.create({
              data: {
                customerId: data.customerId,
                type: 'REDEEM',
                points: -loyaltyPointsUsed,
                saleId: newSale.id,
                description: `Redeemed for sale ${invoiceNumber}`,
              },
            });
          }
          
          if (loyaltyPointsEarned > 0) {
            await tx.loyaltyTransaction.create({
              data: {
                customerId: data.customerId,
                type: 'EARN',
                points: loyaltyPointsEarned,
                saleId: newSale.id,
                description: `Earned from sale ${invoiceNumber}`,
              },
            });
          }
          
          // Record credit transaction if credit sale
          if (data.paymentMethod === 'CREDIT') {
            await tx.creditTransaction.create({
              data: {
                customerId: data.customerId,
                type: 'CREDIT',
                amount: total,
                saleId: newSale.id,
                description: `Credit sale ${invoiceNumber}`,
                createdBy: data.soldBy || null,
              },
            });
          }
        }
        
        return newSale;
      });
      
      // Add to sync queue
      await addToSyncQueue(prisma, 'SALE', sale.id, 'CREATE', sale);
      
      return { success: true, sale };
    } catch (error: any) {
      console.error('[POS] Error creating sale:', error);
      return { success: false, error: error.message };
    }
  });

  // Get today's sales stats
  ipcMain.handle(POS_CHANNELS.SALE_GET_TODAY_STATS, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const [totalSales, salesCount] = await Promise.all([
        prisma.sale.aggregate({
          where: { createdAt: { gte: startOfDay } },
          _sum: { total: true },
        }),
        prisma.sale.count({
          where: { createdAt: { gte: startOfDay } },
        }),
      ]);
      
      return {
        success: true,
        stats: {
          totalRevenue: totalSales._sum.total || 0,
          salesCount,
        },
      };
    } catch (error: any) {
      console.error('[POS] Error getting today stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Get sale by ID
  ipcMain.handle(POS_CHANNELS.SALE_GET_BY_ID, async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }
      
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          items: true,
          customer: true,
        },
      });
      
      if (!sale) {
        return { success: false, error: 'Sale not found' };
      }
      
      return { success: true, sale };
    } catch (error: any) {
      console.error('[POS] Error getting sale:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] POS handlers registered successfully');
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
    await prisma.syncQueue.create({
      data: {
        entityType,
        entityId,
        operation,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
    });
  } catch (error) {
    console.error('[POS] Error adding to sync queue:', error);
  }
}

export { POS_CHANNELS };
