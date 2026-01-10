import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET - Get single branch with details
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ branch });
  } catch (error) {
    console.error("Error fetching branch:", error);
    return NextResponse.json(
      { error: "Failed to fetch branch" },
      { status: 500 }
    );
  }
}

// PUT - Update branch
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, code, address, phone, email, status, isMainBranch } = body;

    // Check if branch exists
    const existingBranch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!existingBranch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    // If code changed, check it's unique
    if (code && code !== existingBranch.code) {
      const codeExists = await prisma.branch.findUnique({
        where: { code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Branch code already exists" },
          { status: 400 }
        );
      }
    }

    // If setting as main branch, unset others
    if (isMainBranch && !existingBranch.isMainBranch) {
      await prisma.branch.updateMany({
        where: { isMainBranch: true },
        data: { isMainBranch: false },
      });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(status && { status }),
        ...(isMainBranch !== undefined && { isMainBranch }),
      },
    });

    return NextResponse.json({ branch });
  } catch (error) {
    console.error("Error updating branch:", error);
    return NextResponse.json(
      { error: "Failed to update branch" },
      { status: 500 }
    );
  }
}

// DELETE - Delete branch (soft delete if has users)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    // Cannot delete main branch
    if (branch.isMainBranch) {
      return NextResponse.json(
        { error: "Cannot delete main branch" },
        { status: 400 }
      );
    }

    // If has users, soft delete
    if (branch._count.users > 0) {
      await prisma.branch.update({
        where: { id },
        data: { status: "INACTIVE" },
      });
      return NextResponse.json({
        message: "Branch deactivated (has assigned users)",
        softDelete: true,
      });
    }

    // Hard delete if no users
    await prisma.branch.delete({ where: { id } });

    return NextResponse.json({ message: "Branch deleted successfully" });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return NextResponse.json(
      { error: "Failed to delete branch" },
      { status: 500 }
    );
  }
}
