import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Parser } from "json2csv";

export const dynamic = "force-dynamic";

// GET - Export purchase orders data to CSV
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const format = searchParams.get("format") || "csv";
    const branchId = session.user.role === "ADMIN" 
      ? searchParams.get("branchId") || undefined
      : session.user.branchId;

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Date range is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      createdAt: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        items: true,
        supplier: true,
        branch: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Flatten purchase order data for export
    const exportData = purchaseOrders.flatMap((po) =>
      po.items.map((item) => ({
        Date: new Date(po.createdAt).toLocaleDateString(),
        PONumber: po.poNumber,
        Branch: po.branch?.name || "N/A",
        Supplier: po.supplier.name,
        SupplierContact: po.supplier.contactPerson || "",
        SupplierPhone: po.supplier.phone || "",
        MedicineName: item.medicineName,
        GenericName: item.genericName || "",
        Category: item.category || "",
        Quantity: item.quantity,
        ReceivedQty: item.receivedQty,
        UnitCost: item.unitCost.toFixed(2),
        Total: item.total.toFixed(2),
        Status: po.status,
        Subtotal: po.subtotal.toFixed(2),
        Tax: po.tax.toFixed(2),
        GrandTotal: po.total.toFixed(2),
        ExpectedDate: po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : "",
      }))
    );

    // Log export history
    const fileName = `purchases_export_${dateFrom}_to_${dateTo}.${format}`;
    await prisma.exportHistory.create({
      data: {
        exportType: "PURCHASES",
        format: format.toUpperCase(),
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        recordCount: exportData.length,
        fileName,
        exportedBy: session.user.id,
        branchId: branchId || null,
      },
    });

    if (format === "csv") {
      // Define fields for CSV to handle empty data
      const fields = [
        "Date",
        "PONumber",
        "Branch",
        "Supplier",
        "SupplierContact",
        "SupplierPhone",
        "MedicineName",
        "GenericName",
        "Category",
        "Quantity",
        "ReceivedQty",
        "UnitCost",
        "Total",
        "Status",
        "Subtotal",
        "Tax",
        "GrandTotal",
        "ExpectedDate",
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
    console.error("Error exporting purchases:", error);
    return NextResponse.json(
      { error: "Failed to export purchase data" },
      { status: 500 }
    );
  }
}
