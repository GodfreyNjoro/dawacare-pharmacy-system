import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Generate unique GRN number
function generateGRNNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `GRN-${dateStr}-${random}`;
}

// GET - Fetch GRNs with pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const purchaseOrderId = searchParams.get("purchaseOrderId") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { grnNumber: { contains: search, mode: "insensitive" } },
        { purchaseOrder: { poNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId;
    }

    const [grns, totalCount] = await Promise.all([
      prisma.goodsReceivedNote.findMany({
        where,
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
            },
          },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.goodsReceivedNote.count({ where }),
    ]);

    return NextResponse.json({
      grns,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching GRNs:", error);
    return NextResponse.json(
      { error: "Failed to fetch GRNs" },
      { status: 500 }
    );
  }
}

// POST - Create a new GRN and update inventory
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { purchaseOrderId, items, notes, addToInventory = true } = body;

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "Purchase order ID is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Get the purchase order
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: true },
    });

    if (!po) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Create GRN and update inventory in a transaction
    const grn = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the GRN
      const newGrn = await tx.goodsReceivedNote.create({
        data: {
          grnNumber: generateGRNNumber(),
          purchaseOrderId,
          receivedBy: session.user?.name || session.user?.email || "Unknown",
          notes: notes || null,
          items: {
            create: items.map(
              (item: {
                medicineName: string;
                batchNumber: string;
                expiryDate: string;
                quantityReceived: number;
                unitCost: number;
              }) => ({
                medicineName: item.medicineName,
                batchNumber: item.batchNumber,
                expiryDate: new Date(item.expiryDate),
                quantityReceived: item.quantityReceived,
                unitCost: item.unitCost,
                total: item.quantityReceived * item.unitCost,
                addedToInventory: addToInventory,
              })
            ),
          },
        },
        include: {
          items: true,
          purchaseOrder: {
            include: { supplier: true },
          },
        },
      });

      // Update PO item received quantities
      type POItemType = typeof po.items[number];
      for (const item of items) {
        const poItem = po.items.find(
          (pi: POItemType) => pi.medicineName === item.medicineName
        );
        if (poItem) {
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              receivedQty: {
                increment: item.quantityReceived,
              },
            },
          });
        }
      }

      // Add to inventory if requested
      if (addToInventory) {
        for (const item of items) {
          // Check if medicine exists with same batch number
          const existingMedicine = await tx.medicine.findFirst({
            where: {
              name: item.medicineName,
              batchNumber: item.batchNumber,
            },
          });

          if (existingMedicine) {
            // Update quantity
            await tx.medicine.update({
              where: { id: existingMedicine.id },
              data: {
                quantity: {
                  increment: item.quantityReceived,
                },
              },
            });
          } else {
            // Create new medicine entry
            const poItem = po.items.find(
              (pi: POItemType) => pi.medicineName === item.medicineName
            );
            await tx.medicine.create({
              data: {
                name: item.medicineName,
                genericName: poItem?.genericName || null,
                batchNumber: item.batchNumber,
                expiryDate: new Date(item.expiryDate),
                quantity: item.quantityReceived,
                unitPrice: item.unitCost * 1.3, // 30% markup
                category: poItem?.category || "General",
                reorderLevel: 10,
              },
            });
          }
        }
      }

      // Check if all items are fully received
      const updatedPO = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: true },
      });

      if (updatedPO) {
        type UpdatedPOItemType = typeof updatedPO.items[number];
        const allReceived = updatedPO.items.every(
          (item: UpdatedPOItemType) => item.receivedQty >= item.quantity
        );
        const partiallyReceived = updatedPO.items.some(
          (item: UpdatedPOItemType) => item.receivedQty > 0
        );

        let newStatus = updatedPO.status;
        if (allReceived) {
          newStatus = "RECEIVED";
        } else if (partiallyReceived) {
          newStatus = "PARTIAL";
        }

        if (newStatus !== updatedPO.status) {
          await tx.purchaseOrder.update({
            where: { id: purchaseOrderId },
            data: { status: newStatus },
          });
        }
      }

      return newGrn;
    });

    return NextResponse.json(grn, { status: 201 });
  } catch (error) {
    console.error("Error creating GRN:", error);
    return NextResponse.json(
      { error: "Failed to create GRN" },
      { status: 500 }
    );
  }
}
