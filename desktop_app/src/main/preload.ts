import { contextBridge, ipcRenderer } from 'electron';

// IPC Channel names - inlined to avoid module resolution issues in preload
const IPC_CHANNELS = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_CURRENT_USER: 'auth:get-current-user',
  // Database
  DB_GET_CONFIG: 'db:get-config',
  DB_SET_CONFIG: 'db:set-config',
  DB_TEST_CONNECTION: 'db:test-connection',
  DB_INITIALIZE: 'db:initialize',
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',
  // Sync
  SYNC_START: 'sync:start',
  SYNC_STOP: 'sync:stop',
  SYNC_STATUS: 'sync:status',
  SYNC_MANUAL: 'sync:manual',
  SYNC_SET_SERVER: 'sync:set-server',
  SYNC_GET_SERVER: 'sync:get-server',
  SYNC_AUTHENTICATE: 'sync:authenticate',
  SYNC_DOWNLOAD: 'sync:download',
  SYNC_UPLOAD: 'sync:upload',
  SYNC_RESET: 'sync:reset',
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  // App
  APP_VERSION: 'app:version',
  APP_QUIT: 'app:quit',
  // POS
  MEDICINE_SEARCH: 'pos:medicine-search',
  MEDICINE_GET_ALL: 'pos:medicine-get-all',
  MEDICINE_GET_BY_ID: 'pos:medicine-get-by-id',
  CUSTOMER_SEARCH: 'pos:customer-search',
  CUSTOMER_GET_ALL: 'pos:customer-get-all',
  CUSTOMER_GET_BY_ID: 'pos:customer-get-by-id',
  CUSTOMER_CREATE: 'pos:customer-create',
  SALE_CREATE: 'pos:sale-create',
  SALE_GET_BY_ID: 'pos:sale-get-by-id',
  SALE_GET_TODAY_STATS: 'pos:sale-get-today-stats',
} as const;

// Type definitions inlined
interface LoginCredentials {
  email: string;
  password: string;
}

interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  connectionString?: string;
  databasePath?: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth APIs
  login: (credentials: LoginCredentials) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),
  logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
  getCurrentUser: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_CURRENT_USER),

  // Database APIs
  getDbConfig: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_CONFIG),
  setDbConfig: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_SET_CONFIG, config),
  testDbConnection: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_TEST_CONNECTION, config),
  initializeDb: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_INITIALIZE, config),

  // Settings APIs
  getSetting: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  getAllSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),

  // Sync APIs
  startSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_START),
  stopSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STOP),
  getSyncStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STATUS),
  manualSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_MANUAL),
  setSyncServer: (serverUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_SET_SERVER, serverUrl),
  getSyncServer: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_SERVER),
  syncAuthenticate: (credentials: LoginCredentials) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_AUTHENTICATE, credentials),
  syncDownload: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_DOWNLOAD),
  syncUpload: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_UPLOAD),
  syncReset: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESET),
  onSyncProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('sync:progress', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('sync:progress');
  },

  // Window APIs
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),

  // App APIs
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),
  quitApp: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),

  // POS APIs - Medicines
  searchMedicines: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_SEARCH, query),
  getAllMedicines: (options?: { limit?: number }) => ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_GET_ALL, options),
  getMedicineById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_GET_BY_ID, id),

  // POS APIs - Customers
  searchCustomers: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_SEARCH, query),
  getAllCustomers: () => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET_ALL),
  getCustomerById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET_BY_ID, id),
  createCustomer: (data: { name: string; phone: string; email?: string; address?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_CREATE, data),

  // POS APIs - Sales
  createSale: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.SALE_CREATE, data),
  getSaleById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SALE_GET_BY_ID, id),
  getTodayStats: () => ipcRenderer.invoke(IPC_CHANNELS.SALE_GET_TODAY_STATS),
});

// Type definitions for TypeScript
export interface ElectronAPI {
  // Auth
  login: (credentials: LoginCredentials) => Promise<any>;
  logout: () => Promise<any>;
  getCurrentUser: () => Promise<any>;

  // Database
  getDbConfig: () => Promise<any>;
  setDbConfig: (config: DatabaseConfig) => Promise<any>;
  testDbConnection: (config: DatabaseConfig) => Promise<any>;
  initializeDb: (config: DatabaseConfig) => Promise<any>;

  // Settings
  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: string) => Promise<any>;
  getAllSettings: () => Promise<any>;

  // Sync
  startSync: () => Promise<any>;
  stopSync: () => Promise<any>;
  getSyncStatus: () => Promise<any>;
  manualSync: () => Promise<any>;
  setSyncServer: (serverUrl: string) => Promise<any>;
  getSyncServer: () => Promise<any>;
  syncAuthenticate: (credentials: LoginCredentials) => Promise<any>;
  syncDownload: () => Promise<any>;
  syncUpload: () => Promise<any>;
  syncReset: () => Promise<any>;
  onSyncProgress: (callback: (data: any) => void) => () => void;

  // Window
  minimizeWindow: () => Promise<any>;
  maximizeWindow: () => Promise<any>;
  closeWindow: () => Promise<any>;

  // App
  getAppVersion: () => Promise<any>;
  quitApp: () => Promise<any>;

  // POS - Medicines
  searchMedicines: (query: string) => Promise<any>;
  getAllMedicines: (options?: { limit?: number }) => Promise<any>;
  getMedicineById: (id: string) => Promise<any>;

  // POS - Customers
  searchCustomers: (query: string) => Promise<any>;
  getAllCustomers: () => Promise<any>;
  getCustomerById: (id: string) => Promise<any>;
  createCustomer: (data: { name: string; phone: string; email?: string; address?: string }) => Promise<any>;

  // POS - Sales
  createSale: (data: any) => Promise<any>;
  getSaleById: (id: string) => Promise<any>;
  getTodayStats: () => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
