import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Parser } from "json2csv";

export const dynamic = "force-dynamic";

// GET - Export inventory data to CSV
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const branchId = session.user.role === "ADMIN" 
      ? searchParams.get("branchId") || undefined
      : session.user.branchId;

    const where: Record<string, unknown> = {};

    if (branchId) {
      where.branchId = branchId;
    }

    const medicines = await prisma.medicine.findMany({
      where,
      include: {
        branch: true,
      },
      orderBy: { name: "asc" },
    });

    // Format inventory data for export
    const exportData = medicines.map((medicine) => ({
      Branch: medicine.branch?.name || "N/A",
      MedicineName: medicine.name,
      GenericName: medicine.genericName || "",
      Category: medicine.category,
      BatchNumber: medicine.batchNumber,
      Manufacturer: medicine.manufacturer || "",
      Quantity: medicine.quantity,
      ReorderLevel: medicine.reorderLevel,
      UnitPrice: medicine.unitPrice.toFixed(2),
      ExpiryDate: new Date(medicine.expiryDate).toLocaleDateString(),
      Status: medicine.quantity <= medicine.reorderLevel ? "Low Stock" : "In Stock",
      TotalValue: (medicine.quantity * medicine.unitPrice).toFixed(2),
    }));

    // Log export history
    const fileName = `inventory_export_${new Date().toISOString().split("T")[0]}.${format}`;
    await prisma.exportHistory.create({
      data: {
        exportType: "INVENTORY",
        format: format.toUpperCase(),
        dateFrom: new Date(),
        dateTo: new Date(),
        recordCount: exportData.length,
        fileName,
        exportedBy: session.user.id,
        branchId: branchId || null,
      },
    });

    if (format === "csv") {
      // Define fields for CSV to handle empty data
      const fields = [
        "Branch",
        "MedicineName",
        "GenericName",
        "Category",
        "BatchNumber",
        "Manufacturer",
        "Quantity",
        "ReorderLevel",
        "UnitPrice",
        "ExpiryDate",
        "Status",
        "TotalValue",
      ];
      
      const parser = new Parser({ fields });
      const csv = parser.parse(exportData);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } else if (format === "json") {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    console.error("Error exporting inventory:", error);
    return NextResponse.json(
      { error: "Failed to export inventory data" },
      { status: 500 }
    );
  }
}
