import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma, PrismaTransactionClient } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'dawacare-desktop-sync-secret';

// Helper to verify auth - supports both session and Bearer token
async function verifyAuth(req: NextRequest): Promise<{ authenticated: boolean; userId?: string }> {
  // First try NextAuth session
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { authenticated: true, userId: (session.user as any).id };
  }
  
  // Then try Bearer token (for desktop app)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return { authenticated: true, userId: decoded.userId };
    } catch {
      return { authenticated: false };
    }
  }
  
  return { authenticated: false };
}

// GET - Download data for offline sync
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lastSyncAt = searchParams.get('lastSyncAt');
    const branchId = searchParams.get('branchId');
    
    // Parse last sync timestamp
    const lastSync = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    
    // Fetch all data updated since last sync
    const [branches, users, medicines, customers, suppliers] = await Promise.all([
      // Branches
      prisma.branch.findMany({
        where: { updatedAt: { gte: lastSync } },
        orderBy: { updatedAt: 'desc' },
      }),
      
      // Users (limited fields for security)
      prisma.user.findMany({
        where: { updatedAt: { gte: lastSync } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branchId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      
      // Medicines with stock > 0
      prisma.medicine.findMany({
        where: {
          AND: [
            { updatedAt: { gte: lastSync } },
            { quantity: { gt: 0 } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      }),
      
      // Customers
      prisma.customer.findMany({
        where: { updatedAt: { gte: lastSync } },
        orderBy: { updatedAt: 'desc' },
      }),
      
      // Suppliers
      prisma.supplier.findMany({
        where: { updatedAt: { gte: lastSync } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        branches,
        users,
        medicines,
        customers,
        suppliers,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sync data' },
      { status: 500 }
    );
  }
}

// POST - Upload offline changes to cloud
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sales = [], customers = [] } = body;

    const results = {
      salesSynced: 0,
      customersSynced: 0,
      errors: [] as string[],
    };

    // Sync offline sales to cloud
    for (const sale of sales) {
      try {
        // Check if sale already exists (by invoiceNumber)
        const existingSale = await prisma.sale.findFirst({
          where: { invoiceNumber: sale.invoiceNumber },
        });

        if (!existingSale) {
          // Create sale in cloud database
          await prisma.$transaction(async (tx: PrismaTransactionClient) => {
            // Create sale record
            const newSale = await tx.sale.create({
              data: {
                invoiceNumber: sale.invoiceNumber,
                subtotal: sale.subtotal,
                discount: sale.discount || 0,
                loyaltyPointsUsed: sale.loyaltyPointsUsed || 0,
                loyaltyPointsEarned: sale.loyaltyPointsEarned || 0,
                total: sale.total,
                paymentMethod: sale.paymentMethod,
                paymentStatus: sale.paymentStatus || 'PAID',
                notes: sale.notes,
                customerId: sale.customerId,
                customerName: sale.customerName,
                customerPhone: sale.customerPhone,
                soldBy: sale.soldBy || sale.userId,
                branchId: sale.branchId,
                createdAt: new Date(sale.createdAt),
              },
            });

            // Create sale items
            for (const item of sale.items || []) {
              await tx.saleItem.create({
                data: {
                  saleId: newSale.id,
                  medicineId: item.medicineId,
                  medicineName: item.medicineName || 'Unknown',
                  batchNumber: item.batchNumber || 'N/A',
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                },
              });

              // Update medicine stock in cloud
              await tx.medicine.update({
                where: { id: item.medicineId },
                data: {
                  quantity: { decrement: item.quantity },
                },
              });
            }
          });

          results.salesSynced++;
        }
      } catch (error: any) {
        results.errors.push(`Sale ${sale.invoiceNumber}: ${error.message}`);
      }
    }

    // Sync new customers to cloud
    for (const customer of customers) {
      try {
        // Check if customer exists by phone or email
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            OR: [
              { phone: customer.phone },
              { email: customer.email || undefined },
            ],
          },
        });

        if (!existingCustomer) {
          await prisma.customer.create({
            data: {
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              loyaltyPoints: customer.loyaltyPoints || 0,
              creditLimit: customer.creditLimit || 0,
              creditBalance: customer.creditBalance || 0,
            },
          });
          results.customersSynced++;
        }
      } catch (error: any) {
        results.errors.push(`Customer ${customer.name}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Sync API] Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload sync data' },
      { status: 500 }
    );
  }
}
