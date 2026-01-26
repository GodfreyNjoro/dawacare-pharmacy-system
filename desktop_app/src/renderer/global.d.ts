// Global type declarations for the renderer process

interface LoginCredentials {
  email: string;
  password: string;
}

interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  connectionString?: string;
  databasePath?: string;
}

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
