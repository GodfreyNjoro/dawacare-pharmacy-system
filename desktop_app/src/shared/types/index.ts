// Database Types
export type DatabaseType = 'sqlite' | 'postgresql';

export interface DatabaseConfig {
  type: DatabaseType;
  connectionString?: string; // For PostgreSQL
  databasePath?: string; // For SQLite
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionString(): string;
  initialize(): Promise<void>;
  runMigrations(): Promise<void>;
}

// User Types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'PHARMACIST' | 'CASHIER';
  status: 'ACTIVE' | 'INACTIVE';
  branchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

// App Settings Types
export interface AppSettings {
  cloudSyncEnabled: boolean;
  cloudApiUrl?: string;
  cloudApiToken?: string;
  autoSyncInterval?: number; // in minutes
  defaultBranchId?: string;
  printerName?: string;
  receiptTemplate?: string;
  theme?: 'light' | 'dark' | 'system';
}

// Sync Types
export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'SYNCED' | 'FAILED';

export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;
  status: SyncStatus;
  attempts: number;
  lastAttemptAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

// IPC Channel Names
export enum IPC_CHANNELS {
  // Auth
  AUTH_LOGIN = 'auth:login',
  AUTH_LOGOUT = 'auth:logout',
  AUTH_GET_CURRENT_USER = 'auth:get-current-user',

  // Database
  DB_GET_CONFIG = 'db:get-config',
  DB_SET_CONFIG = 'db:set-config',
  DB_TEST_CONNECTION = 'db:test-connection',
  DB_INITIALIZE = 'db:initialize',

  // Settings
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',
  SETTINGS_GET_ALL = 'settings:get-all',

  // Sync
  SYNC_START = 'sync:start',
  SYNC_STOP = 'sync:stop',
  SYNC_STATUS = 'sync:status',
  SYNC_MANUAL = 'sync:manual',

  // Window
  WINDOW_MINIMIZE = 'window:minimize',
  WINDOW_MAXIMIZE = 'window:maximize',
  WINDOW_CLOSE = 'window:close',

  // App
  APP_VERSION = 'app:version',
  APP_QUIT = 'app:quit',
}
