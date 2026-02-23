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

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const stockStatus = searchParams.get("stockStatus"); // all, low, out, expiring

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (category && category !== "all") {
      where.category = category;
    }

    const medicines = await prisma.medicine.findMany({
      where,
      orderBy: { name: "asc" },
    });

    // Type definition based on query result
    type MedicineType = typeof medicines[number];

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Categorize medicines
    let filteredMedicines = medicines.map((med: MedicineType) => {
      const isLowStock = med.quantity <= med.reorderLevel && med.quantity > 0;
      const isOutOfStock = med.quantity === 0;
      const isExpiringSoon = new Date(med.expiryDate) <= thirtyDaysFromNow && new Date(med.expiryDate) > now;
      const isExpired = new Date(med.expiryDate) <= now;

      return {
        ...med,
        minStockLevel: med.reorderLevel,
        sellingPrice: med.unitPrice,
        isLowStock,
        isOutOfStock,
        isExpiringSoon,
        isExpired,
        status: isExpired
          ? "expired"
          : isOutOfStock
          ? "out_of_stock"
          : isExpiringSoon
          ? "expiring_soon"
          : isLowStock
          ? "low_stock"
          : "normal",
      };
    });

    // Apply stock status filter
    type FilteredMedicine = typeof filteredMedicines[number];
    if (stockStatus && stockStatus !== "all") {
      filteredMedicines = filteredMedicines.filter((med: FilteredMedicine) => {
        switch (stockStatus) {
          case "low":
            return med.isLowStock;
          case "out":
            return med.isOutOfStock;
          case "expiring":
            return med.isExpiringSoon;
          case "expired":
            return med.isExpired;
          default:
            return true;
        }
      });
    }

    // Get all categories
    const categories = await prisma.medicine.groupBy({
      by: ["category"],
      _count: true,
    });

    // Summary statistics
    const totalProducts = medicines.length;
    const totalValue = medicines.reduce((sum: number, med: MedicineType) => sum + med.quantity * med.unitPrice, 0);
    const lowStockCount = medicines.filter((med: MedicineType) => med.quantity <= med.reorderLevel && med.quantity > 0).length;
    const outOfStockCount = medicines.filter((med: MedicineType) => med.quantity === 0).length;
    const expiringSoonCount = medicines.filter((med: MedicineType) => {
      const expiry = new Date(med.expiryDate);
      return expiry <= thirtyDaysFromNow && expiry > now;
    }).length;
    const expiredCount = medicines.filter((med: MedicineType) => new Date(med.expiryDate) <= now).length;

    // Stock by category
    const stockByCategory = categories.map((cat: { category: string; _count: number }) => {
      const categoryMeds = medicines.filter((med: MedicineType) => med.category === cat.category);
      return {
        category: cat.category,
        count: cat._count,
        totalQuantity: categoryMeds.reduce((sum: number, med: MedicineType) => sum + med.quantity, 0),
        totalValue: categoryMeds.reduce((sum: number, med: MedicineType) => sum + med.quantity * med.unitPrice, 0),
      };
    });

    return NextResponse.json({
      summary: {
        totalProducts,
        totalValue,
        lowStockCount,
        outOfStockCount,
        expiringSoonCount,
        expiredCount,
      },
      medicines: filteredMedicines,
      stockByCategory,
      categories: categories.map((c: { category: string }) => c.category),
    });
  } catch (error) {
    console.error("Error fetching stock report:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock report" },
      { status: 500 }
    );
  }
}
