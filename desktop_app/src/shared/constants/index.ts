// App Constants
export const APP_NAME = 'DawaCare POS';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Offline-First Pharmacy Management System';

// Database Constants
export const DEFAULT_SQLITE_DB_NAME = 'dawacare.db';
export const DEFAULT_POSTGRES_DB_NAME = 'dawacare_pos';
export const DEFAULT_POSTGRES_PORT = 5432;

// Sync Constants
export const DEFAULT_SYNC_INTERVAL = 15; // minutes
export const MAX_SYNC_ATTEMPTS = 3;
export const SYNC_BATCH_SIZE = 50;

// Cloud API
export const DEFAULT_CLOUD_API_URL = 'https://dawacare.abacusai.app';

// Window Dimensions
export const MIN_WINDOW_WIDTH = 1024;
export const MIN_WINDOW_HEIGHT = 768;
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;

// User Roles
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  PHARMACIST: 'PHARMACIST',
  CASHIER: 'CASHIER',
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  MPESA: 'MPESA',
  CREDIT: 'CREDIT',
  OTHER: 'OTHER',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  DATABASE_CONFIG: 'database_config',
  AUTH_TOKEN: 'auth_token',
  CURRENT_USER: 'current_user',
  CLOUD_SYNC_ENABLED: 'cloud_sync_enabled',
  THEME: 'theme',
} as const;
