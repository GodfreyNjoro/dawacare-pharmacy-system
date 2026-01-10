import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Fetch suppliers with pagination and filters
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
    const all = searchParams.get("all") === "true";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (all) {
      // Return all suppliers (for dropdowns)
      const suppliers = await prisma.supplier.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ suppliers });
    }

    const [suppliers, totalCount] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({
      suppliers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

// POST - Create a new supplier
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, contactPerson, email, phone, address } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Supplier name is required" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}

// PUT - Update a supplier
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, contactPerson, email, phone, address, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Supplier ID is required" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactPerson,
        email,
        phone,
        address,
        status,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Error updating supplier:", error);
    return NextResponse.json(
      { error: "Failed to update supplier" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a supplier
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Supplier ID is required" },
        { status: 400 }
      );
    }

    // Check if supplier has any purchase orders
    const poCount = await prisma.purchaseOrder.count({
      where: { supplierId: id },
    });

    if (poCount > 0) {
      // Soft delete - set status to INACTIVE
      await prisma.supplier.update({
        where: { id },
        data: { status: "INACTIVE" },
      });
      return NextResponse.json({ message: "Supplier deactivated" });
    }

    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ message: "Supplier deleted" });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500 }
    );
  }
}
