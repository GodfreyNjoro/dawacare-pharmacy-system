import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// POST - Record credit payment
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
    const { amount, description } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
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

    // Check if payment exceeds balance
    if (amount > customer.creditBalance) {
      return NextResponse.json(
        { error: "Payment amount exceeds credit balance" },
        { status: 400 }
      );
    }

    // Update balance and create transaction
    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id },
        data: {
          creditBalance: { decrement: amount },
        },
      }),
      prisma.creditTransaction.create({
        data: {
          customerId: id,
          type: "PAYMENT",
          amount: -amount,
          description: description || "Credit payment received",
          createdBy: session.user?.email || undefined,
        },
      }),
    ]);

    return NextResponse.json({ customer: updatedCustomer });
  } catch (error) {
    console.error("Error recording credit payment:", error);
    return NextResponse.json(
      { error: "Failed to record credit payment" },
      { status: 500 }
    );
  }
}
