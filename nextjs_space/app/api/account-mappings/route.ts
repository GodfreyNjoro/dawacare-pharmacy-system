import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Fetch all account mappings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view account mappings
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get("accountType") || "";
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = {};

    if (accountType) {
      where.accountType = accountType;
    }

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }

    const mappings = await prisma.accountMapping.findMany({
      where,
      orderBy: { accountType: "asc" },
    });

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Error fetching account mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch account mappings" },
      { status: 500 }
    );
  }
}

// POST - Create new account mapping
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can create account mappings
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      accountType,
      accountCode,
      accountName,
      description,
      tallyLedger,
      sageLedger,
    } = body;

    if (!accountType || !accountCode || !accountName) {
      return NextResponse.json(
        { error: "Account type, code, and name are required" },
        { status: 400 }
      );
    }

    const mapping = await prisma.accountMapping.create({
      data: {
        accountType,
        accountCode,
        accountName,
        description: description || null,
        tallyLedger: tallyLedger || null,
        sageLedger: sageLedger || null,
      },
    });

    return NextResponse.json({ mapping }, { status: 201 });
  } catch (error) {
    console.error("Error creating account mapping:", error);
    return NextResponse.json(
      { error: "Failed to create account mapping" },
      { status: 500 }
    );
  }
}
