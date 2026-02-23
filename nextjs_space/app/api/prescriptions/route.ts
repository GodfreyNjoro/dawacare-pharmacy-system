import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createAuditLog, AuditUser } from '@/lib/audit-logger';

function getAuditUser(session: { user?: { id?: string; name?: string | null; email?: string | null; role?: string } }): AuditUser {
  return {
    id: session.user?.id || 'unknown',
    name: session.user?.name || 'Unknown',
    email: session.user?.email || 'unknown',
    role: session.user?.role || 'UNKNOWN',
  };
}

// Generate prescription number
function generatePrescriptionNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RX-${dateStr}-${random}`;
}

// GET - List prescriptions with search/filter
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const prescriberId = searchParams.get('prescriberId') || '';
    const customerId = searchParams.get('customerId') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const pendingOnly = searchParams.get('pendingOnly') === 'true';

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { prescriptionNumber: { contains: search, mode: 'insensitive' } },
        { patientName: { contains: search, mode: 'insensitive' } },
        { patientPhone: { contains: search, mode: 'insensitive' } },
        { prescriber: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    if (status) {
      where.status = status;
    }
    
    if (pendingOnly) {
      where.status = { in: ['PENDING', 'PARTIAL'] };
    }
    
    if (prescriberId) {
      where.prescriberId = prescriberId;
    }
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    if (fromDate || toDate) {
      where.issueDate = {};
      if (fromDate) {
        (where.issueDate as Record<string, Date>).gte = new Date(fromDate);
      }
      if (toDate) {
        (where.issueDate as Record<string, Date>).lte = new Date(toDate);
      }
    }

    const [prescriptions, total, stats] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          prescriber: {
            select: {
              id: true,
              name: true,
              registrationNumber: true,
              facility: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          items: true,
          _count: {
            select: { dispensings: true },
          },
        },
      }),
      prisma.prescription.count({ where }),
      // Get stats
      prisma.prescription.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // Transform stats
    const statusCounts = stats.reduce((acc: Record<string, number>, item: { status: string; _count: { id: number } }) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    return NextResponse.json({
      prescriptions,
      stats: statusCounts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 });
  }
}

// POST - Create new prescription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      prescriberId,
      customerId,
      patientName,
      patientPhone,
      patientAge,
      patientGender,
      patientAddress,
      diagnosis,
      priority,
      issueDate,
      expiryDate,
      refillsAllowed,
      prescriptionNotes,
      branchId,
      items,
    } = body;

    // Validation
    if (!prescriberId) {
      return NextResponse.json({ error: 'Prescriber is required' }, { status: 400 });
    }
    if (!patientName) {
      return NextResponse.json({ error: 'Patient name is required' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one medicine item is required' }, { status: 400 });
    }
    if (!expiryDate) {
      return NextResponse.json({ error: 'Prescription expiry date is required' }, { status: 400 });
    }

    // Verify prescriber exists
    const prescriber = await prisma.prescriber.findUnique({ where: { id: prescriberId } });
    if (!prescriber) {
      return NextResponse.json({ error: 'Invalid prescriber' }, { status: 400 });
    }

    // Generate prescription number
    let prescriptionNumber = generatePrescriptionNumber();
    // Ensure uniqueness
    let exists = await prisma.prescription.findUnique({ where: { prescriptionNumber } });
    while (exists) {
      prescriptionNumber = generatePrescriptionNumber();
      exists = await prisma.prescription.findUnique({ where: { prescriptionNumber } });
    }

    // Create prescription with items
    const prescription = await prisma.prescription.create({
      data: {
        prescriptionNumber,
        prescriberId,
        customerId: customerId || null,
        patientName,
        patientPhone,
        patientAge: patientAge ? parseInt(patientAge) : null,
        patientGender,
        patientAddress,
        diagnosis,
        priority: priority || 'NORMAL',
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        expiryDate: new Date(expiryDate),
        refillsAllowed: refillsAllowed || 0,
        prescriptionNotes,
        receivedBy: session.user?.name || 'Unknown',
        branchId: branchId || null,
        items: {
          create: items.map((item: {
            medicineName: string;
            genericName?: string;
            strength?: string;
            dosageForm?: string;
            quantityPrescribed: number;
            dosage: string;
            frequency: string;
            duration?: string;
            route?: string;
            instructions?: string;
            substitutionAllowed?: boolean;
            isControlled?: boolean;
            scheduleClass?: string;
          }) => ({
            medicineName: item.medicineName,
            genericName: item.genericName || null,
            strength: item.strength || null,
            dosageForm: item.dosageForm || null,
            quantityPrescribed: item.quantityPrescribed,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration || null,
            route: item.route || null,
            instructions: item.instructions || null,
            substitutionAllowed: item.substitutionAllowed !== false,
            isControlled: item.isControlled || false,
            scheduleClass: item.scheduleClass || null,
          })),
        },
      },
      include: {
        prescriber: true,
        customer: true,
        items: true,
      },
    });

    // Audit log
    await createAuditLog({
      user: getAuditUser(session),
      action: 'CREATE',
      entityType: 'PRESCRIPTION',
      entityId: prescription.id,
      entityName: prescription.prescriptionNumber,
      newValues: {
        prescriptionNumber: prescription.prescriptionNumber,
        patientName: prescription.patientName,
        prescriber: prescriber.name,
        itemCount: items.length,
        hasControlled: items.some((i: { isControlled?: boolean }) => i.isControlled),
      },
      description: `Created prescription ${prescription.prescriptionNumber} for ${patientName}`,
      severity: items.some((i: { isControlled?: boolean }) => i.isControlled) ? 'WARNING' : 'INFO',
    });

    return NextResponse.json({ prescription }, { status: 201 });
  } catch (error) {
    console.error('Error creating prescription:', error);
    return NextResponse.json({ error: 'Failed to create prescription' }, { status: 500 });
  }
}
