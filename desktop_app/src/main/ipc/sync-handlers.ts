import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import DatabaseManager from '../database/database-manager';

const store = new Store();

// IPC Channel names for Sync
const SYNC_CHANNELS = {
  SYNC_START: 'sync:start',
  SYNC_STOP: 'sync:stop',
  SYNC_STATUS: 'sync:status',
  SYNC_MANUAL: 'sync:manual',
  SYNC_SET_SERVER: 'sync:set-server',
  SYNC_GET_SERVER: 'sync:get-server',
  SYNC_AUTHENTICATE: 'sync:authenticate',
  SYNC_DOWNLOAD: 'sync:download',
  SYNC_UPLOAD: 'sync:upload',
  SYNC_RESET: 'sync:reset', // Reset sync state for full re-sync
} as const;

const STORAGE_KEYS = {
  SYNC_SERVER_URL: 'sync.serverUrl',
  SYNC_TOKEN: 'sync.token',
  SYNC_USER: 'sync.user',
  SYNC_LAST_SYNC: 'sync.lastSync',
  SYNC_ENABLED: 'sync.enabled',
} as const;

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  serverUrl: string | null;
  isAuthenticated: boolean;
  pendingChanges: number;
}

let syncStatus: SyncStatus = {
  isOnline: false,
  isSyncing: false,
  lastSyncAt: null,
  serverUrl: null,
  isAuthenticated: false,
  pendingChanges: 0,
};

