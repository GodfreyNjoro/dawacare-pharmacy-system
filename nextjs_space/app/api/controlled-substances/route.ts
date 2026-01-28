import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Generate entry number: CSR-BRANCHCODE-YYYY-XXXXX
async function generateEntryNumber(branchCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CSR-${branchCode || 'MAIN'}-${year}-`;
  
  const lastEntry = await prisma.controlledSubstanceRegister.findFirst({
    where: {
      entryNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      entryNumber: 'desc'
    }
  });
  
  let nextNumber = 1;
  if (lastEntry) {
    const lastNumber = parseInt(lastEntry.entryNumber.split('-').pop() || '0');
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
}

// GET - Fetch controlled substance register entries
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const scheduleClass = searchParams.get('scheduleClass') || '';
    const transactionType = searchParams.get('transactionType') || '';
    const medicineId = searchParams.get('medicineId') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const branchId = searchParams.get('branchId') || '';
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { medicineName: { contains: search, mode: 'insensitive' } },
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { patientName: { contains: search, mode: 'insensitive' } },
        { batchNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (scheduleClass) {
      where.scheduleClass = scheduleClass;
    }
    
    if (transactionType) {
      where.transactionType = transactionType;
    }
    
    if (medicineId) {
      where.medicineId = medicineId;
    }
    
    if (branchId) {
      where.branchId = branchId;
    }
    
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) {
        (where.transactionDate as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (where.transactionDate as Record<string, Date>).lte = endDate;
      }
    }
    
    const [entries, total] = await Promise.all([
      prisma.controlledSubstanceRegister.findMany({
        where,
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              quantity: true,
              scheduleClass: true
            }
          }
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit
      }),
      prisma.controlledSubstanceRegister.count({ where })
    ]);
    
    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching controlled substance register:', error);
    return NextResponse.json({ error: 'Failed to fetch register' }, { status: 500 });
  }
}

// POST - Create a new register entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only ADMIN or PHARMACIST can record controlled substance entries
    const userRole = (session.user as { role?: string }).role || 'CASHIER';
    if (!['ADMIN', 'PHARMACIST'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Only pharmacists or administrators can record controlled substance entries' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const {
      medicineId,
      transactionType,
      quantityIn = 0,
      quantityOut = 0,
      referenceType,
      referenceId,
      referenceNumber,
      patientName,
      patientId,
      patientAddress,
      prescriptionId,
      prescriptionNumber,
      prescriberName,
      prescriberRegNo,
      supplierName,
      supplierLicense,
      witnessName,
      witnessRole,
      destructionMethod,
      destructionCertificate,
      notes,
      branchId,
      transactionDate
    } = body;
    
    // Validate required fields
    if (!medicineId || !transactionType) {
      return NextResponse.json(
        { error: 'Medicine ID and transaction type are required' },
        { status: 400 }
      );
    }
    
    // Fetch medicine details
    const medicine = await prisma.medicine.findUnique({
      where: { id: medicineId },
      include: {
        branch: true
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
    
    // Get current balance for this medicine
    const lastEntry = await prisma.controlledSubstanceRegister.findFirst({
      where: { medicineId },
      orderBy: { createdAt: 'desc' }
    });
    
    const balanceBefore = lastEntry?.balanceAfter ?? medicine.quantity;
    const balanceAfter = balanceBefore + quantityIn - quantityOut;
    
    // Validate balance won't go negative
    if (balanceAfter < 0) {
      return NextResponse.json(
        { error: `Insufficient balance. Current: ${balanceBefore}, Attempting to dispense: ${quantityOut}` },
        { status: 400 }
      );
    }
    
    // Generate entry number
    const branchCode = medicine.branch?.code || 'MAIN';
    const entryNumber = await generateEntryNumber(branchCode);
    
    // Create the register entry
    const entry = await prisma.controlledSubstanceRegister.create({
      data: {
        entryNumber,
        medicineId,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        batchNumber: medicine.batchNumber,
        scheduleClass: medicine.scheduleClass || 'SCHEDULE_II',
        transactionType,
        quantityIn,
        quantityOut,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId,
        referenceNumber,
        patientName,
        patientId,
        patientAddress,
        prescriptionId,
        prescriptionNumber,
        prescriberName,
        prescriberRegNo,
        supplierName,
        supplierLicense,
        witnessName,
        witnessRole,
        destructionMethod,
        destructionCertificate,
        notes,
        recordedBy: session.user.id || '',
        recordedByName: session.user.name || 'Unknown',
        recordedByRole: userRole,
        branchId: branchId || medicine.branchId,
        branchName: medicine.branch?.name,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date()
      },
      include: {
        medicine: true
      }
    });
    
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating controlled substance entry:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
