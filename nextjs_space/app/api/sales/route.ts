import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Generate unique invoice number
function generateInvoiceNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `INV-${dateStr}-${random}`;
}

// GET - Fetch sales with pagination and filters
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
    const paymentMethod = searchParams.get("paymentMethod") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }

    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({
      sales,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales" },
      { status: 500 }
    );
  }
}

// POST - Create a new sale
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      items,
      customerName,
      customerPhone,
      discount = 0,
      paymentMethod,
      notes,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 }
      );
    }

    // Validate stock availability
    for (const item of items) {
      const medicine = await prisma.medicine.findUnique({
        where: { id: item.medicineId },
      });

      if (!medicine) {
        return NextResponse.json(
          { error: `Medicine not found: ${item.medicineId}` },
          { status: 400 }
        );
      }

      if (medicine.quantity < item.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}`,
          },
          { status: 400 }
        );
      }
    }

    // Calculate totals
    let subtotal = 0;
    const saleItems: Array<{
      medicineId: string;
      medicineName: string;
      batchNumber: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }> = [];

    for (const item of items) {
      const medicine = await prisma.medicine.findUnique({
        where: { id: item.medicineId },
      });

      if (medicine) {
        const itemTotal = medicine.unitPrice * item.quantity;
        subtotal += itemTotal;
        saleItems.push({
          medicineId: medicine.id,
          medicineName: medicine.name,
          batchNumber: medicine.batchNumber,
          quantity: item.quantity,
          unitPrice: medicine.unitPrice,
          total: itemTotal,
        });
      }
    }

    const total = subtotal - discount;

    // Create sale with items and update inventory in a transaction
    const sale = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          subtotal,
          discount,
          total,
          paymentMethod,
          notes: notes || null,
          soldBy: session.user?.name || session.user?.email || "Unknown",
          items: {
            create: saleItems,
          },
        },
        include: {
          items: true,
        },
      });

      // Update inventory
      for (const item of items) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newSale;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("Error creating sale:", error);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500 }
    );
  }
}
