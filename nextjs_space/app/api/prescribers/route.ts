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

// GET - List prescribers with search/filter
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const councilType = searchParams.get('councilType') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const all = searchParams.get('all') === 'true';

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { facility: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (status) {
      where.status = status;
    }
    
    if (councilType) {
      where.councilType = councilType;
    }

    // Return all active prescribers for dropdowns
    if (all) {
      const prescribers = await prisma.prescriber.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          registrationNumber: true,
          councilType: true,
          facility: true,
          specialization: true,
        },
      });
      return NextResponse.json({ prescribers });
    }

    const [prescribers, total] = await Promise.all([
      prisma.prescriber.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { prescriptions: true },
          },
        },
      }),
      prisma.prescriber.count({ where }),
    ]);

    return NextResponse.json({
      prescribers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching prescribers:', error);
    return NextResponse.json({ error: 'Failed to fetch prescribers' }, { status: 500 });
  }
}

// POST - Create new prescriber
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      registrationNumber,
      councilType,
      specialization,
      facility,
      facilityAddress,
      phone,
      email,
      notes,
    } = body;

    // Validation
    if (!name || !registrationNumber || !councilType) {
      return NextResponse.json(
        { error: 'Name, registration number, and council type are required' },
        { status: 400 }
      );
    }

    // Check for duplicate registration number
    const existing = await prisma.prescriber.findUnique({
      where: { registrationNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A prescriber with this registration number already exists' },
        { status: 400 }
      );
    }

    const prescriber = await prisma.prescriber.create({
      data: {
        name,
        registrationNumber,
        councilType,
        specialization,
        facility,
        facilityAddress,
        phone,
        email,
        notes,
      },
    });

    // Audit log
    await createAuditLog({
      user: getAuditUser(session),
      action: 'CREATE',
      entityType: 'PRESCRIBER',
      entityId: prescriber.id,
      entityName: `${prescriber.name} (${prescriber.registrationNumber})`,
      newValues: prescriber as unknown as Record<string, unknown>,
      description: `Created prescriber: ${prescriber.name}`,
      severity: 'INFO',
    });

    return NextResponse.json({ prescriber }, { status: 201 });
  } catch (error) {
    console.error('Error creating prescriber:', error);
    return NextResponse.json({ error: 'Failed to create prescriber' }, { status: 500 });
  }
}

// PUT - Update prescriber
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Prescriber ID is required' }, { status: 400 });
    }

    const existing = await prisma.prescriber.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Prescriber not found' }, { status: 404 });
    }

    // Check for duplicate registration number if changed
    if (updateData.registrationNumber && updateData.registrationNumber !== existing.registrationNumber) {
      const duplicate = await prisma.prescriber.findUnique({
        where: { registrationNumber: updateData.registrationNumber },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A prescriber with this registration number already exists' },
          { status: 400 }
        );
      }
    }

    const prescriber = await prisma.prescriber.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await createAuditLog({
      user: getAuditUser(session),
      action: 'UPDATE',
      entityType: 'PRESCRIBER',
      entityId: prescriber.id,
      entityName: `${prescriber.name} (${prescriber.registrationNumber})`,
      previousValues: existing as unknown as Record<string, unknown>,
      newValues: prescriber as unknown as Record<string, unknown>,
      description: `Updated prescriber: ${prescriber.name}`,
      severity: 'INFO',
    });

    return NextResponse.json({ prescriber });
  } catch (error) {
    console.error('Error updating prescriber:', error);
    return NextResponse.json({ error: 'Failed to update prescriber' }, { status: 500 });
  }
}

// DELETE - Delete or deactivate prescriber
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Prescriber ID is required' }, { status: 400 });
    }

    const existing = await prisma.prescriber.findUnique({
      where: { id },
      include: { _count: { select: { prescriptions: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prescriber not found' }, { status: 404 });
    }

    // Soft delete if has prescriptions, hard delete otherwise
    if (existing._count.prescriptions > 0) {
      await prisma.prescriber.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });

      await createAuditLog({
        user: getAuditUser(session),
        action: 'UPDATE',
        entityType: 'PRESCRIBER',
        entityId: id,
        entityName: `${existing.name} (${existing.registrationNumber})`,
        description: `Deactivated prescriber: ${existing.name} (has ${existing._count.prescriptions} prescriptions)`,
        severity: 'WARNING',
      });

      return NextResponse.json({ message: 'Prescriber deactivated (has associated prescriptions)' });
    } else {
      await prisma.prescriber.delete({ where: { id } });

      await createAuditLog({
        user: getAuditUser(session),
        action: 'DELETE',
        entityType: 'PRESCRIBER',
        entityId: id,
        entityName: `${existing.name} (${existing.registrationNumber})`,
        previousValues: existing as unknown as Record<string, unknown>,
        description: `Deleted prescriber: ${existing.name}`,
        severity: 'WARNING',
      });

      return NextResponse.json({ message: 'Prescriber deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting prescriber:', error);
    return NextResponse.json({ error: 'Failed to delete prescriber' }, { status: 500 });
  }
}
