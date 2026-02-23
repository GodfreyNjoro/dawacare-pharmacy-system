export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Total medicines
    const totalMedicines = await prisma.medicine.count();

    // Low stock items
    const lowStockItems = await prisma.medicine.findMany({
      where: {
        quantity: {
          lte: prisma.medicine.fields.reorderLevel,
        },
      },
    });

    // Using raw query for low stock count since Prisma doesn't support field comparison directly
    const lowStockCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Medicine" WHERE quantity <= "reorderLevel"
    `;

    // Expiring within 30 days
    const expiringItems = await prisma.medicine.findMany({
      where: {
        expiryDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: {
        expiryDate: "asc",
      },
    });

    // Total inventory value
    const medicines = await prisma.medicine.findMany();
    const totalInventoryValue = medicines.reduce(
      (sum: number, med: { quantity: number; unitPrice: number }) => sum + med.quantity * med.unitPrice,
      0
    );

    // Low stock medicines list
    const lowStockMedicines = await prisma.$queryRaw<{
      id: string;
      name: string;
      quantity: number;
      reorderLevel: number;
      category: string;
    }[]>`
      SELECT id, name, quantity, "reorderLevel", category 
      FROM "Medicine" 
      WHERE quantity <= "reorderLevel"
      ORDER BY quantity ASC
      LIMIT 10
    `;

    // Recent activity (recently updated medicines)
    const recentActivity = await prisma.medicine.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    });

    // Categories with counts
    const categoryStats = await prisma.medicine.groupBy({
      by: ["category"],
      _count: {
        _all: true,
      },
    });

    return NextResponse.json({
      totalMedicines,
      lowStockCount: Number(lowStockCount?.[0]?.count ?? 0),
      expiringCount: expiringItems?.length ?? 0,
      totalInventoryValue,
      lowStockMedicines: lowStockMedicines ?? [],
      expiringItems: expiringItems ?? [],
      recentActivity: recentActivity ?? [],
      categoryStats: categoryStats ?? [],
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
