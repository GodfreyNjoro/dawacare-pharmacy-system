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
    const branchId = searchParams.get("branchId");
    const allBranches = searchParams.get("allBranches") === "true";

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

    // Branch filtering
    const isAdmin = session.user?.role === "ADMIN";
    if (!allBranches || !isAdmin) {
      const targetBranchId = branchId || session.user?.branchId;
      if (targetBranchId) {
        where.branchId = targetBranchId;
      }
    }

    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: true,
          branch: {
            select: { id: true, name: true, code: true },
          },
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

// Loyalty points: 1 point per 100 KES spent
const POINTS_RATE = 100;
// Points value: 1 point = 1 KES
const POINTS_VALUE = 1;

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
      customerId,
      customerName,
      customerPhone,
      discount = 0,
      loyaltyPointsUsed = 0,
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

    // Validate customer if customerId provided
    type CustomerType = { id: string; name: string; phone: string; loyaltyPoints: number; creditBalance: number; creditLimit: number } | null;
    let customer: CustomerType = null;
    if (customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 400 }
        );
      }

      // Validate loyalty points if being used
      if (loyaltyPointsUsed > 0 && loyaltyPointsUsed > customer.loyaltyPoints) {
        return NextResponse.json(
          { error: "Insufficient loyalty points" },
          { status: 400 }
        );
      }
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

    // Calculate points discount
    const pointsDiscount = loyaltyPointsUsed * POINTS_VALUE;
    const total = Math.max(0, subtotal - discount - pointsDiscount);

    // Calculate points to earn (based on final total)
    const pointsToEarn = customer ? Math.floor(total / POINTS_RATE) : 0;

    // Validate credit purchase
    if (paymentMethod === "CREDIT") {
      if (!customer) {
        return NextResponse.json(
          { error: "Customer is required for credit purchases" },
          { status: 400 }
        );
      }
      const availableCredit = customer.creditLimit - customer.creditBalance;
      if (availableCredit < total) {
        return NextResponse.json(
          { error: "Insufficient credit limit" },
          { status: 400 }
        );
      }
    }

    // Create sale with items and update inventory in a transaction
    const sale = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          customerId: customerId || null,
          customerName: customer?.name || customerName || null,
          customerPhone: customer?.phone || customerPhone || null,
          subtotal,
          discount,
          loyaltyPointsUsed,
          loyaltyPointsEarned: pointsToEarn,
          total,
          paymentMethod,
          paymentStatus: paymentMethod === "CREDIT" ? "PENDING" : "PAID",
          notes: notes || null,
          soldBy: session.user?.name || session.user?.email || "Unknown",
          branchId: session.user?.branchId || null,
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

      // Handle customer loyalty and credit if customer exists
      if (customer && customerId) {
        // Update loyalty points (deduct used, add earned)
        const netPointsChange = pointsToEarn - loyaltyPointsUsed;
        
        await tx.customer.update({
          where: { id: customerId },
          data: {
            loyaltyPoints: {
              increment: netPointsChange,
            },
            // If credit purchase, increase credit balance
            ...(paymentMethod === "CREDIT" && {
              creditBalance: {
                increment: total,
              },
            }),
          },
        });

        // Record loyalty point transactions
        if (loyaltyPointsUsed > 0) {
          await tx.loyaltyTransaction.create({
            data: {
              customerId,
              type: "REDEEM",
              points: -loyaltyPointsUsed,
              saleId: newSale.id,
              description: `Redeemed for sale ${newSale.invoiceNumber}`,
            },
          });
        }

        if (pointsToEarn > 0) {
          await tx.loyaltyTransaction.create({
            data: {
              customerId,
              type: "EARN",
              points: pointsToEarn,
              saleId: newSale.id,
              description: `Earned from sale ${newSale.invoiceNumber}`,
            },
          });
        }

        // Record credit transaction if credit purchase
        if (paymentMethod === "CREDIT") {
          await tx.creditTransaction.create({
            data: {
              customerId,
              type: "CREDIT",
              amount: total,
              saleId: newSale.id,
              description: `Credit purchase - ${newSale.invoiceNumber}`,
              createdBy: session.user?.email || undefined,
            },
          });
        }
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
