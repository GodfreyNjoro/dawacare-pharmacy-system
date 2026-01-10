import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Sale, SaleItem } from "@prisma/client";

type SaleWithItems = Sale & { items: SaleItem[] };

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const groupBy = searchParams.get("groupBy") || "day"; // day, week, month
    const branchId = searchParams.get("branchId");
    const allBranches = searchParams.get("allBranches") === "true";

    const whereFilter: { createdAt?: { gte?: Date; lte?: Date }; branchId?: string } = {};
    if (startDate) {
      whereFilter.createdAt = { ...whereFilter.createdAt, gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereFilter.createdAt = { ...whereFilter.createdAt, lte: end };
    }

    // Branch filtering - admins can view all branches with allBranches=true
    const isAdmin = session.user?.role === "ADMIN";
    if (!allBranches || !isAdmin) {
      const targetBranchId = branchId || session.user?.branchId;
      if (targetBranchId) {
        whereFilter.branchId = targetBranchId;
      }
    }

    // Get all sales in the date range
    const sales = await prisma.sale.findMany({
      where: whereFilter,
      include: {
        items: true,
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate by period
    const salesByPeriod: Record<string, { revenue: number; transactions: number; items: number }> = {};
    
    sales.forEach((sale: SaleWithItems) => {
      const date = new Date(sale.createdAt);
      let periodKey: string;
      
      if (groupBy === "month") {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (groupBy === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split("T")[0];
      } else {
        periodKey = date.toISOString().split("T")[0];
      }
      
      if (!salesByPeriod[periodKey]) {
        salesByPeriod[periodKey] = { revenue: 0, transactions: 0, items: 0 };
      }
      
      salesByPeriod[periodKey].revenue += sale.total;
      salesByPeriod[periodKey].transactions += 1;
      salesByPeriod[periodKey].items += sale.items.reduce((sum: number, item: SaleItem) => sum + item.quantity, 0);
    });

    // Payment method breakdown
    const paymentBreakdown = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: whereFilter,
      _sum: { total: true },
      _count: true,
    });

    // Summary statistics
    const totalRevenue = sales.reduce((sum: number, sale: SaleWithItems) => sum + sale.total, 0);
    const totalTransactions = sales.length;
    const totalItems = sales.reduce(
      (sum: number, sale: SaleWithItems) => sum + sale.items.reduce((itemSum: number, item: SaleItem) => itemSum + item.quantity, 0),
      0
    );
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Convert to array for chart
    const chartData = Object.entries(salesByPeriod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({
        period,
        revenue: data.revenue,
        transactions: data.transactions,
        items: data.items,
      }));

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalTransactions,
        totalItems,
        averageTransaction,
      },
      chartData,
      paymentBreakdown: paymentBreakdown.map((p: { paymentMethod: string; _sum: { total: number | null }; _count: number }) => ({
        method: p.paymentMethod,
        total: p._sum.total || 0,
        count: p._count,
      })),
      sales: sales.slice(0, 100), // Limit raw data
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales report" },
      { status: 500 }
    );
  }
}
