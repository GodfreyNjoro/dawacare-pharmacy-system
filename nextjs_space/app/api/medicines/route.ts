export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { auditMedicineChange, getAuditUserFromSession } from "@/lib/audit-logger";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category") ?? "";
    const sortBy = searchParams.get("sortBy") ?? "name";
    const sortOrder = searchParams.get("sortOrder") ?? "asc";
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const branchId = searchParams.get("branchId");
    const allBranches = searchParams.get("allBranches") === "true";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { genericName: { contains: search, mode: "insensitive" } },
        { batchNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category && category !== "all") {
      where.category = category;
    }

    // Branch filtering: admins can see all branches if allBranches=true
    // Otherwise filter by specific branchId or user's branch
    const isAdmin = session.user?.role === "ADMIN";
    if (!allBranches || !isAdmin) {
      const targetBranchId = branchId || session.user?.branchId;
      if (targetBranchId) {
        where.branchId = targetBranchId;
      }
    }

    const total = await prisma.medicine.count({ where });

    const medicines = await prisma.medicine.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      medicines,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching medicines:", error);
    return NextResponse.json(
      { error: "Failed to fetch medicines" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      genericName,
      manufacturer,
      batchNumber,
      expiryDate,
      quantity,
      reorderLevel,
      unitPrice,
      category,
      branchId,
    } = body ?? {};

    // Validation
    if (!name || !batchNumber || !expiryDate || quantity === undefined || !unitPrice || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const expiry = new Date(expiryDate);
    if (expiry <= new Date()) {
      return NextResponse.json(
        { error: "Expiry date must be in the future" },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: "Quantity must be positive" },
        { status: 400 }
      );
    }

    if (unitPrice <= 0) {
      return NextResponse.json(
        { error: "Unit price must be positive" },
        { status: 400 }
      );
    }

    // Use provided branchId or default to user's branch
    const targetBranchId = branchId || session.user?.branchId;

    const medicine = await prisma.medicine.create({
      data: {
        name,
        genericName: genericName ?? null,
        manufacturer: manufacturer ?? null,
        batchNumber,
        expiryDate: expiry,
        quantity: parseInt(quantity.toString()),
        reorderLevel: reorderLevel ? parseInt(reorderLevel.toString()) : 10,
        unitPrice: parseFloat(unitPrice.toString()),
        category,
        branchId: targetBranchId || null,
      },
    });

    // Audit log for medicine creation
    const auditUser = getAuditUserFromSession(session);
    if (auditUser) {
      await auditMedicineChange(
        auditUser,
        'CREATE',
        medicine.id,
        medicine.name,
        undefined,
        {
          name: medicine.name,
          batchNumber: medicine.batchNumber,
          quantity: medicine.quantity,
          unitPrice: medicine.unitPrice,
          category: medicine.category,
          expiryDate: medicine.expiryDate,
        },
        `Added new medicine: ${medicine.name} (Batch: ${medicine.batchNumber}, Qty: ${medicine.quantity})`
      );
    }

    return NextResponse.json(medicine, { status: 201 });
  } catch (error) {
    console.error("Error creating medicine:", error);
    return NextResponse.json(
      { error: "Failed to create medicine" },
      { status: 500 }
    );
  }
}
