import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog, AuditUser } from '@/lib/audit-logger';

function getAuditUser(session: { user?: { id?: string; name?: string | null; email?: string | null; role?: string } }): AuditUser {
  return {
    id: session.user?.id || 'unknown',
    name: session.user?.name || 'Unknown',
    email: session.user?.email || 'unknown',
    role: session.user?.role || 'UNKNOWN',
  };
}

interface DispenseItem {
  prescriptionItemId: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantityDispensed: number;
  unitPrice: number;
  isSubstitution?: boolean;
}

// POST - Dispense prescription items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: prescriptionId } = await params;
    const body = await request.json();
    const {
      saleId,
      items,
      dispensingNotes,
      counselingProvided,
      verifiedBy,
    } = body;

    // Validate prescription exists and is valid for dispensing
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: true,
        prescriber: true,
      },
    });

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    // Check prescription status
    if (prescription.status === 'DISPENSED') {
      return NextResponse.json({ error: 'Prescription already fully dispensed' }, { status: 400 });
    }
    if (prescription.status === 'EXPIRED' || new Date(prescription.expiryDate) < new Date()) {
      return NextResponse.json({ error: 'Prescription has expired' }, { status: 400 });
    }
    if (prescription.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Prescription has been cancelled' }, { status: 400 });
    }

    // Check refills
    if (prescription.refillsUsed >= prescription.refillsAllowed && prescription.status === 'DISPENSED') {
      return NextResponse.json({ error: 'No refills remaining for this prescription' }, { status: 400 });
    }

    // Validate items
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item must be dispensed' }, { status: 400 });
    }

    // Validate each item
    type PrescriptionItemType = typeof prescription.items[number];
    for (const item of items as DispenseItem[]) {
      const prescriptionItem = prescription.items.find((pi: PrescriptionItemType) => pi.id === item.prescriptionItemId);
      if (!prescriptionItem) {
        return NextResponse.json(
          { error: `Invalid prescription item: ${item.prescriptionItemId}` },
          { status: 400 }
        );
      }

      const remainingQty = prescriptionItem.quantityPrescribed - prescriptionItem.quantityDispensed;
      if (item.quantityDispensed > remainingQty) {
        return NextResponse.json(
          { error: `Cannot dispense more than remaining quantity for ${prescriptionItem.medicineName}` },
          { status: 400 }
        );
      }

      // Check if substitution is allowed
      if (item.isSubstitution && !prescriptionItem.substitutionAllowed) {
        return NextResponse.json(
          { error: `Substitution not allowed for ${prescriptionItem.medicineName}` },
          { status: 400 }
        );
      }

      // Verify medicine inventory
      if (item.medicineId) {
        const medicine = await prisma.medicine.findUnique({ where: { id: item.medicineId } });
        if (!medicine || medicine.quantity < item.quantityDispensed) {
          return NextResponse.json(
            { error: `Insufficient stock for ${item.medicineName}` },
            { status: 400 }
          );
        }
      }
    }

    // Create dispensing record in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create dispensing record
      const dispensing = await tx.prescriptionDispensing.create({
        data: {
          prescriptionId,
          saleId: saleId || null,
          dispensedBy: session.user?.id || 'unknown',
          dispensedByName: session.user?.name || 'Unknown',
          verifiedBy: verifiedBy || null,
          dispensingNotes: dispensingNotes || null,
          counselingProvided: counselingProvided || false,
          items: {
            create: (items as DispenseItem[]).map(item => ({
              prescriptionItemId: item.prescriptionItemId,
              medicineId: item.medicineId || null,
              medicineName: item.medicineName,
              batchNumber: item.batchNumber,
              quantityDispensed: item.quantityDispensed,
              unitPrice: item.unitPrice,
              isSubstitution: item.isSubstitution || false,
            })),
          },
        },
        include: { items: true },
      });

      // Update prescription item quantities
      for (const item of items as DispenseItem[]) {
        await tx.prescriptionItem.update({
          where: { id: item.prescriptionItemId },
          data: {
            quantityDispensed: { increment: item.quantityDispensed },
          },
        });

        // Update medicine inventory
        if (item.medicineId) {
          await tx.medicine.update({
            where: { id: item.medicineId },
            data: {
              quantity: { decrement: item.quantityDispensed },
            },
          });
        }
      }

      // Check if all items are fully dispensed
      const updatedItems = await tx.prescriptionItem.findMany({
        where: { prescriptionId },
      });

      type UpdatedItemType = typeof updatedItems[number];
      const allDispensed = updatedItems.every(
        (item: UpdatedItemType) => item.quantityDispensed >= item.quantityPrescribed
      );
      const someDispensed = updatedItems.some(
        (item: UpdatedItemType) => item.quantityDispensed > 0
      );

      // Update prescription status
      let newStatus = prescription.status;
      if (allDispensed) {
        newStatus = 'DISPENSED';
      } else if (someDispensed) {
        newStatus = 'PARTIAL';
      }

      const updatedPrescription = await tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          status: newStatus,
          refillsUsed: allDispensed && prescription.refillsUsed < prescription.refillsAllowed
            ? { increment: 1 }
            : undefined,
        },
      });

      return { dispensing, prescription: updatedPrescription };
    });

    // Check for controlled substances
    const hasControlled = prescription.items.some((item: PrescriptionItemType) => item.isControlled);

    // Audit log
    await createAuditLog({
      user: getAuditUser(session),
      action: 'CREATE',
      entityType: 'PRESCRIPTION_DISPENSING',
      entityId: result.dispensing.id,
      entityName: prescription.prescriptionNumber,
      newValues: {
        prescriptionNumber: prescription.prescriptionNumber,
        patientName: prescription.patientName,
        prescriber: prescription.prescriber.name,
        itemsDispensed: items.length,
        saleId,
        hasControlled,
      },
      description: `Dispensed ${items.length} items from prescription ${prescription.prescriptionNumber}${hasControlled ? ' (CONTROLLED)' : ''}`,
      severity: hasControlled ? 'CRITICAL' : 'INFO',
    });

    return NextResponse.json({
      dispensing: result.dispensing,
      prescription: result.prescription,
      message: 'Items dispensed successfully',
    });
  } catch (error) {
    console.error('Error dispensing prescription:', error);
    return NextResponse.json({ error: 'Failed to dispense prescription' }, { status: 500 });
  }
}
