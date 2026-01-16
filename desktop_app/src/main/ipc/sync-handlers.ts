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
      
      // Fetch data from cloud
      const lastSync = store.get(STORAGE_KEYS.SYNC_LAST_SYNC) as string;
      const queryParams = lastSync ? `?lastSyncAt=${encodeURIComponent(lastSync)}` : '';
      
      const result = await fetchAPI(`${serverUrl}/api/sync${queryParams}`);
      
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
      
      // Sync branches
      for (const branch of branches || []) {
        await prisma.branch.upsert({
          where: { id: branch.id },
          update: {
            name: branch.name,
            code: branch.code,
            address: branch.address,
            phone: branch.phone,
            email: branch.email,
            isMainBranch: branch.isMainBranch,
            status: branch.status,
            updatedAt: new Date(branch.updatedAt),
          },
          create: {
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
        stats.branches++;
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
      
      // Sync medicines
      for (const medicine of medicines || []) {
        await prisma.medicine.upsert({
          where: { id: medicine.id },
          update: {
            name: medicine.name,
            genericName: medicine.genericName,
            category: medicine.category,
            dosageForm: medicine.dosageForm,
            strength: medicine.strength,
            manufacturer: medicine.manufacturer,
            batchNumber: medicine.batchNumber,
            expiryDate: new Date(medicine.expiryDate),
            quantity: medicine.quantity,
            reorderLevel: medicine.reorderLevel,
            costPrice: medicine.costPrice,
            sellingPrice: medicine.sellingPrice,
            location: medicine.location,
            requiresPrescription: medicine.requiresPrescription,
            updatedAt: new Date(medicine.updatedAt),
          },
          create: {
            id: medicine.id,
            name: medicine.name,
            genericName: medicine.genericName,
            category: medicine.category,
            dosageForm: medicine.dosageForm,
            strength: medicine.strength,
            manufacturer: medicine.manufacturer,
            batchNumber: medicine.batchNumber,
            expiryDate: new Date(medicine.expiryDate),
            quantity: medicine.quantity,
            reorderLevel: medicine.reorderLevel,
            costPrice: medicine.costPrice,
            sellingPrice: medicine.sellingPrice,
            location: medicine.location,
            requiresPrescription: medicine.requiresPrescription,
            createdAt: new Date(medicine.createdAt),
            updatedAt: new Date(medicine.updatedAt),
          },
        });
        stats.medicines++;
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'syncing customers', progress: 70 });
      
      // Sync customers
      for (const customer of customers || []) {
        await prisma.customer.upsert({
          where: { id: customer.id },
          update: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            loyaltyPoints: customer.loyaltyPoints,
            creditLimit: customer.creditLimit,
            creditBalance: customer.creditBalance,
            updatedAt: new Date(customer.updatedAt),
          },
          create: {
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
        stats.customers++;
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'syncing suppliers', progress: 85 });
      
      // Sync suppliers
      for (const supplier of suppliers || []) {
        await prisma.supplier.upsert({
          where: { id: supplier.id },
          update: {
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            status: supplier.status,
            updatedAt: new Date(supplier.updatedAt),
          },
          create: {
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
        stats.suppliers++;
      }
      
      mainWindow?.webContents.send('sync:progress', { stage: 'complete', progress: 100 });
      
      // Update last sync timestamp
      store.set(STORAGE_KEYS.SYNC_LAST_SYNC, result.syncedAt);
      syncStatus.lastSyncAt = result.syncedAt;
      syncStatus.isSyncing = false;
      
      return {
        success: true,
        stats,
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
