import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { SaleItem, Medicine, Sale } from "@prisma/client";

type SaleItemWithRelations = SaleItem & { sale: Sale; medicine: Medicine };

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "10");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.createdAt = { ...dateFilter.createdAt, lte: end };
    }

    // Get all sale items with their sales
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: dateFilter,
      },
      include: {
        sale: true,
        medicine: true,
      },
    });

    // Aggregate by medicine
    const medicineStats: Record<
      string,
      {
        medicineId: string;
        name: string;
        category: string;
        totalQuantity: number;
        totalRevenue: number;
        transactions: number;
      }
    > = {};

    saleItems.forEach((item: SaleItemWithRelations) => {
      const key = item.medicineId;
      if (!medicineStats[key]) {
        medicineStats[key] = {
          medicineId: item.medicineId,
          name: item.medicine.name,
          category: item.medicine.category,
          totalQuantity: 0,
          totalRevenue: 0,
          transactions: 0,
        };
      }
      medicineStats[key].totalQuantity += item.quantity;
      medicineStats[key].totalRevenue += item.total; // Use 'total' instead of 'subtotal'
      medicineStats[key].transactions += 1;
    });

    // Sort and limit
    const topByQuantity = Object.values(medicineStats)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);

    const topByRevenue = Object.values(medicineStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    // Category breakdown
    const categoryStats: Record<string, { category: string; quantity: number; revenue: number }> = {};
    Object.values(medicineStats).forEach((stat) => {
      if (!categoryStats[stat.category]) {
        categoryStats[stat.category] = { category: stat.category, quantity: 0, revenue: 0 };
      }
      categoryStats[stat.category].quantity += stat.totalQuantity;
      categoryStats[stat.category].revenue += stat.totalRevenue;
    });

    const categoryBreakdown = Object.values(categoryStats)
      .sort((a, b) => b.revenue - a.revenue);

    // Summary
    const totalMedicinesSold = Object.values(medicineStats).reduce(
      (sum: number, stat: { totalQuantity: number; totalRevenue: number }) => sum + stat.totalQuantity,
      0
    );
    const totalRevenue = Object.values(medicineStats).reduce(
      (sum: number, stat: { totalQuantity: number; totalRevenue: number }) => sum + stat.totalRevenue,
      0
    );
    const uniqueMedicinesSold = Object.keys(medicineStats).length;

    return NextResponse.json({
      summary: {
        totalMedicinesSold,
        totalRevenue,
        uniqueMedicinesSold,
        topMedicine: topByQuantity[0]?.name || "N/A",
      },
      topByQuantity,
      topByRevenue,
      categoryBreakdown,
    });
  } catch (error) {
    console.error("Error fetching top sellers:", error);
    return NextResponse.json(
      { error: "Failed to fetch top sellers" },
      { status: 500 }
    );
  }
}
