import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Fetch single customer with purchase history
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            items: true,
          },
        },
        loyaltyTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        creditTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: {
          select: { sales: true },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Calculate total spent
    const totalSpent = await prisma.sale.aggregate({
      where: { customerId: id },
      _sum: { total: true },
    });

    return NextResponse.json({
      customer,
      stats: {
        totalSpent: totalSpent._sum.total || 0,
        totalPurchases: customer._count.sales,
      },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

// PUT - Update customer
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, phone, email, address, dateOfBirth, gender, creditLimit, status, notes } = body;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Check if phone is being changed and if it conflicts
    if (phone && phone !== existingCustomer.phone) {
      const phoneExists = await prisma.customer.findUnique({
        where: { phone },
      });
      if (phoneExists) {
        return NextResponse.json(
          { error: "A customer with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name || existingCustomer.name,
        phone: phone || existingCustomer.phone,
        email: email !== undefined ? email : existingCustomer.email,
        address: address !== undefined ? address : existingCustomer.address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingCustomer.dateOfBirth,
        gender: gender !== undefined ? gender : existingCustomer.gender,
        creditLimit: creditLimit !== undefined ? creditLimit : existingCustomer.creditLimit,
        status: status || existingCustomer.status,
        notes: notes !== undefined ? notes : existingCustomer.notes,
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete customer (set to inactive)
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Soft delete - set status to INACTIVE
    await prisma.customer.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    return NextResponse.json({ message: "Customer deactivated successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
