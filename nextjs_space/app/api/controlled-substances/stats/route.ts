import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;
    
    // Get all controlled medicines with current balances
    const controlledMedicines = await prisma.medicine.findMany({
      where: {
        isControlled: true,
        ...(branchId ? { branchId } : {})
      },
      select: {
        id: true,
        name: true,
        genericName: true,
        batchNumber: true,
        scheduleClass: true,
        quantity: true,
        expiryDate: true,
        branch: {
          select: { name: true, code: true }
        }
      }
    });
    
    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTransactions = await prisma.controlledSubstanceRegister.count({
      where: {
        transactionDate: { gte: today },
        ...(branchId ? { branchId } : {})
      }
    });
    
    // Get this month's transactions
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthTransactions = await prisma.controlledSubstanceRegister.count({
      where: {
        transactionDate: { gte: monthStart },
        ...(branchId ? { branchId } : {})
      }
    });
    
    // Get pending verifications
    const pendingVerifications = await prisma.controlledSubstanceRegister.count({
      where: {
        verifiedBy: null,
        ...(branchId ? { branchId } : {})
      }
    });
    
    // Get transaction breakdown by type (this month)
    const transactionsByType = await prisma.controlledSubstanceRegister.groupBy({
      by: ['transactionType'],
      where: {
        transactionDate: { gte: monthStart },
        ...(branchId ? { branchId } : {})
      },
      _count: true
    });
    
    // Get medicines by schedule class
    const bySchedule = await prisma.medicine.groupBy({
      by: ['scheduleClass'],
      where: {
        isControlled: true,
        scheduleClass: { not: null },
        ...(branchId ? { branchId } : {})
      },
      _count: true,
      _sum: {
        quantity: true
      }
    });
    
    // Get low stock controlled substances (below reorder level)
    const lowStock = await prisma.medicine.findMany({
      where: {
        isControlled: true,
        quantity: {
          lte: prisma.medicine.fields.reorderLevel
        },
        ...(branchId ? { branchId } : {})
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        reorderLevel: true,
        scheduleClass: true
      }
    });
    
    // Get recent entries
    const recentEntries = await prisma.controlledSubstanceRegister.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        medicine: {
          select: { name: true, scheduleClass: true }
        }
      }
    });
    
    return NextResponse.json({
      summary: {
        totalControlledMedicines: controlledMedicines.length,
        todayTransactions,
        monthTransactions,
        pendingVerifications
      },
      controlledMedicines,
      transactionsByType: transactionsByType.map((t: { transactionType: string; _count: number }) => ({
        type: t.transactionType,
        count: t._count
      })),
      bySchedule: bySchedule.map((s: { scheduleClass: string | null; _count: number; _sum: { quantity: number | null } }) => ({
        schedule: s.scheduleClass,
        count: s._count,
        totalQuantity: s._sum.quantity || 0
      })),
      lowStock,
      recentEntries
    });
  } catch (error) {
    console.error('Error fetching controlled substance stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
