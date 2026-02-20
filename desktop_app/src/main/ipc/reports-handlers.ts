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

// Helper to detect database type
function isPostgreSQL(dbManager: DatabaseManager): boolean {
  const config = dbManager.getConfig();
  return config?.type === 'postgresql';
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
    if (!dbManager.isInitialized()) return { success: false, error: 'Database not initialized' };
    const { startDate, endDate, groupBy = 'day' } = filters;
    const usePostgres = isPostgreSQL(dbManager);

    try {
      // Build date filter conditions
      let dateConditions: string[] = [];
      if (startDate) {
        dateConditions.push(usePostgres 
          ? `s."createdAt" >= '${startDate}'::timestamp`
          : `s."createdAt" >= '${startDate}'`);
      }
      if (endDate) {
        dateConditions.push(usePostgres 
          ? `s."createdAt" <= '${endDate}T23:59:59.999Z'::timestamp`
          : `s."createdAt" <= '${endDate}T23:59:59.999Z'`);
      }
      const dateFilter = dateConditions.length > 0 ? ' AND ' + dateConditions.join(' AND ') : '';

      // Summary query
      const summaryQuery = `
        SELECT 
          COALESCE(SUM(s.total), 0) as "totalRevenue",
          COUNT(s.id) as "totalTransactions",
          COALESCE(SUM((SELECT COALESCE(SUM(si.quantity), 0) FROM "SaleItem" si WHERE si."saleId" = s.id)), 0) as "totalItems"
        FROM "Sale" s
        WHERE s.status = 'COMPLETED' ${dateFilter}`;

      const summaryResult = await dbManager.executeRawQuery(summaryQuery) as {
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

      // Chart data - use database-specific date formatting
      let dateFormatExpr: string;
      if (usePostgres) {
        // PostgreSQL date formatting
        if (groupBy === 'week') dateFormatExpr = `TO_CHAR(s."createdAt", 'IYYY-"W"IW')`;
        else if (groupBy === 'month') dateFormatExpr = `TO_CHAR(s."createdAt", 'YYYY-MM')`;
        else dateFormatExpr = `TO_CHAR(s."createdAt", 'YYYY-MM-DD')`;
      } else {
        // SQLite date formatting
        if (groupBy === 'week') dateFormatExpr = `strftime('%Y-W%W', s."createdAt")`;
        else if (groupBy === 'month') dateFormatExpr = `strftime('%Y-%m', s."createdAt")`;
        else dateFormatExpr = `strftime('%Y-%m-%d', s."createdAt")`;
      }

      const chartQuery = `
        SELECT 
          ${dateFormatExpr} as period,
          COALESCE(SUM(s.total), 0) as revenue,
          COUNT(s.id) as transactions,
          COALESCE(SUM((SELECT COALESCE(SUM(si.quantity), 0) FROM "SaleItem" si WHERE si."saleId" = s.id)), 0) as items
        FROM "Sale" s
        WHERE s.status = 'COMPLETED' ${dateFilter}
        GROUP BY ${dateFormatExpr}
        ORDER BY period ASC`;

      const chartData = await dbManager.executeRawQuery(chartQuery);

      // Payment breakdown
      const paymentQuery = `
        SELECT 
          s."paymentMethod" as method,
          COALESCE(SUM(s.total), 0) as total,
          COUNT(s.id) as count
        FROM "Sale" s
        WHERE s.status = 'COMPLETED' ${dateFilter}
        GROUP BY s."paymentMethod"`;

      const paymentBreakdown = await dbManager.executeRawQuery(paymentQuery);

      return {
        success: true,
        summary,
        chartData: (chartData as SaleReportRow[]).map((r) => ({
          period: r.period,
          revenue: Number(r.revenue || 0),
          transactions: Number(r.transactions || 0),
          items: Number(r.items || 0)
        })),
        paymentBreakdown: (paymentBreakdown as PaymentBreakdown[]).map((r) => ({
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
    if (!dbManager.isInitialized()) return { success: false, error: 'Database not initialized' };
    const { status = 'all', category = '', search = '' } = filters;
    const usePostgres = isPostgreSQL(dbManager);

    try {
      let whereConditions: string[] = ['1=1'];

      if (search) {
        const searchEscaped = search.replace(/'/g, "''");
        whereConditions.push(`(m.name ILIKE '%${searchEscaped}%' OR m."genericName" ILIKE '%${searchEscaped}%' OR m."batchNumber" ILIKE '%${searchEscaped}%')`);
      }
      if (category) {
        const categoryEscaped = category.replace(/'/g, "''");
        whereConditions.push(`m.category = '${categoryEscaped}'`);
      }

      // Date expression for 30 days from now
      const expiryCheck = usePostgres
        ? `m."expiryDate" IS NOT NULL AND m."expiryDate"::date <= (CURRENT_DATE + INTERVAL '30 days')`
        : `m."expiryDate" IS NOT NULL AND date(m."expiryDate") <= date('now', '+30 days')`;

      // Status filtering
      if (status === 'low') {
        whereConditions.push('m.quantity > 0 AND m.quantity <= m."reorderLevel"');
      } else if (status === 'out') {
        whereConditions.push('m.quantity = 0');
      } else if (status === 'expiring') {
        whereConditions.push(expiryCheck);
      }

      const whereClause = 'WHERE ' + whereConditions.join(' AND ');

      // Status case expression
      const statusCase = usePostgres
        ? `CASE 
            WHEN m.quantity = 0 THEN 'OUT_OF_STOCK'
            WHEN m.quantity <= m."reorderLevel" THEN 'LOW_STOCK'
            WHEN m."expiryDate" IS NOT NULL AND m."expiryDate"::date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'EXPIRING'
            ELSE 'IN_STOCK'
          END`
        : `CASE 
            WHEN m.quantity = 0 THEN 'OUT_OF_STOCK'
            WHEN m.quantity <= m."reorderLevel" THEN 'LOW_STOCK'
            WHEN m."expiryDate" IS NOT NULL AND date(m."expiryDate") <= date('now', '+30 days') THEN 'EXPIRING'
            ELSE 'IN_STOCK'
          END`;

      const itemsQuery = `
        SELECT m.id, m.name, m."genericName", m.category, m."batchNumber",
               m.quantity, m."reorderLevel", m."unitPrice", m."expiryDate",
               ${statusCase} as status
        FROM "Medicine" m
        ${whereClause}
        ORDER BY m.quantity ASC, m.name ASC`;

      const items = await dbManager.executeRawQuery(itemsQuery);

      // Summary stats with database-specific date handling
      const expiringCountExpr = usePostgres
        ? `SUM(CASE WHEN m."expiryDate" IS NOT NULL AND m."expiryDate"::date <= (CURRENT_DATE + INTERVAL '30 days') THEN 1 ELSE 0 END)`
        : `SUM(CASE WHEN m."expiryDate" IS NOT NULL AND date(m."expiryDate") <= date('now', '+30 days') THEN 1 ELSE 0 END)`;

      const statsQuery = `
        SELECT 
          COUNT(*) as "totalItems",
          COALESCE(SUM(m.quantity * m."unitPrice"), 0) as "totalValue",
          SUM(CASE WHEN m.quantity > 0 AND m.quantity <= m."reorderLevel" THEN 1 ELSE 0 END) as "lowStockCount",
          SUM(CASE WHEN m.quantity = 0 THEN 1 ELSE 0 END) as "outOfStockCount",
          ${expiringCountExpr} as "expiringCount"
        FROM "Medicine" m`;

      const statsResult = await dbManager.executeRawQuery(statsQuery) as {
        totalItems: number;
        totalValue: number;
        lowStockCount: number;
        outOfStockCount: number;
        expiringCount: number;
      }[];

      // Categories
      const categories = await dbManager.executeRawQuery(
        `SELECT DISTINCT category FROM "Medicine" WHERE category IS NOT NULL ORDER BY category`
      );

      return {
        success: true,
        items: (items as StockItem[]).map((i) => ({
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
        categories: (categories as { category: string }[]).map((c) => c.category)
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
    if (!dbManager.isInitialized()) return { success: false, error: 'Database not initialized' };
    const { startDate, endDate, limit = 10 } = filters;
    const usePostgres = isPostgreSQL(dbManager);

    try {
      // Build date filter conditions
      let dateConditions: string[] = [];
      if (startDate) {
        dateConditions.push(usePostgres 
          ? `s."createdAt" >= '${startDate}'::timestamp`
          : `s."createdAt" >= '${startDate}'`);
      }
      if (endDate) {
        dateConditions.push(usePostgres 
          ? `s."createdAt" <= '${endDate}T23:59:59.999Z'::timestamp`
          : `s."createdAt" <= '${endDate}T23:59:59.999Z'`);
      }
      const dateFilter = dateConditions.length > 0 ? ' AND ' + dateConditions.join(' AND ') : '';

      const query = `
        SELECT 
          m.id, m.name, m."genericName", m.category,
          COALESCE(SUM(si.quantity), 0) as "totalQuantity",
          COALESCE(SUM(si.quantity * si."unitPrice"), 0) as "totalRevenue"
        FROM "SaleItem" si
        JOIN "Sale" s ON si."saleId" = s.id
        JOIN "Medicine" m ON si."medicineId" = m.id
        WHERE s.status = 'COMPLETED' ${dateFilter}
        GROUP BY m.id, m.name, m."genericName", m.category
        ORDER BY "totalQuantity" DESC
        LIMIT ${limit}`;

      const topSellers = await dbManager.executeRawQuery(query);

      return {
        success: true,
        topSellers: (topSellers as TopSeller[]).map((t) => ({
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
    if (!dbManager.isInitialized()) return { success: false, error: 'Database not initialized' };
    const { type, startDate, endDate } = filters;
    const usePostgres = isPostgreSQL(dbManager);

    try {
      // Build date filter for sales/purchases
      let dateConditions: string[] = [];
      if (startDate) {
        dateConditions.push(usePostgres 
          ? `"createdAt" >= '${startDate}'::timestamp`
          : `"createdAt" >= '${startDate}'`);
      }
      if (endDate) {
        dateConditions.push(usePostgres 
          ? `"createdAt" <= '${endDate}T23:59:59.999Z'::timestamp`
          : `"createdAt" <= '${endDate}T23:59:59.999Z'`);
      }
      const dateFilter = dateConditions.length > 0 ? ' AND ' + dateConditions.join(' AND ') : '';

      let data: (string | number)[][] = [];
      let headers: string[] = [];

      if (type === 'sales') {
        headers = ['Date', 'Invoice', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Method', 'Status'];
        const salesDateFilter = dateFilter.replace(/"createdAt"/g, 's."createdAt"');
        const salesQuery = `
          SELECT s."createdAt", s."invoiceNumber", c.name as "customerName",
                 (SELECT COUNT(*) FROM "SaleItem" WHERE "saleId" = s.id) as "itemCount",
                 s.subtotal, s.discount, s.tax, s.total, s."paymentMethod", s.status
          FROM "Sale" s
          LEFT JOIN "Customer" c ON s."customerId" = c.id
          WHERE 1=1 ${salesDateFilter}
          ORDER BY s."createdAt" DESC`;
        
        const sales = await dbManager.executeRawQuery(salesQuery) as {
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
        const poDateFilter = dateFilter.replace(/"createdAt"/g, 'po."createdAt"');
        const purchasesQuery = `
          SELECT po."createdAt", po."poNumber", s.name as "supplierName",
                 (SELECT COUNT(*) FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = po.id) as "itemCount",
                 po.subtotal, po.tax, po.total, po.status
          FROM "PurchaseOrder" po
          LEFT JOIN "Supplier" s ON po."supplierId" = s.id
          WHERE 1=1 ${poDateFilter}
          ORDER BY po."createdAt" DESC`;

        const purchases = await dbManager.executeRawQuery(purchasesQuery) as {
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
        
        const statusCase = usePostgres
          ? `CASE 
              WHEN quantity = 0 THEN 'OUT_OF_STOCK'
              WHEN quantity <= "reorderLevel" THEN 'LOW_STOCK'
              WHEN "expiryDate" IS NOT NULL AND "expiryDate"::date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'EXPIRING'
              ELSE 'IN_STOCK'
            END`
          : `CASE 
              WHEN quantity = 0 THEN 'OUT_OF_STOCK'
              WHEN quantity <= "reorderLevel" THEN 'LOW_STOCK'
              WHEN "expiryDate" IS NOT NULL AND date("expiryDate") <= date('now', '+30 days') THEN 'EXPIRING'
              ELSE 'IN_STOCK'
            END`;

        const inventoryQuery = `
          SELECT name, "genericName", category, "batchNumber", quantity, "reorderLevel", "unitPrice", "expiryDate",
                 ${statusCase} as status
          FROM "Medicine"
          ORDER BY name ASC`;

        const inventory = await dbManager.executeRawQuery(inventoryQuery);
        data = (inventory as StockItem[]).map((i) => ([
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
