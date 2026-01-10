import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - List all branches with pagination/search
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

    // If all=true, return all active branches for dropdowns
    if (all) {
      const branches = await prisma.branch.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ isMainBranch: "desc" }, { name: "asc" }],
      });
      return NextResponse.json({ branches });
    }

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { users: true },
          },
        },
        orderBy: [{ isMainBranch: "desc" }, { createdAt: "desc" }],
      }),
      prisma.branch.count({ where }),
    ]);

    return NextResponse.json({
      branches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

// POST - Create new branch
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can create branches
    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, address, phone, email, isMainBranch } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existingBranch = await prisma.branch.findUnique({
      where: { code },
    });

    if (existingBranch) {
      return NextResponse.json(
        { error: "Branch code already exists" },
        { status: 400 }
      );
    }

    // If this is main branch, unset other main branches
    if (isMainBranch) {
      await prisma.branch.updateMany({
        where: { isMainBranch: true },
        data: { isMainBranch: false },
      });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        code: code.toUpperCase(),
        address,
        phone,
        email,
        isMainBranch: isMainBranch || false,
      },
    });

    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    console.error("Error creating branch:", error);
    return NextResponse.json(
      { error: "Failed to create branch" },
      { status: 500 }
    );
  }
}
