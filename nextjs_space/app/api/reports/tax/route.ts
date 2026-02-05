import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Set date range
    const dateFrom = from ? new Date(from) : new Date(new Date().setDate(1)); // First of month
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    // Fetch tax settings to get the VAT rate
    const taxSettings = await prisma.appSettings.findMany({
      where: { category: 'tax' },
    });
    
    const settingsObj: Record<string, string> = {};
    taxSettings.forEach((s) => (settingsObj[s.key] = s.value));
    const vatEnabled = settingsObj.vat_enabled !== 'false';
    const vatRate = parseFloat(settingsObj.standard_vat_rate || '16');

    // Fetch sales within date range
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            medicine: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate tax for each sale
    // In Kenya, most pharmaceutical products are VAT exempt
    // For now, we'll assume all medicines are exempt unless explicitly marked
    let totalSales = 0;
    let taxableSales = 0;
    let exemptSales = 0;
    let totalVat = 0;

    const salesWithTax = sales.map((sale) => {
      // Calculate VAT based on items
      // For simplicity, we'll treat the entire sale as either taxable or exempt
      // based on whether VAT is enabled in settings
      const saleTotal = sale.total;
      totalSales += saleTotal;

      // Calculate VAT if enabled
      // Using VAT-inclusive calculation: VAT = Total * (Rate / (100 + Rate))
      let vatAmount = 0;
      const isExempt = !vatEnabled; // For now, depends on VAT enabled setting
      
      if (vatEnabled && !isExempt) {
        // VAT-inclusive calculation
        vatAmount = saleTotal * (vatRate / (100 + vatRate));
        taxableSales += saleTotal;
        totalVat += vatAmount;
      } else {
        exemptSales += saleTotal;
      }

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber || `INV-${sale.id.slice(0, 8).toUpperCase()}`,
        createdAt: sale.createdAt.toISOString(),
        total: saleTotal,
        vatAmount: vatAmount,
        isExempt: isExempt,
        customerName: sale.customer?.name || 'Walk-in Customer',
        paymentMethod: sale.paymentMethod || 'CASH',
      };
    });

    return NextResponse.json({
      summary: {
        totalSales,
        taxableSales,
        exemptSales,
        totalVat,
        salesCount: sales.length,
        vatRate,
        vatEnabled,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
      sales: salesWithTax,
    });
  } catch (error) {
    console.error('Error generating tax report:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax report' },
      { status: 500 }
    );
  }
}
