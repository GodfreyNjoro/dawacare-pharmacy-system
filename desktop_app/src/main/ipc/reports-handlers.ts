import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';

interface SaleReportRow {
  period: string;
  revenue: number;
  transactions: number;
  items: number;
}

interface PaymentBreakdown {
  method: string;
  total: number;
  count: number;
}

interface StockItem {
  id: string;
  name: string;
  genericName: string | null;
  category: string | null;
  batchNumber: string | null;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  expiryDate: string | null;
  status: string;
}

interface TopSeller {
  id: string;
  name: string;
  genericName: string | null;
  category: string | null;
  totalQuantity: number;
  totalRevenue: number;
}

export function registerReportsHandlers(): void {
  console.log('[IPC] Registering reports handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Sales Report
  ipcMain.handle('getSalesReport', async (_, filters: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  } = {}) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const { startDate, endDate, groupBy = 'day' } = filters;

    try {
      let dateFilter = '';
      const params: string[] = [];

      if (startDate) {
        dateFilter += ' AND s."createdAt" >= ?';
        params.push(startDate);
      }
      if (endDate) {
        dateFilter += ' AND s."createdAt" <= ?';
        params.push(endDate + 'T23:59:59.999Z');
      }

      // Summary
      const summaryResult = await prisma.$queryRawUnsafe(
        `SELECT 
          COALESCE(SUM(s.total), 0) as "totalRevenue",
          COUNT(s.id) as "totalTransactions",
          COALESCE(SUM((SELECT COALESCE(SUM(si.quantity), 0) FROM "SaleItem" si WHERE si."saleId" = s.id)), 0) as "totalItems"
         FROM "Sale" s
         WHERE s.status = 'COMPLETED' ${dateFilter}`,
        ...params
      ) as {
        totalRevenue: number;
        totalTransactions: number;
        totalItems: number;
      }[];

      const summary = {
        totalRevenue: Number(summaryResult[0]?.totalRevenue || 0),
        totalTransactions: Number(summaryResult[0]?.totalTransactions || 0),
        totalItems: Number(summaryResult[0]?.totalItems || 0),
        averageTransaction: 0
      };
      summary.averageTransaction = summary.totalTransactions > 0 
        ? summary.totalRevenue / summary.totalTransactions 
        : 0;

      // Chart data (grouped by period)
      let dateFormat = '%Y-%m-%d';
      if (groupBy === 'week') dateFormat = '%Y-W%W';
      if (groupBy === 'month') dateFormat = '%Y-%m';

      const chartData = await prisma.$queryRawUnsafe(
        `SELECT 
          strftime('${dateFormat}', s."createdAt") as period,
          COALESCE(SUM(s.total), 0) as revenue,
          COUNT(s.id) as transactions,
          COALESCE(SUM((SELECT COALESCE(SUM(si.quantity), 0) FROM "SaleItem" si WHERE si."saleId" = s.id)), 0) as items
         FROM "Sale" s
         WHERE s.status = 'COMPLETED' ${dateFilter}
         GROUP BY strftime('${dateFormat}', s."createdAt")
         ORDER BY period ASC`,
        ...params
      );

      // Payment breakdown
      const paymentBreakdown = await prisma.$queryRawUnsafe(
        `SELECT 
          s."paymentMethod" as method,
          COALESCE(SUM(s.total), 0) as total,
          COUNT(s.id) as count
         FROM "Sale" s
         WHERE s.status = 'COMPLETED' ${dateFilter}
         GROUP BY s."paymentMethod"`,
        ...params
      );

      return {
        success: true,
        summary,
        chartData: chartData.map((r: SaleReportRow) => ({
          period: r.period,
          revenue: Number(r.revenue || 0),
          transactions: Number(r.transactions || 0),
          items: Number(r.items || 0)
        })),
        paymentBreakdown: paymentBreakdown.map((r: PaymentBreakdown) => ({
          method: r.method || 'CASH',
          total: Number(r.total || 0),
          count: Number(r.count || 0)
        }))
      };
    } catch (error) {
      console.error('[Reports] Error generating sales report:', error);
      return { success: false, error: 'Failed to generate sales report' };
    }
  });

  // Stock Report
  ipcMain.handle('getStockReport', async (_, filters: {
    status?: 'all' | 'low' | 'out' | 'expiring';
    category?: string;
    search?: string;
  } = {}) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const { status = 'all', category = '', search = '' } = filters;

    try {
      let whereClause = 'WHERE 1=1';
      const params: string[] = [];

      if (search) {
        whereClause += ' AND (m.name LIKE ? OR m."genericName" LIKE ? OR m."batchNumber" LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (category) {
        whereClause += ' AND m.category = ?';
        params.push(category);
      }

      // Status filtering
      if (status === 'low') {
        whereClause += ' AND m.quantity > 0 AND m.quantity <= m."reorderLevel"';
      } else if (status === 'out') {
        whereClause += ' AND m.quantity = 0';
      } else if (status === 'expiring') {
        whereClause += ' AND m."expiryDate" IS NOT NULL AND date(m."expiryDate") <= date("now", "+30 days")';
      }

      const items = await prisma.$queryRawUnsafe(
        `SELECT m.id, m.name, m."genericName", m.category, m."batchNumber",
                m.quantity, m."reorderLevel", m."unitPrice", m."expiryDate",
                CASE 
                  WHEN m.quantity = 0 THEN 'OUT_OF_STOCK'
                  WHEN m.quantity <= m."reorderLevel" THEN 'LOW_STOCK'
                  WHEN m."expiryDate" IS NOT NULL AND date(m."expiryDate") <= date('now', '+30 days') THEN 'EXPIRING'
                  ELSE 'IN_STOCK'
                END as status
         FROM "Medicine" m
         ${whereClause}
         ORDER BY m.quantity ASC, m.name ASC`,
        ...params
      );

      // Summary stats
      const statsResult = await prisma.$queryRawUnsafe(
        `SELECT 
          COUNT(*) as "totalItems",
          COALESCE(SUM(m.quantity * m."unitPrice"), 0) as "totalValue",
          SUM(CASE WHEN m.quantity > 0 AND m.quantity <= m."reorderLevel" THEN 1 ELSE 0 END) as "lowStockCount",
          SUM(CASE WHEN m.quantity = 0 THEN 1 ELSE 0 END) as "outOfStockCount",
          SUM(CASE WHEN m."expiryDate" IS NOT NULL AND date(m."expiryDate") <= date('now', '+30 days') THEN 1 ELSE 0 END) as "expiringCount"
         FROM "Medicine" m`
      ) as {
        totalItems: number;
        totalValue: number;
        lowStockCount: number;
        outOfStockCount: number;
        expiringCount: number;
      }[];

      // Categories
      const categories = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT category FROM "Medicine" WHERE category IS NOT NULL ORDER BY category`
      );

      return {
        success: true,
        items: items.map((i: StockItem) => ({
          ...i,
          quantity: Number(i.quantity || 0),
          reorderLevel: Number(i.reorderLevel || 0),
          unitPrice: Number(i.unitPrice || 0)
        })),
        summary: {
          totalItems: Number(statsResult[0]?.totalItems || 0),
          totalValue: Number(statsResult[0]?.totalValue || 0),
          lowStockCount: Number(statsResult[0]?.lowStockCount || 0),
          outOfStockCount: Number(statsResult[0]?.outOfStockCount || 0),
          expiringCount: Number(statsResult[0]?.expiringCount || 0)
        },
        categories: categories.map((c: { category: string }) => c.category)
      };
    } catch (error) {
      console.error('[Reports] Error generating stock report:', error);
      return { success: false, error: 'Failed to generate stock report' };
    }
  });

  // Top Sellers Report
  ipcMain.handle('getTopSellersReport', async (_, filters: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const { startDate, endDate, limit = 10 } = filters;

    try {
      let dateFilter = '';
      const params: (string | number)[] = [];

      if (startDate) {
        dateFilter += ' AND s."createdAt" >= ?';
        params.push(startDate);
      }
      if (endDate) {
        dateFilter += ' AND s."createdAt" <= ?';
        params.push(endDate + 'T23:59:59.999Z');
      }

      params.push(limit);

      const topSellers = await prisma.$queryRawUnsafe(
        `SELECT 
          m.id, m.name, m."genericName", m.category,
          COALESCE(SUM(si.quantity), 0) as "totalQuantity",
          COALESCE(SUM(si.quantity * si."unitPrice"), 0) as "totalRevenue"
         FROM "SaleItem" si
         JOIN "Sale" s ON si."saleId" = s.id
         JOIN "Medicine" m ON si."medicineId" = m.id
         WHERE s.status = 'COMPLETED' ${dateFilter}
         GROUP BY m.id, m.name, m."genericName", m.category
         ORDER BY "totalQuantity" DESC
         LIMIT ?`,
        ...params
      );

      return {
        success: true,
        topSellers: topSellers.map((t: TopSeller) => ({
          ...t,
          totalQuantity: Number(t.totalQuantity || 0),
          totalRevenue: Number(t.totalRevenue || 0)
        }))
      };
    } catch (error) {
      console.error('[Reports] Error generating top sellers report:', error);
      return { success: false, error: 'Failed to generate top sellers report' };
    }
  });

  // Export data for accounting (CSV format)
  ipcMain.handle('exportAccountingData', async (_, filters: {
    type: 'sales' | 'purchases' | 'inventory';
    startDate?: string;
    endDate?: string;
  }) => {
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return { success: false, error: 'Database not initialized' };
    const { type, startDate, endDate } = filters;

    try {
      let dateFilter = '';
      const params: string[] = [];

      if (startDate) {
        dateFilter += ' AND "createdAt" >= ?';
        params.push(startDate);
      }
      if (endDate) {
        dateFilter += ' AND "createdAt" <= ?';
        params.push(endDate + 'T23:59:59.999Z');
      }

      let data: (string | number)[][] = [];
      let headers: string[] = [];

      if (type === 'sales') {
        headers = ['Date', 'Invoice', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Method', 'Status'];
        const sales = await prisma.$queryRawUnsafe(
          `SELECT s."createdAt", s."invoiceNumber", c.name as "customerName",
                  (SELECT COUNT(*) FROM "SaleItem" WHERE "saleId" = s.id) as "itemCount",
                  s.subtotal, s.discount, s.tax, s.total, s."paymentMethod", s.status
           FROM "Sale" s
           LEFT JOIN "Customer" c ON s."customerId" = c.id
           WHERE 1=1 ${dateFilter.replace(/"createdAt"/g, 's."createdAt"')}
           ORDER BY s."createdAt" DESC`,
          ...params
        ) as {
          createdAt: string;
          invoiceNumber: string | null;
          customerName: string | null;
          itemCount: number;
          subtotal: number;
          discount: number;
          tax: number;
          total: number;
          paymentMethod: string;
          status: string;
        }[];
        data = sales.map((s) => ([
          s.createdAt,
          s.invoiceNumber || '-',
          s.customerName || 'Walk-in',
          Number(s.itemCount || 0),
          Number(s.subtotal || 0).toFixed(2),
          Number(s.discount || 0).toFixed(2),
          Number(s.tax || 0).toFixed(2),
          Number(s.total || 0).toFixed(2),
          s.paymentMethod,
          s.status
        ]));
      } else if (type === 'purchases') {
        headers = ['Date', 'PO Number', 'Supplier', 'Items', 'Subtotal', 'Tax', 'Total', 'Status'];
        const purchases = await prisma.$queryRawUnsafe(
          `SELECT po."createdAt", po."poNumber", s.name as "supplierName",
                  (SELECT COUNT(*) FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = po.id) as "itemCount",
                  po.subtotal, po.tax, po.total, po.status
           FROM "PurchaseOrder" po
           LEFT JOIN "Supplier" s ON po."supplierId" = s.id
           WHERE 1=1 ${dateFilter.replace(/"createdAt"/g, 'po."createdAt"')}
           ORDER BY po."createdAt" DESC`,
          ...params
        ) as {
          createdAt: string;
          poNumber: string;
          supplierName: string;
          itemCount: number;
          subtotal: number;
          tax: number;
          total: number;
          status: string;
        }[];
        data = purchases.map((p) => ([
          p.createdAt,
          p.poNumber,
          p.supplierName || '-',
          Number(p.itemCount || 0),
          Number(p.subtotal || 0).toFixed(2),
          Number(p.tax || 0).toFixed(2),
          Number(p.total || 0).toFixed(2),
          p.status
        ]));
      } else if (type === 'inventory') {
        headers = ['Name', 'Generic Name', 'Category', 'Batch', 'Quantity', 'Reorder Level', 'Unit Price', 'Total Value', 'Expiry Date', 'Status'];
        const inventory = await prisma.$queryRawUnsafe(
          `SELECT name, "genericName", category, "batchNumber", quantity, "reorderLevel", "unitPrice", "expiryDate",
                  CASE 
                    WHEN quantity = 0 THEN 'OUT_OF_STOCK'
                    WHEN quantity <= "reorderLevel" THEN 'LOW_STOCK'
                    WHEN "expiryDate" IS NOT NULL AND date("expiryDate") <= date('now', '+30 days') THEN 'EXPIRING'
                    ELSE 'IN_STOCK'
                  END as status
           FROM "Medicine"
           ORDER BY name ASC`
        );
        data = inventory.map((i: StockItem) => ([
          i.name,
          i.genericName || '-',
          i.category || '-',
          i.batchNumber || '-',
          Number(i.quantity || 0),
          Number(i.reorderLevel || 0),
          Number(i.unitPrice || 0).toFixed(2),
          (Number(i.quantity || 0) * Number(i.unitPrice || 0)).toFixed(2),
          i.expiryDate || '-',
          i.status
        ]));
      }

      // Convert to CSV
      let csv = headers.join(',') + '\n';
      data.forEach(row => {
        csv += row.map(cell => 
          typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
        ).join(',') + '\n';
      });

      return { success: true, csv, headers, rowCount: data.length };
    } catch (error) {
      console.error('[Reports] Error exporting data:', error);
      return { success: false, error: 'Failed to export data' };
    }
  });

  console.log('[IPC] Reports handlers registered');
}
