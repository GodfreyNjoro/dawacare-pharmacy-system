import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';
import { randomUUID } from 'crypto';

// IPC Channel names for Audit Logs
const AUDIT_CHANNELS = {
  GET_LOGS: 'audit:get-logs',
  GET_LOG_DETAIL: 'audit:get-detail',
  GET_STATS: 'audit:get-stats',
  CREATE_LOG: 'audit:create',
} as const;

export interface AuditLogData {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  previousValues?: any;
  newValues?: any;
  changedFields?: string[];
  branchId?: string;
  branchName?: string;
  description?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

export function registerAuditLogHandlers(): void {
  console.log('[IPC] Registering Audit Log handlers...');
  const dbManager = DatabaseManager.getInstance();

  // Get Audit Logs (paginated, filterable)
  ipcMain.handle(
    AUDIT_CHANNELS.GET_LOGS,
    async (
      _,
      options?: {
        page?: number;
        limit?: number;
        search?: string;
        action?: string;
        entityType?: string;
        severity?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
      }
    ) => {
      try {
        const prisma = dbManager.getPrismaClient();
        if (!prisma) {
          return { success: false, error: 'Database not initialized' };
        }

        const page = options?.page || 1;
        const limit = options?.limit || 50;
        const skip = (page - 1) * limit;

        // Build where clause
        const whereConditions: any[] = [];

        if (options?.search) {
          whereConditions.push({
            OR: [
              { userName: { contains: options.search } },
              { entityName: { contains: options.search } },
              { description: { contains: options.search } },
            ],
          });
        }

        if (options?.action) {
          whereConditions.push({ action: options.action });
        }

        if (options?.entityType) {
          whereConditions.push({ entityType: options.entityType });
        }

        if (options?.severity) {
          whereConditions.push({ severity: options.severity });
        }

        if (options?.userId) {
          whereConditions.push({ userId: options.userId });
        }

        if (options?.startDate) {
          whereConditions.push({ createdAt: { gte: new Date(options.startDate) } });
        }

        if (options?.endDate) {
          whereConditions.push({ createdAt: { lte: new Date(options.endDate) } });
        }

        const whereClause = whereConditions.length > 0 ? { AND: whereConditions } : {};

        const [logs, total] = await Promise.all([
          prisma.auditLog.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.auditLog.count({ where: whereClause }),
        ]);

        return {
          success: true,
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      } catch (error: any) {
        console.error('[Audit] Error getting logs:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Get Single Audit Log Detail
  ipcMain.handle(AUDIT_CHANNELS.GET_LOG_DETAIL, async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const log = await prisma.auditLog.findUnique({
        where: { id },
      });

      if (!log) {
        return { success: false, error: 'Audit log not found' };
      }

      return { success: true, log };
    } catch (error: any) {
      console.error('[Audit] Error getting log detail:', error);
      return { success: false, error: error.message };
    }
  });

  // Get Audit Stats
  ipcMain.handle(AUDIT_CHANNELS.GET_STATS, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisWeek = new Date(today);
      thisWeek.setDate(thisWeek.getDate() - 7);

      const [totalLogs, todayLogs, weekLogs, criticalLogs, byAction, byEntity] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: thisWeek } } }),
        prisma.auditLog.count({ where: { severity: 'CRITICAL' } }),
        prisma.auditLog.groupBy({
          by: ['action'],
          _count: true,
          orderBy: { _count: { action: 'desc' } },
          take: 10,
        }),
        prisma.auditLog.groupBy({
          by: ['entityType'],
          _count: true,
          orderBy: { _count: { entityType: 'desc' } },
          take: 10,
        }),
      ]);

      return {
        success: true,
        stats: {
          totalLogs,
          todayLogs,
          weekLogs,
          criticalLogs,
          byAction: (byAction || []).map((a: any) => ({
            action: a.action,
            count: a._count || 0,
          })),
          byEntity: (byEntity || []).map((e: any) => ({
            entityType: e.entityType,
            count: e._count || 0,
          })),
        },
      };
    } catch (error: any) {
      console.error('[Audit] Error getting stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Create Audit Log (internal use)
  ipcMain.handle(AUDIT_CHANNELS.CREATE_LOG, async (_, data: AuditLogData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) {
        return { success: false, error: 'Database not initialized' };
      }

      const log = await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          userRole: data.userRole,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          entityName: data.entityName,
          previousValues: data.previousValues ? JSON.stringify(data.previousValues) : null,
          newValues: data.newValues ? JSON.stringify(data.newValues) : null,
          changedFields: data.changedFields ? JSON.stringify(data.changedFields) : null,
          branchId: data.branchId,
          branchName: data.branchName,
          description: data.description,
          severity: data.severity || 'INFO',
        },
      });

      return { success: true, log };
    } catch (error: any) {
      console.error('[Audit] Error creating log:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Audit Log handlers registered successfully');
}

// Helper function to create audit logs from other handlers
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    const dbManager = DatabaseManager.getInstance();
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return;

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userRole: data.userRole,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        previousValues: data.previousValues ? JSON.stringify(data.previousValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        changedFields: data.changedFields ? JSON.stringify(data.changedFields) : null,
        branchId: data.branchId,
        branchName: data.branchName,
        description: data.description,
        severity: data.severity || 'INFO',
      },
    });
  } catch (error) {
    console.error('[Audit] Error creating audit log:', error);
  }
}
