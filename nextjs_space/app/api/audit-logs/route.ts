export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Fetch audit logs with pagination and filters (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view audit logs
    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const action = searchParams.get("action") || "";
    const entityType = searchParams.get("entityType") || "";
    const severity = searchParams.get("severity") || "";
    const userId = searchParams.get("userId") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
        { entityName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (severity) {
      where.severity = severity;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Parse JSON fields for display
    const parsedLogs = logs.map((log: { previousValues: string | null; newValues: string | null; changedFields: string | null; [key: string]: unknown }) => ({
      ...log,
      previousValues: log.previousValues ? JSON.parse(log.previousValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
      changedFields: log.changedFields ? JSON.parse(log.changedFields) : null,
    }));

    return NextResponse.json({
      logs: parsedLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}

// GET stats for audit dashboard
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { statsType } = body;

    if (statsType === "summary") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today);
      thisWeek.setDate(thisWeek.getDate() - 7);

      const [todayCount, weekCount, criticalCount, byAction, byEntity] = await Promise.all([
        prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: thisWeek } } }),
        prisma.auditLog.count({ where: { severity: "CRITICAL" } }),
        prisma.auditLog.groupBy({
          by: ["action"],
          _count: true,
          orderBy: { _count: { action: "desc" } },
          take: 10,
        }),
        prisma.auditLog.groupBy({
          by: ["entityType"],
          _count: true,
          orderBy: { _count: { entityType: "desc" } },
          take: 10,
        }),
      ]);

      return NextResponse.json({
        todayCount,
        weekCount,
        criticalCount,
        byAction: byAction.map((a: { action: string; _count: number }) => ({ action: a.action, count: a._count })),
        byEntity: byEntity.map((e: { entityType: string; _count: number }) => ({ entityType: e.entityType, count: e._count })),
      });
    }

    return NextResponse.json({ error: "Invalid stats type" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching audit stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit stats" },
      { status: 500 }
    );
  }
}
