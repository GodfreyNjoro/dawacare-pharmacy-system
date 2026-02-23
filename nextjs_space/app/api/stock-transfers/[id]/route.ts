import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma, PrismaTransactionClient } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET - Fetch a single stock transfer
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Stock transfer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transfer });
  } catch (error) {
    console.error("Error fetching stock transfer:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock transfer" },
      { status: 500 }
    );
  }
}

// PUT - Update stock transfer status (complete or cancel)
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status } = body;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Stock transfer not found" },
        { status: 404 }
      );
    }

    if (transfer.status !== "PENDING" && transfer.status !== "IN_TRANSIT") {
      return NextResponse.json(
        { error: "Cannot update a completed or cancelled transfer" },
        { status: 400 }
      );
    }

    if (status === "COMPLETED") {
      // Complete the transfer: deduct from source, add to destination
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        for (const item of transfer.items) {
          // Find source medicine and deduct
          const sourceMedicine = await tx.medicine.findFirst({
            where: {
              id: item.medicineId,
              branchId: transfer.fromBranchId,
            },
          });

          if (!sourceMedicine || sourceMedicine.quantity < item.quantity) {
            throw new Error(
              `Insufficient stock for ${item.medicineName} in source branch`
            );
          }

          await tx.medicine.update({
            where: { id: sourceMedicine.id },
            data: {
              quantity: { decrement: item.quantity },
            },
          });

          // Find or create destination medicine
          const destMedicine = await tx.medicine.findFirst({
            where: {
              name: item.medicineName,
              batchNumber: item.batchNumber,
              branchId: transfer.toBranchId,
            },
          });

          if (destMedicine) {
            // Update existing
            await tx.medicine.update({
              where: { id: destMedicine.id },
              data: {
                quantity: { increment: item.quantity },
              },
            });
          } else {
            // Create new medicine in destination branch
            await tx.medicine.create({
              data: {
                name: sourceMedicine.name,
                genericName: sourceMedicine.genericName,
                manufacturer: sourceMedicine.manufacturer,
                batchNumber: item.batchNumber,
                expiryDate: sourceMedicine.expiryDate,
                quantity: item.quantity,
                reorderLevel: sourceMedicine.reorderLevel,
                unitPrice: item.unitPrice,
                category: sourceMedicine.category,
                branchId: transfer.toBranchId,
              },
            });
          }
        }

        // Update transfer status
        await tx.stockTransfer.update({
          where: { id },
          data: {
            status: "COMPLETED",
            completedBy: session.user?.email || null,
            completedAt: new Date(),
          },
        });
      });
    } else if (status === "IN_TRANSIT") {
      await prisma.stockTransfer.update({
        where: { id },
        data: { status: "IN_TRANSIT" },
      });
    } else if (status === "CANCELLED") {
      await prisma.stockTransfer.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const updatedTransfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });

    return NextResponse.json({ transfer: updatedTransfer });
  } catch (error) {
    console.error("Error updating stock transfer:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update stock transfer" },
      { status: 500 }
    );
  }
}
