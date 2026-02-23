import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Parser } from "json2csv";

export const dynamic = "force-dynamic";

// GET - Export sales data to CSV
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

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            medicine: true,
          },
        },
        customer: true,
        branch: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Flatten sales data for export
    type SaleWithRelations = typeof sales[number];
    type SaleItemType = SaleWithRelations['items'][number];
    const exportData = sales.flatMap((sale: SaleWithRelations) =>
      sale.items.map((item: SaleItemType) => ({
        Date: new Date(sale.createdAt).toLocaleDateString(),
        Time: new Date(sale.createdAt).toLocaleTimeString(),
        InvoiceNumber: sale.invoiceNumber,
        Branch: sale.branch?.name || "N/A",
        CustomerName: sale.customer?.name || sale.customerName || "Walk-in",
        CustomerPhone: sale.customer?.phone || sale.customerPhone || "",
        MedicineName: item.medicine?.name || item.medicineName,
        BatchNumber: item.medicine?.batchNumber || "",
        Quantity: item.quantity,
        UnitPrice: item.unitPrice.toFixed(2),
        Total: item.total.toFixed(2),
        PaymentMethod: sale.paymentMethod,
        Subtotal: sale.subtotal.toFixed(2),
        Discount: sale.discount.toFixed(2),
        GrandTotal: sale.total.toFixed(2),
      }))
    );

    // Log export history
    const fileName = `sales_export_${dateFrom}_to_${dateTo}.${format}`;
    await prisma.exportHistory.create({
      data: {
        exportType: "SALES",
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
        "Time",
        "InvoiceNumber",
        "Branch",
        "CustomerName",
        "CustomerPhone",
        "MedicineName",
        "BatchNumber",
        "Quantity",
        "UnitPrice",
        "Total",
        "PaymentMethod",
        "Subtotal",
        "Discount",
        "GrandTotal",
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
    console.error("Error exporting sales:", error);
    return NextResponse.json(
      { error: "Failed to export sales data" },
      { status: 500 }
    );
  }
}
