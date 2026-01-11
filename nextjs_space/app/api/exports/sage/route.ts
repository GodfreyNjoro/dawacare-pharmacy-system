import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Parser } from "json2csv";

export const dynamic = "force-dynamic";

// GET - Export data in Sage CSV format
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const branchId = session.user.role === "ADMIN" 
      ? searchParams.get("branchId") || undefined
      : session.user.branchId;

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Date range is required" },
        { status: 400 }
      );
    }

    // Fetch account mappings
    const accountMappings = await prisma.accountMapping.findMany({
      where: { isActive: true },
    });

    const mappings: Record<string, string> = {};
    accountMappings.forEach((m) => {
      if (m.sageLedger) {
        mappings[m.accountType] = m.sageLedger;
      }
    });

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
      },
      orderBy: { createdAt: "asc" },
    });

    // Format data for Sage (specific columns required by Sage)
    const exportData = sales.flatMap((sale) => {
      const rows = [];
      
      // Sales Revenue line
      rows.push({
        Type: "SI", // Sales Invoice
        AccountRef: sale.customer?.phone || "CASH",
        NominalCode: mappings["SALES_REVENUE"] || "4000",
        DepartmentCode: "0",
        Date: new Date(sale.createdAt).toISOString().split("T")[0],
        Reference: sale.invoiceNumber,
        Details: `Sales - ${sale.invoiceNumber}`,
        NetAmount: sale.subtotal.toFixed(2),
        TaxCode: "T1",
        TaxAmount: "0.00",
        ExchangeRate: "1.00",
        ExtraNominalCode: "",
      });

      return rows;
    });

    // Log export history
    const fileName = `sage_export_${dateFrom}_to_${dateTo}.csv`;
    await prisma.exportHistory.create({
      data: {
        exportType: "SAGE",
        format: "CSV",
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        recordCount: exportData.length,
        fileName,
        exportedBy: session.user.id,
        branchId: branchId || null,
      },
    });

    const parser = new Parser();
    const csv = parser.parse(exportData);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting to Sage:", error);
    return NextResponse.json(
      { error: "Failed to export Sage data" },
      { status: 500 }
    );
  }
}