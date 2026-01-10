import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// POST - Adjust loyalty points manually
export async function POST(
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
    const { points, description } = body;

    if (typeof points !== "number") {
      return NextResponse.json(
        { error: "Points must be a number" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Check if deduction would make points negative
    if (customer.loyaltyPoints + points < 0) {
      return NextResponse.json(
        { error: "Insufficient loyalty points" },
        { status: 400 }
      );
    }

    // Update points and create transaction
    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id },
        data: {
          loyaltyPoints: { increment: points },
        },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          customerId: id,
          type: "ADJUST",
          points,
          description: description || "Manual adjustment",
        },
      }),
    ]);

    return NextResponse.json({ customer: updatedCustomer });
  } catch (error) {
    console.error("Error adjusting loyalty points:", error);
    return NextResponse.json(
      { error: "Failed to adjust loyalty points" },
      { status: 500 }
    );
  }
}
