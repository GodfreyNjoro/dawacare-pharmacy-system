/**
 * Audit Logger - ALCOA+ Compliance for Kenya PPB & WHO GDP
 * 
 * ALCOA+ Principles:
 * - Attributable: WHO made the change (user details)
 * - Legible: Clear, readable records
 * - Contemporaneous: Recorded at time of action
 * - Original: First capture of data
 * - Accurate: Free from errors
 * - Complete: All relevant information captured
 * - Consistent: Same format throughout
 * - Enduring: Stored permanently
 * - Available: Accessible when needed
 */

import { prisma } from './db';
import { headers } from 'next/headers';

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'VIEW' 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'EXPORT'
  | 'STOCK_ADJUSTMENT'
  | 'SALE_VOID'
  | 'PRICE_CHANGE';

export type AuditEntityType = 
  | 'MEDICINE'
  | 'SALE'
  | 'USER'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'PURCHASE_ORDER'
  | 'GRN'
  | 'BRANCH'
  | 'STOCK_TRANSFER'
  | 'SETTINGS'
  | 'EXPORT'
  | 'SESSION'
  | 'PRESCRIBER'
  | 'PRESCRIPTION'
  | 'PRESCRIPTION_DISPENSING';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId?: string;
  branchName?: string;
}

export interface AuditLogInput {
  user: AuditUser;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
  severity?: AuditSeverity;
}

/**
 * Get changed fields between two objects
 */
function getChangedFields(
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined
): string[] {
  if (!previous || !current) return [];
  
  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  
  for (const key of allKeys) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      changedFields.push(key);
    }
  }
  
  return changedFields;
}

/**
 * Get client IP address from request headers
 */
function getClientInfo(): { ipAddress: string | null; userAgent: string | null } {
  try {
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || headersList.get('x-real-ip') || null;
    const userAgent = headersList.get('user-agent') || null;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Determine severity based on action and entity type
 */
function determineSeverity(action: AuditAction, entityType: AuditEntityType): AuditSeverity {
  // Critical actions
  if (action === 'DELETE' && ['USER', 'MEDICINE', 'SALE'].includes(entityType)) {
    return 'CRITICAL';
  }
  if (action === 'SALE_VOID') return 'CRITICAL';
  if (action === 'PRICE_CHANGE') return 'WARNING';
  if (action === 'STOCK_ADJUSTMENT') return 'WARNING';
  if (entityType === 'SETTINGS') return 'WARNING';
  
  return 'INFO';
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const { ipAddress, userAgent } = getClientInfo();
    const changedFields = getChangedFields(input.previousValues, input.newValues);
    const severity = input.severity || determineSeverity(input.action, input.entityType);
    
    await prisma.auditLog.create({
      data: {
        userId: input.user.id,
        userName: input.user.name || 'Unknown',
        userEmail: input.user.email,
        userRole: input.user.role,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityName: input.entityName,
        previousValues: input.previousValues ? JSON.stringify(input.previousValues) : null,
        newValues: input.newValues ? JSON.stringify(input.newValues) : null,
        changedFields: changedFields.length > 0 ? JSON.stringify(changedFields) : null,
        ipAddress,
        userAgent,
        branchId: input.user.branchId,
        branchName: input.user.branchName,
        description: input.description,
        severity,
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('[AuditLog] Failed to create audit log:', error);
  }
}

/**
 * Helper to extract audit user from session
 */
export function getAuditUserFromSession(session: {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
    branchId?: string | null;
    branchName?: string | null;
  };
}): AuditUser | null {
  if (!session?.user?.id || !session?.user?.email) {
    return null;
  }
  
  return {
    id: session.user.id,
    name: session.user.name || 'Unknown',
    email: session.user.email,
    role: session.user.role || 'UNKNOWN',
    branchId: session.user.branchId || undefined,
    branchName: session.user.branchName || undefined,
  };
}

/**
 * Audit log for medicine inventory changes
 */
export async function auditMedicineChange(
  user: AuditUser,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STOCK_ADJUSTMENT' | 'PRICE_CHANGE',
  medicineId: string,
  medicineName: string,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
  description?: string
): Promise<void> {
  await createAuditLog({
    user,
    action,
    entityType: 'MEDICINE',
    entityId: medicineId,
    entityName: medicineName,
    previousValues,
    newValues,
    description,
  });
}

/**
 * Audit log for sales
 */
export async function auditSale(
  user: AuditUser,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SALE_VOID',
  saleId: string,
  invoiceNumber: string,
  saleDetails?: Record<string, unknown>,
  description?: string
): Promise<void> {
  await createAuditLog({
    user,
    action,
    entityType: 'SALE',
    entityId: saleId,
    entityName: invoiceNumber,
    newValues: saleDetails,
    description,
  });
}

/**
 * Audit log for user management
 */
export async function auditUserChange(
  user: AuditUser,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  targetUserId: string,
  targetUserEmail: string,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
  description?: string
): Promise<void> {
  await createAuditLog({
    user,
    action,
    entityType: 'USER',
    entityId: targetUserId,
    entityName: targetUserEmail,
    previousValues,
    newValues,
    description,
    severity: 'WARNING',
  });
}

/**
 * Audit log for authentication events
 */
export async function auditAuth(
  user: AuditUser,
  action: 'LOGIN' | 'LOGOUT',
  description?: string
): Promise<void> {
  await createAuditLog({
    user,
    action,
    entityType: 'SESSION',
    entityName: user.email,
    description,
  });
}

/**
 * Audit log for exports
 */
export async function auditExport(
  user: AuditUser,
  exportType: string,
  recordCount: number,
  dateRange?: { from: Date; to: Date }
): Promise<void> {
  await createAuditLog({
    user,
    action: 'EXPORT',
    entityType: 'EXPORT',
    entityName: exportType,
    newValues: {
      exportType,
      recordCount,
      dateFrom: dateRange?.from?.toISOString(),
      dateTo: dateRange?.to?.toISOString(),
    },
    description: `Exported ${recordCount} ${exportType} records`,
  });
}
