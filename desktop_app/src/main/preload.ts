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
  SYNC_GET_CONFIG: 'sync:get-config',
  SYNC_SAVE_CONFIG: 'sync:save-config',
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
  // Sales History
  SALES_GET_ALL: 'sales:get-all',
  SALES_GET_STATS: 'sales:get-stats',
  SALES_VOID: 'sales:void',
  // Customer Management
  CUSTOMER_GET_ALL_PAGINATED: 'customer:get-all-paginated',
  CUSTOMER_GET_DETAILS: 'customer:get-details',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_TOGGLE_STATUS: 'customer:toggle-status',
  // Inventory Management
  MEDICINE_CREATE: 'inventory:medicine-create',
  MEDICINE_UPDATE: 'inventory:medicine-update',
  MEDICINE_DELETE: 'inventory:medicine-delete',
  MEDICINE_GET_PAGINATED: 'inventory:medicine-get-paginated',
  MEDICINE_ADJUST_STOCK: 'inventory:medicine-adjust-stock',
  // Suppliers
  SUPPLIERS_GET_PAGINATED: 'getSuppliersPaginated',
  SUPPLIER_CREATE: 'createSupplier',
  SUPPLIER_UPDATE: 'updateSupplier',
  SUPPLIER_DELETE: 'deleteSupplier',
  // Purchase Orders
  PO_GET_PAGINATED: 'getPurchaseOrdersPaginated',
  PO_GET_BY_ID: 'getPurchaseOrderById',
  PO_CREATE: 'createPurchaseOrder',
  PO_UPDATE_STATUS: 'updatePurchaseOrderStatus',
  PO_DELETE: 'deletePurchaseOrder',
  // GRN
  GRN_GET_PAGINATED: 'getGRNsPaginated',
  GRN_GET_BY_ID: 'getGRNById',
  GRN_GET_PENDING_POS: 'getPendingPurchaseOrders',
  GRN_CREATE: 'createGRN',
  // Users
  USERS_GET_PAGINATED: 'getUsersPaginated',
  USER_CREATE: 'createUser',
  USER_UPDATE: 'updateUser',
  USER_DELETE: 'deleteUser',
  // Branches
  BRANCHES_GET_PAGINATED: 'getBranchesPaginated',
  BRANCH_CREATE: 'createBranch',
  BRANCH_UPDATE: 'updateBranch',
  BRANCH_DELETE: 'deleteBranch',
  // Reports
  REPORT_SALES: 'getSalesReport',
  REPORT_STOCK: 'getStockReport',
  REPORT_TOP_SELLERS: 'getTopSellersReport',
  EXPORT_ACCOUNTING: 'exportAccountingData',
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
  testDatabaseConnection: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_TEST_CONNECTION, config),
  initializeDb: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_INITIALIZE, config),
  configureDatabase: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_SET_CONFIG, config),

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
  getSyncConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_CONFIG),
  saveSyncConfig: (config: { cloudUrl: string; branchCode: string }) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_SAVE_CONFIG, config),
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
  getAllMedicines: (options?: { limit?: number; includeOutOfStock?: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_GET_ALL, options),
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

  // Sales History APIs
  getAllSales: (options?: { page?: number; limit?: number; search?: string; paymentMethod?: string; startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SALES_GET_ALL, options),
  getSalesStats: () => ipcRenderer.invoke(IPC_CHANNELS.SALES_GET_STATS),
  voidSale: (saleId: string) => ipcRenderer.invoke(IPC_CHANNELS.SALES_VOID, saleId),

  // Customer Management APIs
  getCustomersPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET_ALL_PAGINATED, options),
  getCustomerDetails: (customerId: string) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET_DETAILS, customerId),
  updateCustomer: (customerId: string, data: any) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_UPDATE, customerId, data),
  toggleCustomerStatus: (customerId: string) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_TOGGLE_STATUS, customerId),

  // Inventory Management APIs
  createMedicine: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_CREATE, data),
  updateMedicine: (medicineId: string, data: any) => ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_UPDATE, medicineId, data),
  deleteMedicine: (medicineId: string) => ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_DELETE, medicineId),
  getMedicinesPaginated: (options?: { page?: number; limit?: number; search?: string; category?: string; stockFilter?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_GET_PAGINATED, options),
  adjustStock: (medicineId: string, adjustment: number, reason?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_ADJUST_STOCK, medicineId, adjustment, reason),

  // Suppliers APIs
  getSuppliersPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string; all?: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUPPLIERS_GET_PAGINATED, options),
  createSupplier: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_CREATE, data),
  updateSupplier: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UPDATE, data),
  deleteSupplier: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_DELETE, id),

  // Purchase Orders APIs
  getPurchaseOrdersPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PO_GET_PAGINATED, options),
  getPurchaseOrderById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PO_GET_BY_ID, id),
  createPurchaseOrder: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PO_CREATE, data),
  updatePurchaseOrderStatus: (params: { id: string; status: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PO_UPDATE_STATUS, params),
  deletePurchaseOrder: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PO_DELETE, id),

  // GRN APIs
  getGRNsPaginated: (options?: { page?: number; limit?: number; search?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.GRN_GET_PAGINATED, options),
  getGRNById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GRN_GET_BY_ID, id),
  getPendingPurchaseOrders: () => ipcRenderer.invoke(IPC_CHANNELS.GRN_GET_PENDING_POS),
  createGRN: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.GRN_CREATE, data),

  // Users APIs
  getUsersPaginated: (options?: { page?: number; limit?: number; search?: string; role?: string; status?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.USERS_GET_PAGINATED, options),
  createUser: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.USER_CREATE, data),
  updateUser: (userId: string, data: any) => ipcRenderer.invoke(IPC_CHANNELS.USER_UPDATE, userId, data),
  deleteUser: (userId: string, currentUserId?: string) => ipcRenderer.invoke(IPC_CHANNELS.USER_DELETE, userId, currentUserId),

  // Branches APIs
  getBranchesPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string; all?: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.BRANCHES_GET_PAGINATED, options),
  createBranch: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.BRANCH_CREATE, data),
  updateBranch: (branchId: string, data: any) => ipcRenderer.invoke(IPC_CHANNELS.BRANCH_UPDATE, branchId, data),
  deleteBranch: (branchId: string) => ipcRenderer.invoke(IPC_CHANNELS.BRANCH_DELETE, branchId),

  // Reports APIs
  getSalesReport: (options?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.REPORT_SALES, options),
  getStockReport: (options?: { status?: string; category?: string; search?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.REPORT_STOCK, options),
  getTopSellersReport: (options?: { startDate?: string; endDate?: string; limit?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.REPORT_TOP_SELLERS, options),
  exportAccountingData: (options: { type: string; startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_ACCOUNTING, options),

  // Auto-Update APIs
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getVersionInfo: () => ipcRenderer.invoke('update:get-version'),
  onUpdateStatus: (callback: (data: { status: string; data?: any }) => void) => {
    ipcRenderer.on('update-status', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-status');
  },

  // AI Pharmacist Chat
  chatWithAI: (messages: Array<{ role: string; content: string }>) =>
    ipcRenderer.invoke('ai:chat', messages),
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
  testDatabaseConnection: (config: DatabaseConfig) => Promise<any>;
  initializeDb: (config: DatabaseConfig) => Promise<any>;
  configureDatabase: (config: DatabaseConfig) => Promise<any>;

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
  getSyncConfig: () => Promise<any>;
  saveSyncConfig: (config: { cloudUrl: string; branchCode: string }) => Promise<any>;
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
  getAllMedicines: (options?: { limit?: number; includeOutOfStock?: boolean }) => Promise<any>;
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

  // Sales History
  getAllSales: (options?: { page?: number; limit?: number; search?: string; paymentMethod?: string; startDate?: string; endDate?: string }) => Promise<any>;
  getSalesStats: () => Promise<any>;
  voidSale: (saleId: string) => Promise<any>;

  // Customer Management
  getCustomersPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string }) => Promise<any>;
  getCustomerDetails: (customerId: string) => Promise<any>;
  updateCustomer: (customerId: string, data: any) => Promise<any>;
  toggleCustomerStatus: (customerId: string) => Promise<any>;

  // Inventory Management
  createMedicine: (data: any) => Promise<any>;
  updateMedicine: (medicineId: string, data: any) => Promise<any>;
  deleteMedicine: (medicineId: string) => Promise<any>;
  getMedicinesPaginated: (options?: { page?: number; limit?: number; search?: string; category?: string; stockFilter?: string }) => Promise<any>;
  adjustStock: (medicineId: string, adjustment: number, reason?: string) => Promise<any>;

  // Suppliers
  getSuppliersPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string; all?: boolean }) => Promise<any>;
  createSupplier: (data: any) => Promise<any>;
  updateSupplier: (data: any) => Promise<any>;
  deleteSupplier: (id: string) => Promise<any>;

  // Purchase Orders
  getPurchaseOrdersPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string }) => Promise<any>;
  getPurchaseOrderById: (id: string) => Promise<any>;
  createPurchaseOrder: (data: any) => Promise<any>;
  updatePurchaseOrderStatus: (params: { id: string; status: string }) => Promise<any>;
  deletePurchaseOrder: (id: string) => Promise<any>;

  // GRN
  getGRNsPaginated: (options?: { page?: number; limit?: number; search?: string }) => Promise<any>;
  getGRNById: (id: string) => Promise<any>;
  getPendingPurchaseOrders: () => Promise<any>;
  createGRN: (data: any) => Promise<any>;

  // Users
  getUsersPaginated: (options?: { page?: number; limit?: number; search?: string; role?: string; status?: string }) => Promise<any>;
  createUser: (data: any) => Promise<any>;
  updateUser: (userId: string, data: any) => Promise<any>;
  deleteUser: (userId: string, currentUserId?: string) => Promise<any>;

  // Branches
  getBranchesPaginated: (options?: { page?: number; limit?: number; search?: string; status?: string; all?: boolean }) => Promise<any>;
  createBranch: (data: any) => Promise<any>;
  updateBranch: (branchId: string, data: any) => Promise<any>;
  deleteBranch: (branchId: string) => Promise<any>;

  // Reports
  getSalesReport: (options?: { startDate?: string; endDate?: string; groupBy?: string }) => Promise<any>;
  getStockReport: (options?: { status?: string; category?: string; search?: string }) => Promise<any>;
  getTopSellersReport: (options?: { startDate?: string; endDate?: string; limit?: number }) => Promise<any>;
  exportAccountingData: (options: { type: string; startDate?: string; endDate?: string }) => Promise<any>;

  // Auto-Update
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<any>;
  installUpdate: () => Promise<any>;
  getVersionInfo: () => Promise<{ version: string; name: string }>;
  onUpdateStatus: (callback: (data: { status: string; data?: any }) => void) => () => void;

  // AI Pharmacist Chat
  chatWithAI: (messages: Array<{ role: string; content: string }>) => Promise<{ success: boolean; message?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
