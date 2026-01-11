import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Fetch export history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const exportType = searchParams.get("exportType") || "";
    const branchId = session.user.role === "ADMIN" 
      ? searchParams.get("branchId") || undefined
      : session.user.branchId;

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (exportType) {
      where.exportType = exportType;
    }

    if (branchId) {
      where.branchId = branchId;
    }

    const [history, total] = await Promise.all([
      prisma.exportHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          branch: true,
        },
      }),
      prisma.exportHistory.count({ where }),
    ]);

    return NextResponse.json({
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching export history:", error);
    return NextResponse.json(
      { error: "Failed to fetch export history" },
      { status: 500 }
    );
  }
}
