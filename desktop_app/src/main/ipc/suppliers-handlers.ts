import { ipcMain } from 'electron';
import DatabaseManager from '../database/database-manager';
import { randomUUID } from 'crypto';

interface SupplierData {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

async function addToSyncQueue(prisma: any, entityType: string, entityId: string, operation: string, payload: any = {}) {
  try {
    await prisma.syncQueue.upsert({
      where: { id: entityId + '-' + operation },
      create: {
        id: randomUUID(),
        entityType,
        entityId,
        operation,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
      update: {
        payload: JSON.stringify(payload),
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[Suppliers] Failed to add to sync queue:', error);
  }
}

export function registerSuppliersHandlers() {
  console.log('[IPC] Registering Suppliers handlers...');
  const dbManager = DatabaseManager.getInstance();

  ipcMain.handle('getSuppliersPaginated', async (_, params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    all?: boolean;
  }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const skip = (page - 1) * limit;

      // Build where clause using Prisma ORM
      const whereClause: any = {};

      if (params?.search && params.search.trim()) {
        whereClause.OR = [
          { name: { contains: params.search.trim() } },
          { contactPerson: { contains: params.search.trim() } },
          { email: { contains: params.search.trim() } },
        ];
      }

      if (params?.status && params.status.trim()) {
        whereClause.status = params.status.trim();
      } else if (params?.all) {
        whereClause.status = 'ACTIVE';
      }

      const [suppliers, totalCount] = await Promise.all([
        params?.all
          ? prisma.supplier.findMany({
              where: whereClause,
              orderBy: { name: 'asc' },
            })
          : prisma.supplier.findMany({
              where: whereClause,
              orderBy: { createdAt: 'desc' },
              skip,
              take: limit,
            }),
        prisma.supplier.count({ where: whereClause }),
      ]);

      return {
        success: true,
        suppliers,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error: any) {
      console.error('[Suppliers] Error fetching suppliers:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('createSupplier', async (_, data: SupplierData) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.name || !data.name.trim()) {
        return { success: false, error: 'Supplier name is required' };
      }

      const id = randomUUID();

      const supplier = await prisma.supplier.create({
        data: {
          id,
          name: data.name.trim(),
          contactPerson: data.contactPerson?.trim() || null,
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          status: 'ACTIVE',
        },
      });

      await addToSyncQueue(prisma, 'SUPPLIER', id, 'CREATE', supplier);
      return { success: true, supplier };
    } catch (error: any) {
      console.error('[Suppliers] Error creating supplier:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('updateSupplier', async (_, data: SupplierData & { id: string }) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      if (!data.id) return { success: false, error: 'Supplier ID is required' };
      if (!data.name || !data.name.trim()) return { success: false, error: 'Supplier name is required' };

      const supplier = await prisma.supplier.update({
        where: { id: data.id },
        data: {
          name: data.name.trim(),
          contactPerson: data.contactPerson?.trim() || null,
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
        },
      });

      await addToSyncQueue(prisma, 'SUPPLIER', data.id, 'UPDATE', supplier);
      return { success: true, supplier };
    } catch (error: any) {
      console.error('[Suppliers] Error updating supplier:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('deleteSupplier', async (_, id: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      if (!prisma) return { success: false, error: 'Database not initialized' };

      // Check for POs
      const poCount = await prisma.purchaseOrder.count({
        where: { supplierId: id },
      });

      if (poCount > 0) {
        // Soft delete
        const supplier = await prisma.supplier.update({
          where: { id },
          data: { status: 'INACTIVE' },
        });
        await addToSyncQueue(prisma, 'SUPPLIER', id, 'UPDATE', supplier);
        return { success: true, softDeleted: true };
      } else {
        // Hard delete
        await prisma.supplier.delete({ where: { id } });
        await addToSyncQueue(prisma, 'SUPPLIER', id, 'DELETE', { id });
        return { success: true, softDeleted: false };
      }
    } catch (error: any) {
      console.error('[Suppliers] Error deleting supplier:', error);
      return { success: false, error: error.message || String(error) };
    }
  });
}
