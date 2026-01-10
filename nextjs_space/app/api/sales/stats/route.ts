import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get sales statistics
    const [todaySales, weekSales, monthSales, totalSales] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: weekStart } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        _sum: { total: true },
        _count: true,
      }),
    ]);

    // Get recent sales
    const recentSales = await prisma.sale.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    // Get top selling medicines (this month)
    const topSellingRaw = await prisma.saleItem.groupBy({
      by: ["medicineId", "medicineName"],
      where: {
        sale: {
          createdAt: { gte: monthStart },
        },
      },
      _sum: {
        quantity: true,
        total: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    const topSelling = topSellingRaw.map((item: { medicineId: string; medicineName: string; _sum: { quantity: number | null; total: number | null } }) => ({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      totalQuantity: item._sum.quantity || 0,
      totalRevenue: item._sum.total || 0,
    }));

    // Payment method breakdown (this month)
    const paymentBreakdown = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: { createdAt: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    });

    return NextResponse.json({
      today: {
        total: todaySales._sum.total || 0,
        count: todaySales._count,
      },
      week: {
        total: weekSales._sum.total || 0,
        count: weekSales._count,
      },
      month: {
        total: monthSales._sum.total || 0,
        count: monthSales._count,
      },
      allTime: {
        total: totalSales._sum.total || 0,
        count: totalSales._count,
      },
      recentSales,
      topSelling,
      paymentBreakdown: paymentBreakdown.map((p: { paymentMethod: string; _sum: { total: number | null }; _count: number }) => ({
        method: p.paymentMethod,
        total: p._sum.total || 0,
        count: p._count,
      })),
    });
  } catch (error) {
    console.error("Error fetching sales stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales stats" },
      { status: 500 }
    );
  }
}
