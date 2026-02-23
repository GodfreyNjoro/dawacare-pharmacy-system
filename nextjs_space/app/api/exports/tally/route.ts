import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Export data in Tally XML format
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
    accountMappings.forEach((m: { accountType: string; tallyLedger: string | null }) => {
      if (m.tallyLedger) {
        mappings[m.accountType] = m.tallyLedger;
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

    // Generate Tally XML format
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ENVELOPE>\n';
    xml += '  <HEADER>\n';
    xml += '    <TALLYREQUEST>Import Data</TALLYREQUEST>\n';
    xml += '  </HEADER>\n';
    xml += '  <BODY>\n';
    xml += '    <IMPORTDATA>\n';
    xml += '      <REQUESTDESC>\n';
    xml += '        <REPORTNAME>Vouchers</REPORTNAME>\n';
    xml += '      </REQUESTDESC>\n';
    xml += '      <REQUESTDATA>\n';

    type SaleWithRelations = typeof sales[number];
    sales.forEach((sale: SaleWithRelations) => {
      xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n';
      xml += '          <VOUCHER VCHTYPE="Sales" ACTION="Create">\n';
      xml += `            <DATE>${new Date(sale.createdAt).toISOString().split("T")[0].split("-").reverse().join("")}</DATE>\n`;
      xml += `            <VOUCHERNUMBER>${sale.invoiceNumber}</VOUCHERNUMBER>\n`;
      xml += `            <PARTYLEDGERNAME>${sale.customer?.name || "Cash Sales"}</PARTYLEDGERNAME>\n`;
      xml += `            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n`;
      xml += '            <ALLLEDGERENTRIES.LIST>\n';
      xml += `              <LEDGERNAME>${mappings["SALES_REVENUE"] || "Sales Revenue"}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>-${sale.subtotal.toFixed(2)}</AMOUNT>\n`;
      xml += '            </ALLLEDGERENTRIES.LIST>\n';
      
      
      xml += '            <ALLLEDGERENTRIES.LIST>\n';
      xml += `              <LEDGERNAME>${sale.customer?.name || "Cash"}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${sale.total.toFixed(2)}</AMOUNT>\n`;
      xml += '            </ALLLEDGERENTRIES.LIST>\n';
      xml += '          </VOUCHER>\n';
      xml += '        </TALLYMESSAGE>\n';
    });

    xml += '      </REQUESTDATA>\n';
    xml += '    </IMPORTDATA>\n';
    xml += '  </BODY>\n';
    xml += '</ENVELOPE>';

    // Log export history
    const fileName = `tally_export_${dateFrom}_to_${dateTo}.xml`;
    await prisma.exportHistory.create({
      data: {
        exportType: "TALLY",
        format: "XML",
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        recordCount: sales.length,
        fileName,
        exportedBy: session.user.id,
        branchId: branchId || null,
      },
    });

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting to Tally:", error);
    return NextResponse.json(
      { error: "Failed to export Tally data" },
      { status: 500 }
    );
  }
}