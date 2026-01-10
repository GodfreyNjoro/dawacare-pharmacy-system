import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Generate unique PO number
function generatePONumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `PO-${dateStr}-${random}`;
}

// GET - Fetch purchase orders with pagination and filters
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
    const status = searchParams.get("status") || "";
    const supplierId = searchParams.get("supplierId") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: "insensitive" } },
        { supplier: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [orders, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: true,
          grns: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}

// POST - Create a new purchase order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { supplierId, items, notes, expectedDate, tax = 0 } = body;

    if (!supplierId) {
      return NextResponse.json(
        { error: "Supplier is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitCost: number }) =>
        sum + item.quantity * item.unitCost,
      0
    );
    const total = subtotal + tax;

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber: generatePONumber(),
        supplierId,
        subtotal,
        tax,
        total,
        notes: notes || null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        createdBy: session.user?.name || session.user?.email || "Unknown",
        items: {
          create: items.map(
            (item: {
              medicineName: string;
              genericName?: string;
              quantity: number;
              unitCost: number;
              category?: string;
            }) => ({
              medicineName: item.medicineName,
              genericName: item.genericName || null,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: item.quantity * item.unitCost,
              category: item.category || null,
            })
          ),
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    return NextResponse.json(purchaseOrder, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to create purchase order" },
      { status: 500 }
    );
  }
}
