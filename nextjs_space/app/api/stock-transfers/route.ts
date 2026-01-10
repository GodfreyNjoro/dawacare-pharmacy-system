import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Generate unique transfer number
function generateTransferNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `TRF-${dateStr}-${random}`;
}

// GET - Fetch stock transfers with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view stock transfers
    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.transferNumber = { contains: search, mode: "insensitive" };
    }

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          fromBranch: { select: { id: true, name: true, code: true } },
          toBranch: { select: { id: true, name: true, code: true } },
          items: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return NextResponse.json({
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching stock transfers:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock transfers" },
      { status: 500 }
    );
  }
}

// POST - Create a new stock transfer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can create stock transfers
    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { fromBranchId, toBranchId, items, notes } = body;

    if (!fromBranchId || !toBranchId) {
      return NextResponse.json(
        { error: "Source and destination branches are required" },
        { status: 400 }
      );
    }

    if (fromBranchId === toBranchId) {
      return NextResponse.json(
        { error: "Source and destination branches must be different" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Validate stock availability
    for (const item of items) {
      const medicine = await prisma.medicine.findFirst({
        where: {
          id: item.medicineId,
          branchId: fromBranchId,
        },
      });

      if (!medicine) {
        return NextResponse.json(
          { error: `Medicine ${item.medicineName} not found in source branch` },
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

    // Create transfer
    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNumber: generateTransferNumber(),
        fromBranchId,
        toBranchId,
        status: "PENDING",
        notes: notes || null,
        createdBy: session.user?.email || null,
        items: {
          create: items.map((item: { medicineId: string; medicineName: string; batchNumber: string; quantity: number; unitPrice: number }) => ({
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    console.error("Error creating stock transfer:", error);
    return NextResponse.json(
      { error: "Failed to create stock transfer" },
      { status: 500 }
    );
  }
}
