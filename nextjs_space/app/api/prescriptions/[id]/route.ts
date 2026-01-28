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

// GET - Get single prescription with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        prescriber: true,
        customer: true,
        branch: true,
        items: {
          include: {
            dispensings: {
              include: {
                dispensing: true,
              },
            },
          },
        },
        dispensings: {
          include: {
            items: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    return NextResponse.json({ prescription });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    return NextResponse.json({ error: 'Failed to fetch prescription' }, { status: 500 });
  }
}

// PUT - Update prescription (only if not yet dispensed)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.prescription.findUnique({
      where: { id },
      include: { dispensings: true, items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    // Only allow updates if not yet dispensed
    if (existing.dispensings.length > 0 && existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot modify prescription after dispensing has started' },
        { status: 400 }
      );
    }

    // Extract updateable fields
    const {
      patientName,
      patientPhone,
      patientAge,
      patientGender,
      patientAddress,
      diagnosis,
      priority,
      expiryDate,
      refillsAllowed,
      prescriptionNotes,
      pharmacistNotes,
      status,
    } = body;

    const prescription = await prisma.prescription.update({
      where: { id },
      data: {
        patientName,
        patientPhone,
        patientAge,
        patientGender,
        patientAddress,
        diagnosis,
        priority,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        refillsAllowed,
        prescriptionNotes,
        pharmacistNotes,
        status,
      },
      include: {
        prescriber: true,
        items: true,
      },
    });

    // Audit log
    await createAuditLog({
      user: getAuditUser(session),
      action: 'UPDATE',
      entityType: 'PRESCRIPTION',
      entityId: prescription.id,
      entityName: prescription.prescriptionNumber,
      previousValues: existing as unknown as Record<string, unknown>,
      newValues: prescription as unknown as Record<string, unknown>,
      description: `Updated prescription ${prescription.prescriptionNumber}`,
      severity: status === 'CANCELLED' ? 'WARNING' : 'INFO',
    });

    return NextResponse.json({ prescription });
  } catch (error) {
    console.error('Error updating prescription:', error);
    return NextResponse.json({ error: 'Failed to update prescription' }, { status: 500 });
  }
}

// DELETE - Cancel prescription
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.prescription.findUnique({
      where: { id },
      include: { dispensings: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    // Cannot delete if any items have been dispensed
    if (existing.dispensings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete prescription with dispensing history. Cancel it instead.' },
        { status: 400 }
      );
    }

    // Soft delete by setting status to CANCELLED
    await prisma.prescription.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Audit log
    await createAuditLog({
      user: getAuditUser(session),
      action: 'DELETE',
      entityType: 'PRESCRIPTION',
      entityId: id,
      entityName: existing.prescriptionNumber,
      previousValues: existing as unknown as Record<string, unknown>,
      description: `Cancelled prescription ${existing.prescriptionNumber}`,
      severity: 'WARNING',
    });

    return NextResponse.json({ message: 'Prescription cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling prescription:', error);
    return NextResponse.json({ error: 'Failed to cancel prescription' }, { status: 500 });
  }
}