// Helper to make HTTP requests
async function fetchAPI(url: string, options: RequestInit = {}): Promise<any> {
  const token = store.get(STORAGE_KEYS.SYNC_TOKEN) as string;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// Check internet connectivity
async function checkOnlineStatus(): Promise<boolean> {
  try {
    const serverUrl = store.get(STORAGE_KEYS.SYNC_SERVER_URL) as string;
    if (!serverUrl) return false;
    
    const response = await fetch(`${serverUrl}/api/sync`, {
      method: 'HEAD',
      mode: 'no-cors',
    });
    return true;
  } catch {
    return false;
  }
}

// Count pending sync queue items
async function getPendingChangesCount(): Promise<number> {
  try {
    const dbManager = DatabaseManager.getInstance();
    const prisma = dbManager.getPrismaClient();
    if (!prisma) return 0;
    
    const count = await prisma.syncQueue.count({
      where: { synced: false },
    });
    return count;
  } catch {
    return 0;
  }
}

export function registerSyncHandlers(): void {
  console.log('[IPC] Registering Sync handlers...');

  // Get sync status
  ipcMain.handle(SYNC_CHANNELS.SYNC_STATUS, async () => {
    try {
      syncStatus.isOnline = await checkOnlineStatus();
      syncStatus.serverUrl = (store.get(STORAGE_KEYS.SYNC_SERVER_URL) as string) || null;
      syncStatus.lastSyncAt = (store.get(STORAGE_KEYS.SYNC_LAST_SYNC) as string) || null;
      syncStatus.isAuthenticated = !!(store.get(STORAGE_KEYS.SYNC_TOKEN) as string);
      syncStatus.pendingChanges = await getPendingChangesCount();
      
      return { success: true, status: syncStatus };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Set server URL
  ipcMain.handle(SYNC_CHANNELS.SYNC_SET_SERVER, async (_, serverUrl: string) => {
    try {
      // Validate URL format
      new URL(serverUrl);
      
      // Remove trailing slash
      const cleanUrl = serverUrl.replace(/\/$/, '');
      store.set(STORAGE_KEYS.SYNC_SERVER_URL, cleanUrl);
      
      // Clear existing auth when server changes
      store.delete(STORAGE_KEYS.SYNC_TOKEN);
      store.delete(STORAGE_KEYS.SYNC_USER);
      
      return { success: true, serverUrl: cleanUrl };
    } catch (error: any) {
      return { success: false, error: 'Invalid server URL' };
    }
  });

  // Get server URL
  ipcMain.handle(SYNC_CHANNELS.SYNC_GET_SERVER, async () => {
    const serverUrl = store.get(STORAGE_KEYS.SYNC_SERVER_URL) as string;
    return { success: true, serverUrl: serverUrl || null };
  });

  // Authenticate with cloud server
  ipcMain.handle(SYNC_CHANNELS.SYNC_AUTHENTICATE, async (_, credentials: { email: string; password: string }) => {
    try {
      const serverUrl = store.get(STORAGE_KEYS.SYNC_SERVER_URL) as string;
      if (!serverUrl) {
        return { success: false, error: 'Server URL not configured' };
      }
      
      const result = await fetchAPI(`${serverUrl}/api/sync/auth`, {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      
      if (result.success && result.token) {
        store.set(STORAGE_KEYS.SYNC_TOKEN, result.token);
        store.set(STORAGE_KEYS.SYNC_USER, result.user);
        syncStatus.isAuthenticated = true;
        
        return { success: true, user: result.user };
      }
      
      return { success: false, error: result.error || 'Authentication failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Reset sync state for full re-sync
  ipcMain.handle(SYNC_CHANNELS.SYNC_RESET, async () => {
    try {
      console.log('[Sync] Resetting sync state for full re-sync');
      
      // Clear the last sync timestamp
      store.delete(STORAGE_KEYS.SYNC_LAST_SYNC);
      syncStatus.lastSyncAt = null;
      
      console.log('[Sync] Last sync timestamp cleared - next download will be full sync');
      
      return { success: true, message: 'Sync state reset. Next download will fetch all data.' };
    } catch (error: any) {
      console.error('[Sync] Reset error:', error);
      return { success: false, error: error.message };
    }
  });

  // Download data from cloud
  ipcMain.handle(SYNC_CHANNELS.SYNC_DOWNLOAD, async (event) => {
    try {
      const serverUrl = store.get(STORAGE_KEYS.SYNC_SERVER_URL) as string;
      const token = store.get(STORAGE_KEYS.SYNC_TOKEN) as string;
      
      if (!serverUrl || !token) {
        return { success: false, error: 'Not configured or not authenticated' };
      }
      
      syncStatus.isSyncing = true;
      
      // Send progress update
      const mainWindow = BrowserWindow.getAllWindows()[0];
      mainWindow?.webContents.send('sync:progress', { stage: 'downloading', progress: 0 });
      
      // Fetch data from cloud - for first sync, don't pass lastSyncAt to get ALL data
      const lastSync = store.get(STORAGE_KEYS.SYNC_LAST_SYNC) as string;
      console.log('[Sync] Last sync timestamp:', lastSync || 'NEVER (first sync)');
      
      // Don't use lastSyncAt filter for first full sync
      const queryParams = lastSync ? `?lastSyncAt=${encodeURIComponent(lastSync)}` : '';
      console.log('[Sync] Fetching from:', `${serverUrl}/api/sync${queryParams}`);
      
      const result = await fetchAPI(`${serverUrl}/api/sync${queryParams}`);
      console.log('[Sync] API response success:', result.success);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to download data');
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'processing', progress: 30 });
      
      // Store data in local database
      const dbManager = DatabaseManager.getInstance();
      const prisma = dbManager.getPrismaClient();
      
      if (!prisma) {
        throw new Error('Database not initialized');
      }
      
      const { branches, users, medicines, customers, suppliers } = result.data;
      let stats = { branches: 0, users: 0, medicines: 0, customers: 0, suppliers: 0 };
      let errors: string[] = [];
      
      // Log received data counts
      console.log('[Sync] Received data from cloud:', {
        branches: branches?.length || 0,
        users: users?.length || 0,
        medicines: medicines?.length || 0,
        customers: customers?.length || 0,
        suppliers: suppliers?.length || 0,
      });
      
      // Sync branches - handle unique code constraint
      for (const branch of branches || []) {
        try {
          // First check if branch exists by ID or code
          const existingById = await prisma.branch.findUnique({ where: { id: branch.id } });
          const existingByCode = await prisma.branch.findUnique({ where: { code: branch.code } });
          
          if (existingById) {
            // Update existing branch by ID
            await prisma.branch.update({
              where: { id: branch.id },
              data: {
                name: branch.name,
                code: branch.code,
                address: branch.address,
                phone: branch.phone,
                email: branch.email,
                isMainBranch: branch.isMainBranch,
                status: branch.status,
                updatedAt: new Date(branch.updatedAt),
              },
            });
          } else if (existingByCode) {
            // Branch with same code exists but different ID - update by code
            await prisma.branch.update({
              where: { code: branch.code },
              data: {
                name: branch.name,
                address: branch.address,
                phone: branch.phone,
                email: branch.email,
                isMainBranch: branch.isMainBranch,
                status: branch.status,
                updatedAt: new Date(branch.updatedAt),
              },
            });
          } else {
            // Create new branch
            await prisma.branch.create({
              data: {
                id: branch.id,
                name: branch.name,
                code: branch.code,
                address: branch.address,
                phone: branch.phone,
                email: branch.email,
                isMainBranch: branch.isMainBranch,
                status: branch.status,
                createdAt: new Date(branch.createdAt),
                updatedAt: new Date(branch.updatedAt),
              },
            });
          }
          stats.branches++;
        } catch (branchError: any) {
          console.error(`[Sync] Branch sync error for ${branch.code}:`, branchError.message);
        }
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'syncing branches', progress: 40 });
      
      // Sync users (without passwords)
      for (const user of users || []) {
        const existing = await prisma.user.findUnique({ where: { id: user.id } });
        if (existing) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              name: user.name,
              email: user.email,
              role: user.role,
              branchId: user.branchId,
              status: user.status,
              updatedAt: new Date(user.updatedAt),
            },
          });
        }
        // Don't create new users from sync - they need passwords
        stats.users++;
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'syncing medicines', progress: 50 });
      
      // Sync medicines - map cloud fields to local schema
      // Cloud schema: sellingPrice, costPrice, dosageForm, strength, location, requiresPrescription
      // Local schema: unitPrice (use sellingPrice), no dosageForm/strength/location/requiresPrescription
      for (const medicine of medicines || []) {
        try {
          const existing = await prisma.medicine.findUnique({ where: { id: medicine.id } });
          const medicineData = {
            name: medicine.name,
            genericName: medicine.genericName || null,
            category: medicine.category || 'Other',
            manufacturer: medicine.manufacturer || null,
            batchNumber: medicine.batchNumber || `BATCH-${Date.now()}`,
            expiryDate: new Date(medicine.expiryDate),
            quantity: medicine.quantity || 0,
            reorderLevel: medicine.reorderLevel || 10,
            unitPrice: medicine.sellingPrice || medicine.unitPrice || 0, // Map sellingPrice to unitPrice
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
            updatedAt: new Date(medicine.updatedAt),
          };
          
          if (existing) {
            await prisma.medicine.update({
              where: { id: medicine.id },
              data: medicineData,
            });
          } else {
            await prisma.medicine.create({
              data: {
                id: medicine.id,
                ...medicineData,
                createdAt: new Date(medicine.createdAt),
              },
            });
          }
          stats.medicines++;
          console.log(`[Sync] Medicine synced: ${medicine.name} (qty: ${medicine.quantity})`);
        } catch (medError: any) {
          const errMsg = `Medicine ${medicine.name}: ${medError.message}`;
          console.error(`[Sync] ${errMsg}`);
          errors.push(errMsg);
        }
      }
      console.log(`[Sync] Medicines synced: ${stats.medicines}/${medicines?.length || 0}`);
      
      mainWindow?.webContents.send('sync:progress', { stage: 'syncing customers', progress: 70 });
      
      // Sync customers
      for (const customer of customers || []) {
        try {
          const existing = await prisma.customer.findUnique({ where: { id: customer.id } });
          if (existing) {
            await prisma.customer.update({
              where: { id: customer.id },
              data: {
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                loyaltyPoints: customer.loyaltyPoints,
                creditLimit: customer.creditLimit,
                creditBalance: customer.creditBalance,
                updatedAt: new Date(customer.updatedAt),
              },
            });
          } else {
            await prisma.customer.create({
              data: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                loyaltyPoints: customer.loyaltyPoints,
                creditLimit: customer.creditLimit,
                creditBalance: customer.creditBalance,
                createdAt: new Date(customer.createdAt),
                updatedAt: new Date(customer.updatedAt),
              },
            });
          }
          stats.customers++;
        } catch (custError: any) {
          console.error(`[Sync] Customer sync error for ${customer.name}:`, custError.message);
        }
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'syncing suppliers', progress: 85 });
      
      // Sync suppliers
      for (const supplier of suppliers || []) {
        try {
          const existing = await prisma.supplier.findUnique({ where: { id: supplier.id } });
          if (existing) {
            await prisma.supplier.update({
              where: { id: supplier.id },
              data: {
                name: supplier.name,
                contactPerson: supplier.contactPerson,
                phone: supplier.phone,
                email: supplier.email,
                address: supplier.address,
                status: supplier.status,
                updatedAt: new Date(supplier.updatedAt),
              },
            });
          } else {
            await prisma.supplier.create({
              data: {
                id: supplier.id,
                name: supplier.name,
                contactPerson: supplier.contactPerson,
                phone: supplier.phone,
                email: supplier.email,
                address: supplier.address,
                status: supplier.status,
                createdAt: new Date(supplier.createdAt),
                updatedAt: new Date(supplier.updatedAt),
              },
            });
          }
          stats.suppliers++;
        } catch (suppError: any) {
          console.error(`[Sync] Supplier sync error for ${supplier.name}:`, suppError.message);
        }
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'complete', progress: 100 });
      
      // Update last sync timestamp
      store.set(STORAGE_KEYS.SYNC_LAST_SYNC, result.syncedAt);
      syncStatus.lastSyncAt = result.syncedAt;
      syncStatus.isSyncing = false;
      
      console.log('[Sync] Download complete:', { stats, errors: errors.length });
      if (errors.length > 0) {
        console.log('[Sync] Errors:', errors.slice(0, 10)); // Show first 10 errors
      }
      
      return {
        success: true,
        stats,
        errors: errors.length > 0 ? errors : undefined,
        syncedAt: result.syncedAt,
      };
    } catch (error: any) {
      console.error('[Sync] Download error:', error);
      syncStatus.isSyncing = false;
      return { success: false, error: error.message };
    }
  });

  // Upload pending changes to cloud
  ipcMain.handle(SYNC_CHANNELS.SYNC_UPLOAD, async () => {
    try {
      const serverUrl = store.get(STORAGE_KEYS.SYNC_SERVER_URL) as string;
      const token = store.get(STORAGE_KEYS.SYNC_TOKEN) as string;
      
      if (!serverUrl || !token) {
        return { success: false, error: 'Not configured or not authenticated' };
      }
      
      const dbManager = DatabaseManager.getInstance();
      const prisma = dbManager.getPrismaClient();
      
      if (!prisma) {
        throw new Error('Database not initialized');
      }
      
      syncStatus.isSyncing = true;
      
      // Get unsynced sales from queue
      const pendingItems = await prisma.syncQueue.findMany({
        where: { synced: false },
        orderBy: { createdAt: 'asc' },
      });
      
      const salesToSync: any[] = [];
      const customersToSync: any[] = [];
      
      for (const item of pendingItems) {
        if (item.entityType === 'Sale') {
          const sale = await prisma.sale.findUnique({
            where: { id: item.entityId },
            include: { items: true },
          });
          if (sale) {
            salesToSync.push(sale);
          }
        } else if (item.entityType === 'Customer') {
          const customer = await prisma.customer.findUnique({
            where: { id: item.entityId },
          });
          if (customer) {
            customersToSync.push(customer);
          }
        }
      }
      
      // Upload to cloud
      const result = await fetchAPI(`${serverUrl}/api/sync`, {
        method: 'POST',
        body: JSON.stringify({
          sales: salesToSync,
          customers: customersToSync,
        }),
      });
      
      if (result.success) {
        // Mark items as synced
        await prisma.syncQueue.updateMany({
          where: { synced: false },
          data: { synced: true, syncedAt: new Date() },
        });
        
        syncStatus.pendingChanges = 0;
      }
      
      syncStatus.isSyncing = false;
      
      return {
        success: true,
        results: result.results,
      };
    } catch (error: any) {
      console.error('[Sync] Upload error:', error);
      syncStatus.isSyncing = false;
      return { success: false, error: error.message };
    }
  });

  // Manual full sync (download + upload)
  ipcMain.handle(SYNC_CHANNELS.SYNC_MANUAL, async (event) => {
    try {
      // First upload pending changes
      const uploadResult = await ipcMain.emit(SYNC_CHANNELS.SYNC_UPLOAD);
      
      // Then download latest data
      // Trigger the download handler directly
      const downloadHandler = ipcMain.listeners(SYNC_CHANNELS.SYNC_DOWNLOAD)[0];
      // We'll call it through the event system
      
      return {
        success: true,
        message: 'Sync started - please use individual sync download/upload handlers',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Sync handlers registered');
}
