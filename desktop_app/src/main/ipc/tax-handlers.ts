import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';
import { randomUUID } from 'crypto';
import { createAuditLog } from './audit-log-handlers';

// IPC Channel names for Tax Settings
const TAX_CHANNELS = {
  GET_SETTINGS: 'tax:get-settings',
  SAVE_SETTINGS: 'tax:save-settings',
  GET_TAX_REPORT: 'tax:get-report',
} as const;

export interface TaxSettings {
  vatEnabled: boolean;
  standardVatRate: number; // Default 16% in Kenya
  companyKraPin: string;
  companyName: string;
  companyAddress: string;
  defaultTaxExempt: boolean; // Most medicines are VAT-exempt
}

const DEFAULT_TAX_SETTINGS: TaxSettings = {
  vatEnabled: true,
  standardVatRate: 16,
  companyKraPin: '',
  companyName: '',
  companyAddress: '',
  defaultTaxExempt: true, // Most medicines are VAT-exempt in Kenya
};

export function registerTaxHandlers(): void {
  console.log('[IPC] Registering Tax handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get Tax Settings
  ipcMain.handle(TAX_CHANNELS.GET_SETTINGS, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      // Fetch all tax-related settings from AppSettings
      const settings = await prisma.appSettings.findMany({
        where: {
          key: { startsWith: 'tax_' },
        },
      });

      // Convert to TaxSettings object
      const taxSettings: TaxSettings = { ...DEFAULT_TAX_SETTINGS };
      settings.forEach((s: any) => {
        const key = s.key.replace('tax_', '') as keyof TaxSettings;
        if (key === 'vatEnabled' || key === 'defaultTaxExempt') {
          (taxSettings as any)[key] = s.value === 'true';
        } else if (key === 'standardVatRate') {
          (taxSettings as any)[key] = parseFloat(s.value) || 16;
        } else {
          (taxSettings as any)[key] = s.value;
        }
      });

      return { success: true, settings: taxSettings };
    } catch (error: any) {
      console.error('[Tax] Error getting settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Save Tax Settings
  ipcMain.handle(
    TAX_CHANNELS.SAVE_SETTINGS,
    async (
      _,
      data: { settings: Partial<TaxSettings>; user: { id: string; name: string; email: string; role: string } }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        const { settings, user } = data;

        // Get previous settings for audit
        const previousSettings = await prisma.appSettings.findMany({
          where: { key: { startsWith: 'tax_' } },
        });
        const prevObj: any = {};
        previousSettings.forEach((s: any) => {
          prevObj[s.key] = s.value;
        });

        // Save each setting
        const settingEntries = Object.entries(settings) as [keyof TaxSettings, any][];
        for (const [key, value] of settingEntries) {
          const dbKey = `tax_${key}`;
          const dbValue = String(value);

          await prisma.appSettings.upsert({
            where: { key: dbKey },
            update: { value: dbValue },
            create: {
              id: randomUUID(),
              key: dbKey,
              value: dbValue,
              description: `Tax setting: ${key}`,
            },
          });
        }

        // Create audit log
        await createAuditLog({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: 'UPDATE',
          entityType: 'TAX_SETTINGS',
          entityName: 'Tax Configuration',
          previousValues: prevObj,
          newValues: settings,
          description: 'Updated tax settings',
          severity: 'WARNING',
        });

        return { success: true };
      } catch (error: any) {
        console.error('[Tax] Error saving settings:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Get Tax Report
  ipcMain.handle(
    TAX_CHANNELS.GET_TAX_REPORT,
    async (
      _,
      options?: {
        startDate?: string;
        endDate?: string;
        branchId?: string;
      }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        // Build date filter
        const whereClause: any = {};
        if (options?.startDate) {
          whereClause.createdAt = { ...whereClause.createdAt, gte: new Date(options.startDate) };
        }
        if (options?.endDate) {
          whereClause.createdAt = { ...whereClause.createdAt, lte: new Date(options.endDate) };
        }
        if (options?.branchId) {
          whereClause.branchId = options.branchId;
        }

        // Get sales with tax data
        const sales = await prisma.sale.findMany({
          where: whereClause,
          select: {
            id: true,
            invoiceNumber: true,
            subtotal: true,
            taxAmount: true,
            taxableAmount: true,
            exemptAmount: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        // Calculate totals
        const totals = sales.reduce(
          (acc: any, sale: any) => {
            acc.totalSales += sale.total || 0;
            acc.totalTax += sale.taxAmount || 0;
            acc.totalTaxable += sale.taxableAmount || 0;
            acc.totalExempt += sale.exemptAmount || 0;
            return acc;
          },
          { totalSales: 0, totalTax: 0, totalTaxable: 0, totalExempt: 0 }
        );

        return {
          success: true,
          report: {
            sales,
            totals,
            period: {
              startDate: options?.startDate || 'All time',
              endDate: options?.endDate || 'Now',
            },
          },
        };
      } catch (error: any) {
        console.error('[Tax] Error generating report:', error);
        return { success: false, error: error.message };
      }
    }
  );

  console.log('[IPC] Tax handlers registered successfully');
}
