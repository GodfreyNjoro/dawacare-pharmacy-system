import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Fetch single account mapping
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const mapping = await prisma.accountMapping.findUnique({
      where: { id },
    });

    if (!mapping) {
      return NextResponse.json(
        { error: "Account mapping not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("Error fetching account mapping:", error);
    return NextResponse.json(
      { error: "Failed to fetch account mapping" },
      { status: 500 }
    );
  }
}

// PUT - Update account mapping
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      accountType,
      accountCode,
      accountName,
      description,
      tallyLedger,
      sageLedger,
      isActive,
    } = body;

    const mapping = await prisma.accountMapping.update({
      where: { id },
      data: {
        ...(accountType && { accountType }),
        ...(accountCode && { accountCode }),
        ...(accountName && { accountName }),
        ...(description !== undefined && { description }),
        ...(tallyLedger !== undefined && { tallyLedger }),
        ...(sageLedger !== undefined && { sageLedger }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("Error updating account mapping:", error);
    return NextResponse.json(
      { error: "Failed to update account mapping" },
      { status: 500 }
    );
  }
}

// DELETE - Delete account mapping
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.accountMapping.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete account mapping" },
      { status: 500 }
    );
  }
}
