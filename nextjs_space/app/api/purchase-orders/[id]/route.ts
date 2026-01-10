import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Fetch a single purchase order by ID
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: true,
        grns: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 }
    );
  }
}

// PUT - Update purchase order status
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status } = body;

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: {
        supplier: true,
        items: true,
      },
    });

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to update purchase order" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a purchase order (only if DRAFT)
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { grns: true },
    });

    if (!po) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    if (po.grns.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete PO with received goods" },
        { status: 400 }
      );
    }

    if (po.status !== "DRAFT" && po.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Can only delete DRAFT or CANCELLED orders" },
        { status: 400 }
      );
    }

    await prisma.purchaseOrder.delete({ where: { id } });
    return NextResponse.json({ message: "Purchase order deleted" });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase order" },
      { status: 500 }
    );
  }
}
