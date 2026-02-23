import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Get current balance and history for a specific medicine
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicineId');
    
    if (!medicineId) {
      return NextResponse.json({ error: 'Medicine ID is required' }, { status: 400 });
    }
    
    // Get medicine details
    const medicine = await prisma.medicine.findUnique({
      where: { id: medicineId },
      include: {
        branch: {
          select: { name: true, code: true }
        }
      }
    });
    
    if (!medicine) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
    }
    
    if (!medicine.isControlled) {
      return NextResponse.json(
        { error: 'This medicine is not classified as a controlled substance' },
        { status: 400 }
      );
    }
    
    // Get all register entries for this medicine
    const entries = await prisma.controlledSubstanceRegister.findMany({
      where: { medicineId },
      orderBy: { transactionDate: 'desc' }
    });
    
    // Calculate current balance from register (should match medicine.quantity)
    const lastEntry = entries[0];
    const registerBalance = lastEntry?.balanceAfter ?? medicine.quantity;
    
    // Summary calculations
    const totalIn = entries.reduce((sum: number, e: { quantityIn: number }) => sum + e.quantityIn, 0);
    const totalOut = entries.reduce((sum: number, e: { quantityOut: number }) => sum + e.quantityOut, 0);
    
    // Get entries by transaction type
    const byType = entries.reduce((acc: Record<string, { count: number; in: number; out: number }>, entry: { transactionType: string; quantityIn: number; quantityOut: number }) => {
      const type = entry.transactionType;
      if (!acc[type]) {
        acc[type] = { count: 0, in: 0, out: 0 };
      }
      acc[type].count++;
      acc[type].in += entry.quantityIn;
      acc[type].out += entry.quantityOut;
      return acc;
    }, {} as Record<string, { count: number; in: number; out: number }>);
    
    return NextResponse.json({
      medicine: {
        id: medicine.id,
        name: medicine.name,
        genericName: medicine.genericName,
        batchNumber: medicine.batchNumber,
        scheduleClass: medicine.scheduleClass,
        inventoryQuantity: medicine.quantity,
        registerBalance,
        branch: medicine.branch
      },
      summary: {
        totalIn,
        totalOut,
        totalEntries: entries.length,
        byType
      },
      entries
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
