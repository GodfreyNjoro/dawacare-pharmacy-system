import { Pool, PoolClient } from 'pg';
import type { DatabaseAdapter } from '../../shared/types';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private connectionString: string;
  private connected: boolean = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    try {
      // Parse connection string for debugging
      console.log('[PostgreSQL] Attempting connection...');
      console.log('[PostgreSQL] Connection string (masked):', this.connectionString.replace(/:[^:@]+@/, ':****@'));
      
      // Parse and use individual parameters for better compatibility
      let host = 'localhost';
      let port = 5432;
      let database = 'dawacare';
      let user = 'postgres';
      let password = '';
      
      try {
        // Convert postgresql:// to http:// for URL parsing (URL class doesn't support postgresql protocol)
        const parseableString = this.connectionString.replace(/^postgresql:\/\//, 'http://');
        const url = new URL(parseableString);
        host = url.hostname || 'localhost';
        port = parseInt(url.port) || 5432;
        database = url.pathname.slice(1) || 'dawacare';
        user = url.username || 'postgres';
        password = decodeURIComponent(url.password || '');
        console.log('[PostgreSQL] Parsed connection - host:', host, 'port:', port, 'database:', database, 'user:', user);
      } catch (parseError) {
        console.log('[PostgreSQL] Could not parse as URL, using connection string directly:', parseError);
      }
      
      console.log('[PostgreSQL] Connecting to:', { host, port, database, user });
      
      this.pool = new Pool({
        host,
        port,
        database,
        user,
        password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test the connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT current_database() as db');
      console.log('[PostgreSQL] Connected to database:', result.rows[0]?.db);
      client.release();
      
      this.connected = true;
      console.log('[PostgreSQL] Connection successful!');
    } catch (error: any) {
      console.error('[PostgreSQL] Connection error:', error);
      console.error('[PostgreSQL] Error code:', error.code);
      console.error('[PostgreSQL] Error detail:', error.detail);
      
      let message = error.message || 'Failed to connect';
      if (error.code === 'ECONNREFUSED') {
        message = 'Connection refused. Make sure PostgreSQL is running. Check Windows Services for "postgresql-x64-XX".';
      } else if (error.code === '28P01' || message.includes('password authentication')) {
        message = 'Authentication failed. Check your postgres password.';
      } else if (error.code === '3D000' || message.includes('does not exist')) {
        message = `Database "${error.message.match(/"([^"]+)"/)?.[1] || 'unknown'}" does not exist. Verify the exact database name in pgAdmin (case-sensitive).`;
      } else if (error.code === 'ENOTFOUND') {
        message = 'Host not found. Check the hostname.';
      } else if (error.code === 'ETIMEDOUT') {
        message = 'Connection timed out. Check if PostgreSQL is accepting connections on the specified host/port.';
      }
      throw new Error(`Failed to connect to PostgreSQL database: ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      console.log('[PostgreSQL] Disconnected from database');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionString(): string {
    return this.connectionString;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[PostgreSQL] Initializing database...');
      await this.createTablesIfNotExist();
      await this.seedDefaultData();
      console.log('[PostgreSQL] Database initialized successfully');
    } catch (error) {
      console.error('[PostgreSQL] Initialization error:', error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    // Migrations handled in createTablesIfNotExist
  }

  private async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error('Database not connected');
    const result = await this.pool.query(sql, params);
    return result;
  }

  private async createTablesIfNotExist(): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');

    try {
      // Check if tables exist
      const tableCheck = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'User'
        )
      `);

      if (tableCheck.rows[0].exists) {
        console.log('[PostgreSQL] Tables already exist');
        return;
      }

      console.log('[PostgreSQL] Creating tables...');

      // Create all tables
      await this.query(`
        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT PRIMARY KEY,
          "email" TEXT UNIQUE NOT NULL,
          "name" TEXT,
          "password" TEXT NOT NULL,
          "role" TEXT DEFAULT 'CASHIER',
          "status" TEXT DEFAULT 'ACTIVE',
          "branchId" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "lastSyncedAt" TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "Branch" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "code" TEXT UNIQUE NOT NULL,
          "address" TEXT,
          "phone" TEXT,
          "email" TEXT,
          "isMainBranch" BOOLEAN DEFAULT FALSE,
          "status" TEXT DEFAULT 'ACTIVE',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "lastSyncedAt" TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "Medicine" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "genericName" TEXT,
          "manufacturer" TEXT,
          "batchNumber" TEXT NOT NULL,
          "expiryDate" TIMESTAMP NOT NULL,
          "quantity" INTEGER NOT NULL,
          "reorderLevel" INTEGER DEFAULT 10,
          "unitPrice" DOUBLE PRECISION NOT NULL,
          "category" TEXT NOT NULL,
          "branchId" TEXT,
          "syncStatus" TEXT DEFAULT 'LOCAL',
          "lastSyncedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "Customer" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "phone" TEXT UNIQUE NOT NULL,
          "email" TEXT,
          "address" TEXT,
          "dateOfBirth" TIMESTAMP,
          "gender" TEXT,
          "loyaltyPoints" INTEGER DEFAULT 0,
          "creditBalance" DOUBLE PRECISION DEFAULT 0,
          "creditLimit" DOUBLE PRECISION DEFAULT 0,
          "status" TEXT DEFAULT 'ACTIVE',
          "notes" TEXT,
          "syncStatus" TEXT DEFAULT 'LOCAL',
          "lastSyncedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "Sale" (
          "id" TEXT PRIMARY KEY,
          "invoiceNumber" TEXT UNIQUE NOT NULL,
          "customerId" TEXT,
          "customerName" TEXT,
          "customerPhone" TEXT,
          "subtotal" DOUBLE PRECISION NOT NULL,
          "discount" DOUBLE PRECISION DEFAULT 0,
          "loyaltyPointsUsed" INTEGER DEFAULT 0,
          "loyaltyPointsEarned" INTEGER DEFAULT 0,
          "total" DOUBLE PRECISION NOT NULL,
          "paymentMethod" TEXT NOT NULL,
          "paymentStatus" TEXT DEFAULT 'PAID',
          "notes" TEXT,
          "soldBy" TEXT,
          "branchId" TEXT,
          "syncStatus" TEXT DEFAULT 'PENDING',
          "lastSyncedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "SaleItem" (
          "id" TEXT PRIMARY KEY,
          "saleId" TEXT NOT NULL REFERENCES "Sale"("id") ON DELETE CASCADE,
          "medicineId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "unitPrice" DOUBLE PRECISION NOT NULL,
          "total" DOUBLE PRECISION NOT NULL
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "Supplier" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "contactPerson" TEXT,
          "email" TEXT,
          "phone" TEXT,
          "address" TEXT,
          "status" TEXT DEFAULT 'ACTIVE',
          "lastSyncedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
          "id" TEXT PRIMARY KEY,
          "poNumber" TEXT UNIQUE NOT NULL,
          "supplierId" TEXT NOT NULL REFERENCES "Supplier"("id"),
          "status" TEXT DEFAULT 'DRAFT',
          "subtotal" DOUBLE PRECISION NOT NULL,
          "tax" DOUBLE PRECISION DEFAULT 0,
          "total" DOUBLE PRECISION NOT NULL,
          "notes" TEXT,
          "expectedDate" TIMESTAMP,
          "createdBy" TEXT,
          "branchId" TEXT,
          "lastSyncedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
          "id" TEXT PRIMARY KEY,
          "purchaseOrderId" TEXT NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE,
          "medicineName" TEXT NOT NULL,
          "genericName" TEXT,
          "quantity" INTEGER NOT NULL,
          "receivedQty" INTEGER DEFAULT 0,
          "unitCost" DOUBLE PRECISION NOT NULL,
          "total" DOUBLE PRECISION NOT NULL,
          "category" TEXT
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "GoodsReceivedNote" (
          "id" TEXT PRIMARY KEY,
          "grnNumber" TEXT UNIQUE NOT NULL,
          "purchaseOrderId" TEXT NOT NULL REFERENCES "PurchaseOrder"("id"),
          "receivedDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "receivedBy" TEXT,
          "notes" TEXT,
          "status" TEXT DEFAULT 'RECEIVED',
          "branchId" TEXT,
          "lastSyncedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "GRNItem" (
          "id" TEXT PRIMARY KEY,
          "grnId" TEXT NOT NULL REFERENCES "GoodsReceivedNote"("id") ON DELETE CASCADE,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "expiryDate" TIMESTAMP NOT NULL,
          "quantityReceived" INTEGER NOT NULL,
          "unitCost" DOUBLE PRECISION NOT NULL,
          "total" DOUBLE PRECISION NOT NULL,
          "addedToInventory" BOOLEAN DEFAULT FALSE
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL REFERENCES "Customer"("id"),
          "type" TEXT NOT NULL,
          "points" INTEGER NOT NULL,
          "saleId" TEXT,
          "description" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "CreditTransaction" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL REFERENCES "Customer"("id"),
          "type" TEXT NOT NULL,
          "amount" DOUBLE PRECISION NOT NULL,
          "saleId" TEXT,
          "description" TEXT,
          "createdBy" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "StockTransfer" (
          "id" TEXT PRIMARY KEY,
          "transferNumber" TEXT UNIQUE NOT NULL,
          "fromBranchId" TEXT NOT NULL,
          "toBranchId" TEXT NOT NULL,
          "status" TEXT DEFAULT 'PENDING',
          "notes" TEXT,
          "createdBy" TEXT,
          "completedBy" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "completedAt" TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "StockTransferItem" (
          "id" TEXT PRIMARY KEY,
          "transferId" TEXT NOT NULL REFERENCES "StockTransfer"("id") ON DELETE CASCADE,
          "medicineId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "unitPrice" DOUBLE PRECISION NOT NULL
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "AccountMapping" (
          "id" TEXT PRIMARY KEY,
          "accountType" TEXT NOT NULL,
          "accountCode" TEXT NOT NULL,
          "accountName" TEXT NOT NULL,
          "description" TEXT,
          "tallyLedger" TEXT,
          "sageLedger" TEXT,
          "isActive" BOOLEAN DEFAULT TRUE,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "ExportHistory" (
          "id" TEXT PRIMARY KEY,
          "exportType" TEXT NOT NULL,
          "format" TEXT NOT NULL,
          "dateFrom" TIMESTAMP NOT NULL,
          "dateTo" TIMESTAMP NOT NULL,
          "recordCount" INTEGER DEFAULT 0,
          "fileName" TEXT NOT NULL,
          "fileSize" INTEGER,
          "status" TEXT DEFAULT 'COMPLETED',
          "errorMessage" TEXT,
          "exportedBy" TEXT,
          "branchId" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "SyncQueue" (
          "id" TEXT PRIMARY KEY,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "operation" TEXT NOT NULL,
          "payload" TEXT NOT NULL,
          "status" TEXT DEFAULT 'PENDING',
          "attempts" INTEGER DEFAULT 0,
          "lastAttemptAt" TIMESTAMP,
          "errorMessage" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS "AppSettings" (
          "id" TEXT PRIMARY KEY,
          "key" TEXT UNIQUE NOT NULL,
          "value" TEXT NOT NULL,
          "description" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      await this.query(`CREATE INDEX IF NOT EXISTS "idx_user_email" ON "User"("email")`);
      await this.query(`CREATE INDEX IF NOT EXISTS "idx_user_role" ON "User"("role")`);
      await this.query(`CREATE INDEX IF NOT EXISTS "idx_medicine_name" ON "Medicine"("name")`);
      await this.query(`CREATE INDEX IF NOT EXISTS "idx_medicine_category" ON "Medicine"("category")`);
      await this.query(`CREATE INDEX IF NOT EXISTS "idx_customer_phone" ON "Customer"("phone")`);
      await this.query(`CREATE INDEX IF NOT EXISTS "idx_sale_invoice" ON "Sale"("invoiceNumber")`);
      await this.query(`CREATE INDEX IF NOT EXISTS "idx_sale_created" ON "Sale"("createdAt")`);

      console.log('[PostgreSQL] All tables created successfully');
    } catch (error) {
      console.error('[PostgreSQL] Error creating tables:', error);
      throw error;
    }
  }

  private async seedDefaultData(): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');

    try {
      // Check if default admin user exists
      const adminResult = await this.query(`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1`);

      if (adminResult.rows.length === 0) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const id = `user_${Date.now()}_admin`;

        await this.query(
          `INSERT INTO "User" ("id", "email", "name", "password", "role", "status") VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, 'admin@dawacare.local', 'System Administrator', hashedPassword, 'ADMIN', 'ACTIVE']
        );

        console.log('[PostgreSQL] Default admin user created');
      }

      // Create default branch if none exists
      const branchResult = await this.query(`SELECT COUNT(*) as count FROM "Branch"`);
      const branchCount = parseInt(branchResult.rows[0].count, 10);
      
      if (branchCount === 0) {
        const branchId = `branch_${Date.now()}_main`;
        await this.query(
          `INSERT INTO "Branch" ("id", "name", "code", "isMainBranch", "status") VALUES ($1, $2, $3, $4, $5)`,
          [branchId, 'Main Branch', 'MAIN', true, 'ACTIVE']
        );

        console.log('[PostgreSQL] Default branch created');
      }

      // Create default app settings
      const settingsResult = await this.query(`SELECT COUNT(*) as count FROM "AppSettings"`);
      const settingsCount = parseInt(settingsResult.rows[0].count, 10);
      
      if (settingsCount === 0) {
        await this.query(
          `INSERT INTO "AppSettings" ("id", "key", "value", "description") VALUES ($1, $2, $3, $4)`,
          ['setting_1', 'cloud_sync_enabled', 'false', 'Enable cloud synchronization']
        );
        await this.query(
          `INSERT INTO "AppSettings" ("id", "key", "value", "description") VALUES ($1, $2, $3, $4)`,
          ['setting_2', 'theme', 'light', 'Application theme']
        );
        await this.query(
          `INSERT INTO "AppSettings" ("id", "key", "value", "description") VALUES ($1, $2, $3, $4)`,
          ['setting_3', 'auto_sync_interval', '15', 'Auto sync interval in minutes']
        );

        console.log('[PostgreSQL] Default settings created');
      }
    } catch (error) {
      console.error('[PostgreSQL] Error seeding default data:', error);
      throw error;
    }
  }

  // Expose pool for handlers to use
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  // For compatibility with existing code that expects Prisma-like interface
  getPrismaClient(): PostgreSQLQueryInterface {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return new PostgreSQLQueryInterface(this.pool);
  }
}

// Prisma-like query interface for PostgreSQL
export class PostgreSQLQueryInterface {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Generic query method
  async $queryRaw(sql: string, ...params: any[]): Promise<any[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async $executeRaw(sql: string, ...params: any[]): Promise<number> {
    const result = await this.pool.query(sql, params);
    return result.rowCount || 0;
  }

  // User model
  get user() {
    return new PostgreSQLModel(this.pool, 'User');
  }

  // Branch model  
  get branch() {
    return new PostgreSQLModel(this.pool, 'Branch');
  }

  // Medicine model
  get medicine() {
    return new PostgreSQLModel(this.pool, 'Medicine');
  }

  // Customer model
  get customer() {
    return new PostgreSQLModel(this.pool, 'Customer');
  }

  // Sale model
  get sale() {
    return new PostgreSQLModel(this.pool, 'Sale');
  }

  // SaleItem model
  get saleItem() {
    return new PostgreSQLModel(this.pool, 'SaleItem');
  }

  // Supplier model
  get supplier() {
    return new PostgreSQLModel(this.pool, 'Supplier');
  }

  // PurchaseOrder model
  get purchaseOrder() {
    return new PostgreSQLModel(this.pool, 'PurchaseOrder');
  }

  // PurchaseOrderItem model
  get purchaseOrderItem() {
    return new PostgreSQLModel(this.pool, 'PurchaseOrderItem');
  }

  // GoodsReceivedNote model
  get goodsReceivedNote() {
    return new PostgreSQLModel(this.pool, 'GoodsReceivedNote');
  }

  // GRNItem model
  get gRNItem() {
    return new PostgreSQLModel(this.pool, 'GRNItem');
  }

  // AppSettings model
  get appSettings() {
    return new PostgreSQLModel(this.pool, 'AppSettings');
  }

  // SyncQueue model
  get syncQueue() {
    return new PostgreSQLModel(this.pool, 'SyncQueue');
  }

  // Transaction support
  async $transaction<T>(
    callback: (tx: PostgreSQLQueryInterface) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      // Create transaction client with same interface
      const txInterface = new PostgreSQLTransactionClient(client);
      
      // Execute callback
      const result = await callback(txInterface as any);
      
      // Commit transaction
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  }
}

// Transaction client - similar to PostgreSQLQueryInterface but uses a specific client
class PostgreSQLTransactionClient {
  private client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  // Generic query methods
  async $queryRaw(sql: string, ...params: any[]): Promise<any[]> {
    const result = await this.client.query(sql, params);
    return result.rows;
  }

  async $executeRaw(sql: string, ...params: any[]): Promise<number> {
    const result = await this.client.query(sql, params);
    return result.rowCount || 0;
  }

  // User model
  get user() {
    return new PostgreSQLTransactionModel(this.client, 'User');
  }

  // Branch model  
  get branch() {
    return new PostgreSQLTransactionModel(this.client, 'Branch');
  }

  // Medicine model
  get medicine() {
    return new PostgreSQLTransactionModel(this.client, 'Medicine');
  }

  // Customer model
  get customer() {
    return new PostgreSQLTransactionModel(this.client, 'Customer');
  }

  // Sale model
  get sale() {
    return new PostgreSQLTransactionModel(this.client, 'Sale');
  }

  // SaleItem model
  get saleItem() {
    return new PostgreSQLTransactionModel(this.client, 'SaleItem');
  }

  // Supplier model
  get supplier() {
    return new PostgreSQLTransactionModel(this.client, 'Supplier');
  }

  // PurchaseOrder model
  get purchaseOrder() {
    return new PostgreSQLTransactionModel(this.client, 'PurchaseOrder');
  }

  // PurchaseOrderItem model
  get purchaseOrderItem() {
    return new PostgreSQLTransactionModel(this.client, 'PurchaseOrderItem');
  }

  // GoodsReceivedNote model
  get goodsReceivedNote() {
    return new PostgreSQLTransactionModel(this.client, 'GoodsReceivedNote');
  }

  // GRNItem model
  get gRNItem() {
    return new PostgreSQLTransactionModel(this.client, 'GRNItem');
  }

  // AppSettings model
  get appSettings() {
    return new PostgreSQLTransactionModel(this.client, 'AppSettings');
  }

  // SyncQueue model
  get syncQueue() {
    return new PostgreSQLTransactionModel(this.client, 'SyncQueue');
  }
}

// Simple Prisma-like model interface
class PostgreSQLModel {
  private pool: Pool;
  private tableName: string;

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  // Helper method to build WHERE clause with support for OR, AND, operators
  private buildWhereClause(
    where: Record<string, any>,
    params: any[],
    paramIndex: number
  ): { conditions: string | null; newParamIndex: number } {
    const andConditions: string[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (value === undefined || value === null) continue;

      // Handle OR conditions: { OR: [{ name: { contains: 'x' } }, { code: { contains: 'x' } }] }
      if (key === 'OR' && Array.isArray(value)) {
        const orParts: string[] = [];
        for (const orCondition of value) {
          const { conditions: subCond, newParamIndex: newIdx } = this.buildWhereClause(orCondition, params, paramIndex);
          paramIndex = newIdx;
          if (subCond) {
            orParts.push(`(${subCond})`);
          }
        }
        if (orParts.length > 0) {
          andConditions.push(`(${orParts.join(' OR ')})`);
        }
        continue;
      }

      // Handle AND conditions: { AND: [{ ... }, { ... }] }
      if (key === 'AND' && Array.isArray(value)) {
        const andParts: string[] = [];
        for (const andCondition of value) {
          const { conditions: subCond, newParamIndex: newIdx } = this.buildWhereClause(andCondition, params, paramIndex);
          paramIndex = newIdx;
          if (subCond) {
            andParts.push(`(${subCond})`);
          }
        }
        if (andParts.length > 0) {
          andConditions.push(`(${andParts.join(' AND ')})`);
        }
        continue;
      }

      // Handle NOT conditions
      if (key === 'NOT') {
        const { conditions: subCond, newParamIndex: newIdx } = this.buildWhereClause(value, params, paramIndex);
        paramIndex = newIdx;
        if (subCond) {
          andConditions.push(`NOT (${subCond})`);
        }
        continue;
      }

      // Handle object values (operators or nested relations)
      if (typeof value === 'object' && !Array.isArray(value)) {
        const operators = ['gte', 'lte', 'gt', 'lt', 'contains', 'startsWith', 'endsWith', 'equals', 'not', 'in', 'notIn'];
        const hasOperator = Object.keys(value).some(k => operators.includes(k));
        
        if (hasOperator) {
          for (const [op, opValue] of Object.entries(value)) {
            if (op === 'contains') {
              andConditions.push(`"${key}" ILIKE $${paramIndex++}`);
              params.push(`%${opValue}%`);
            } else if (op === 'startsWith') {
              andConditions.push(`"${key}" ILIKE $${paramIndex++}`);
              params.push(`${opValue}%`);
            } else if (op === 'endsWith') {
              andConditions.push(`"${key}" ILIKE $${paramIndex++}`);
              params.push(`%${opValue}`);
            } else if (op === 'gte') {
              andConditions.push(`"${key}" >= $${paramIndex++}`);
              params.push(opValue);
            } else if (op === 'lte') {
              andConditions.push(`"${key}" <= $${paramIndex++}`);
              params.push(opValue);
            } else if (op === 'gt') {
              andConditions.push(`"${key}" > $${paramIndex++}`);
              params.push(opValue);
            } else if (op === 'lt') {
              andConditions.push(`"${key}" < $${paramIndex++}`);
              params.push(opValue);
            } else if (op === 'equals') {
              andConditions.push(`"${key}" = $${paramIndex++}`);
              params.push(opValue);
            } else if (op === 'not') {
              andConditions.push(`"${key}" != $${paramIndex++}`);
              params.push(opValue);
            } else if (op === 'in' && Array.isArray(opValue)) {
              const placeholders = opValue.map(() => `$${paramIndex++}`).join(', ');
              andConditions.push(`"${key}" IN (${placeholders})`);
              params.push(...opValue);
            } else if (op === 'notIn' && Array.isArray(opValue)) {
              const placeholders = opValue.map(() => `$${paramIndex++}`).join(', ');
              andConditions.push(`"${key}" NOT IN (${placeholders})`);
              params.push(...opValue);
            }
          }
        }
        // Skip nested relation conditions (like supplier: { name: ... })
        continue;
      }

      // Handle array values (IN clause)
      if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
        andConditions.push(`"${key}" IN (${placeholders})`);
        params.push(...value);
        continue;
      }

      // Simple equality
      andConditions.push(`"${key}" = $${paramIndex++}`);
      params.push(value);
    }

    return {
      conditions: andConditions.length > 0 ? andConditions.join(' AND ') : null,
      newParamIndex: paramIndex,
    };
  }

  async findMany(options?: {
    where?: Record<string, any>;
    orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
    take?: number;
    skip?: number;
    include?: Record<string, boolean | object>;
  }): Promise<any[]> {
    let sql = `SELECT * FROM "${this.tableName}"`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.where) {
      const { conditions, newParamIndex } = this.buildWhereClause(options.where, params, paramIndex);
      paramIndex = newParamIndex;
      if (conditions) {
        sql += ` WHERE ${conditions}`;
      }
    }

    if (options?.orderBy) {
      const orderParts: string[] = [];
      const orderByArray = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      for (const order of orderByArray) {
        for (const [key, dir] of Object.entries(order)) {
          orderParts.push(`"${key}" ${dir.toUpperCase()}`);
        }
      }
      if (orderParts.length > 0) {
        sql += ` ORDER BY ${orderParts.join(', ')}`;
      }
    }

    if (options?.take) {
      sql += ` LIMIT ${options.take}`;
    }

    if (options?.skip) {
      sql += ` OFFSET ${options.skip}`;
    }

    const result = await this.pool.query(sql, params);
    let records = result.rows;
    
    // Handle includes
    if (options?.include && records.length > 0) {
      records = await this.loadIncludes(records, options.include);
    }
    
    return records;
  }
  
  private async loadIncludes(records: any[], include: Record<string, boolean | object>): Promise<any[]> {
    const relationMappings: Record<string, Record<string, { table: string; foreignKey: string; type: 'many' | 'one' }>> = {
      'PurchaseOrder': {
        'supplier': { table: 'Supplier', foreignKey: 'supplierId', type: 'one' },
        'items': { table: 'PurchaseOrderItem', foreignKey: 'purchaseOrderId', type: 'many' },
        'grns': { table: 'GoodsReceivedNote', foreignKey: 'purchaseOrderId', type: 'many' },
      },
      'Sale': {
        'items': { table: 'SaleItem', foreignKey: 'saleId', type: 'many' },
        'customer': { table: 'Customer', foreignKey: 'customerId', type: 'one' },
      },
      'GoodsReceivedNote': {
        'purchaseOrder': { table: 'PurchaseOrder', foreignKey: 'purchaseOrderId', type: 'one' },
        'items': { table: 'GRNItem', foreignKey: 'grnId', type: 'many' },
      },
      'User': {
        'branch': { table: 'Branch', foreignKey: 'branchId', type: 'one' },
      },
      'StockTransfer': {
        'items': { table: 'StockTransferItem', foreignKey: 'transferId', type: 'many' },
        'fromBranch': { table: 'Branch', foreignKey: 'fromBranchId', type: 'one' },
        'toBranch': { table: 'Branch', foreignKey: 'toBranchId', type: 'one' },
      },
    };
    
    const tableRelations = relationMappings[this.tableName] || {};
    
    for (const [relationName, includeValue] of Object.entries(include)) {
      if (!includeValue) continue;
      
      const relation = tableRelations[relationName];
      if (!relation) continue;
      
      if (relation.type === 'many') {
        // Fetch related records for all main records
        const ids = records.map(r => r.id);
        if (ids.length === 0) continue;
        
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const relSql = `SELECT * FROM "${relation.table}" WHERE "${relation.foreignKey}" IN (${placeholders})`;
        const relResult = await this.pool.query(relSql, ids);
        
        // Group by foreign key
        const groupedItems: Record<string, any[]> = {};
        for (const item of relResult.rows) {
          const fkValue = item[relation.foreignKey];
          if (!groupedItems[fkValue]) groupedItems[fkValue] = [];
          groupedItems[fkValue].push(item);
        }
        
        // Attach to records
        for (const record of records) {
          record[relationName] = groupedItems[record.id] || [];
        }
      } else if (relation.type === 'one') {
        // Fetch related single records
        const fkValues = [...new Set(records.map(r => r[relation.foreignKey]).filter(Boolean))];
        if (fkValues.length === 0) {
          for (const record of records) {
            record[relationName] = null;
          }
          continue;
        }
        
        const placeholders = fkValues.map((_, i) => `$${i + 1}`).join(', ');
        const relSql = `SELECT * FROM "${relation.table}" WHERE "id" IN (${placeholders})`;
        const relResult = await this.pool.query(relSql, fkValues);
        
        // Create lookup map
        const lookup: Record<string, any> = {};
        for (const item of relResult.rows) {
          lookup[item.id] = item;
        }
        
        // Attach to records
        for (const record of records) {
          record[relationName] = lookup[record[relation.foreignKey]] || null;
        }
      }
    }
    
    return records;
  }

  async findFirst(options?: {
    where?: Record<string, any>;
    include?: Record<string, boolean | object>;
  }): Promise<any | null> {
    const results = await this.findMany({ ...options, take: 1 });
    return results[0] || null;
  }

  async findUnique(options: {
    where: Record<string, any>;
    include?: Record<string, boolean | object>;
  }): Promise<any | null> {
    return this.findFirst(options);
  }

  async create(options: {
    data: Record<string, any>;
    include?: Record<string, boolean | object>;
  }): Promise<any> {
    const { data, include } = options;
    
    // Separate nested creates from regular fields
    const regularData: Record<string, any> = {};
    const nestedCreates: { field: string; items: any[]; foreignKey: string }[] = [];
    
    // Map of relation field names to their table and foreign key
    const relationMappings: Record<string, { table: string; foreignKey: string }> = {
      items: { table: this.getItemsTable(), foreignKey: this.getForeignKey() },
      saleItems: { table: 'SaleItem', foreignKey: 'saleId' },
    };
    
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.create) {
        // This is a nested create
        const mapping = relationMappings[key];
        if (mapping) {
          const createData = Array.isArray(value.create) ? value.create : [value.create];
          nestedCreates.push({
            field: key,
            items: createData,
            foreignKey: mapping.foreignKey,
          });
        }
      } else if (value !== undefined) {
        regularData[key] = value;
      }
    }
    
    // Insert the main record
    const keys = Object.keys(regularData);
    const values = Object.values(regularData);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO "${this.tableName}" ("${keys.join('", "')}") VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await this.pool.query(sql, values);
    const mainRecord = result.rows[0];
    
    // Handle nested creates
    for (const nested of nestedCreates) {
      const itemsTable = this.getItemsTableForField(nested.field);
      const createdItems: any[] = [];
      
      for (const item of nested.items) {
        const itemData = { ...item, [nested.foreignKey]: mainRecord.id };
        const itemKeys = Object.keys(itemData);
        const itemValues = Object.values(itemData);
        const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`);
        
        const itemSql = `INSERT INTO "${itemsTable}" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders.join(', ')}) RETURNING *`;
        const itemResult = await this.pool.query(itemSql, itemValues);
        createdItems.push(itemResult.rows[0]);
      }
      
      mainRecord[nested.field] = createdItems;
    }
    
    return mainRecord;
  }
  
  private getItemsTable(): string {
    const tableToItems: Record<string, string> = {
      'PurchaseOrder': 'PurchaseOrderItem',
      'Sale': 'SaleItem',
      'GoodsReceivedNote': 'GRNItem',
      'StockTransfer': 'StockTransferItem',
    };
    return tableToItems[this.tableName] || `${this.tableName}Item`;
  }
  
  private getForeignKey(): string {
    const tableToFK: Record<string, string> = {
      'PurchaseOrder': 'purchaseOrderId',
      'Sale': 'saleId',
      'GoodsReceivedNote': 'grnId',
      'StockTransfer': 'transferId',
    };
    return tableToFK[this.tableName] || `${this.tableName.charAt(0).toLowerCase() + this.tableName.slice(1)}Id`;
  }
  
  private getItemsTableForField(field: string): string {
    const fieldToTable: Record<string, string> = {
      'items': this.getItemsTable(),
      'saleItems': 'SaleItem',
    };
    return fieldToTable[field] || this.getItemsTable();
  }

  async update(options: {
    where: Record<string, any>;
    data: Record<string, any>;
  }): Promise<any> {
    const { where, data } = options;
    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Handle Prisma operators like increment, decrement
        if ('increment' in value) {
          setParts.push(`"${key}" = "${key}" + $${paramIndex++}`);
          params.push(value.increment);
        } else if ('decrement' in value) {
          setParts.push(`"${key}" = "${key}" - $${paramIndex++}`);
          params.push(value.decrement);
        } else if ('multiply' in value) {
          setParts.push(`"${key}" = "${key}" * $${paramIndex++}`);
          params.push(value.multiply);
        } else if ('divide' in value) {
          setParts.push(`"${key}" = "${key}" / $${paramIndex++}`);
          params.push(value.divide);
        } else if ('set' in value) {
          setParts.push(`"${key}" = $${paramIndex++}`);
          params.push(value.set);
        } else {
          // Regular object value (like JSON)
          setParts.push(`"${key}" = $${paramIndex++}`);
          params.push(JSON.stringify(value));
        }
      } else {
        setParts.push(`"${key}" = $${paramIndex++}`);
        params.push(value);
      }
    }

    const whereParts: string[] = [];
    for (const [key, value] of Object.entries(where)) {
      whereParts.push(`"${key}" = $${paramIndex++}`);
      params.push(value);
    }

    const sql = `UPDATE "${this.tableName}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0];
  }

  async delete(options: {
    where: Record<string, any>;
  }): Promise<any> {
    const { where } = options;
    const whereParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
      whereParts.push(`"${key}" = $${paramIndex++}`);
      params.push(value);
    }

    const sql = `DELETE FROM "${this.tableName}" WHERE ${whereParts.join(' AND ')} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0];
  }
  
  async deleteMany(options: {
    where: Record<string, any>;
  }): Promise<{ count: number }> {
    const { where } = options;
    const whereParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
      whereParts.push(`"${key}" = $${paramIndex++}`);
      params.push(value);
    }

    const sql = `DELETE FROM "${this.tableName}" WHERE ${whereParts.join(' AND ')}`;
    const result = await this.pool.query(sql, params);
    return { count: result.rowCount || 0 };
  }
  
  async upsert(options: {
    where: Record<string, any>;
    create: Record<string, any>;
    update: Record<string, any>;
  }): Promise<any> {
    const { where, create, update } = options;
    
    // Try to find existing record
    const existing = await this.findFirst({ where });
    
    if (existing) {
      // Update existing record
      return this.update({ where, data: update });
    } else {
      // Create new record
      return this.create({ data: create });
    }
  }
  
  async updateMany(options: {
    where: Record<string, any>;
    data: Record<string, any>;
  }): Promise<{ count: number }> {
    const { where, data } = options;
    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Handle Prisma operators like increment, decrement
        if ('increment' in value) {
          setParts.push(`"${key}" = "${key}" + $${paramIndex++}`);
          params.push(value.increment);
        } else if ('decrement' in value) {
          setParts.push(`"${key}" = "${key}" - $${paramIndex++}`);
          params.push(value.decrement);
        } else if ('set' in value) {
          setParts.push(`"${key}" = $${paramIndex++}`);
          params.push(value.set);
        } else {
          setParts.push(`"${key}" = $${paramIndex++}`);
          params.push(JSON.stringify(value));
        }
      } else {
        setParts.push(`"${key}" = $${paramIndex++}`);
        params.push(value);
      }
    }

    const whereParts: string[] = [];
    for (const [key, value] of Object.entries(where)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [op, opValue] of Object.entries(value)) {
          if (op === 'gte') {
            whereParts.push(`"${key}" >= $${paramIndex++}`);
            params.push(opValue);
          } else if (op === 'lte') {
            whereParts.push(`"${key}" <= $${paramIndex++}`);
            params.push(opValue);
          }
        }
      } else {
        whereParts.push(`"${key}" = $${paramIndex++}`);
        params.push(value);
      }
    }

    const sql = `UPDATE "${this.tableName}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`;
    const result = await this.pool.query(sql, params);
    return { count: result.rowCount || 0 };
  }

  async count(options?: {
    where?: Record<string, any>;
  }): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.where) {
      const { conditions } = this.buildWhereClause(options.where, params, paramIndex);
      if (conditions) {
        sql += ` WHERE ${conditions}`;
      }
    }

    const result = await this.pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  async aggregate(options: {
    where?: Record<string, any>;
    _sum?: Record<string, boolean>;
    _count?: boolean | Record<string, boolean>;
    _avg?: Record<string, boolean>;
    _min?: Record<string, boolean>;
    _max?: Record<string, boolean>;
  }): Promise<any> {
    const selectParts: string[] = [];
    
    // Handle _sum
    if (options._sum) {
      for (const [field, include] of Object.entries(options._sum)) {
        if (include) {
          selectParts.push(`COALESCE(SUM("${field}"), 0) as "_sum_${field}"`);
        }
      }
    }
    
    // Handle _count
    if (options._count === true) {
      selectParts.push(`COUNT(*) as "_count"`);
    } else if (typeof options._count === 'object') {
      for (const [field, include] of Object.entries(options._count)) {
        if (include) {
          selectParts.push(`COUNT("${field}") as "_count_${field}"`);
        }
      }
    }
    
    // Handle _avg
    if (options._avg) {
      for (const [field, include] of Object.entries(options._avg)) {
        if (include) {
          selectParts.push(`AVG("${field}") as "_avg_${field}"`);
        }
      }
    }
    
    // Handle _min
    if (options._min) {
      for (const [field, include] of Object.entries(options._min)) {
        if (include) {
          selectParts.push(`MIN("${field}") as "_min_${field}"`);
        }
      }
    }
    
    // Handle _max
    if (options._max) {
      for (const [field, include] of Object.entries(options._max)) {
        if (include) {
          selectParts.push(`MAX("${field}") as "_max_${field}"`);
        }
      }
    }
    
    if (selectParts.length === 0) {
      selectParts.push('COUNT(*) as "_count"');
    }
    
    let sql = `SELECT ${selectParts.join(', ')} FROM "${this.tableName}"`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options.where) {
      const { conditions } = this.buildWhereClause(options.where, params, paramIndex);
      if (conditions) {
        sql += ` WHERE ${conditions}`;
      }
    }

    const result = await this.pool.query(sql, params);
    const row = result.rows[0];
    
    // Transform result to Prisma format
    const response: any = {};
    
    if (options._sum) {
      response._sum = {};
      for (const field of Object.keys(options._sum)) {
        response._sum[field] = parseFloat(row[`_sum_${field}`]) || 0;
      }
    }
    
    if (options._count === true) {
      response._count = parseInt(row['_count'], 10) || 0;
    } else if (typeof options._count === 'object') {
      response._count = {};
      for (const field of Object.keys(options._count)) {
        response._count[field] = parseInt(row[`_count_${field}`], 10) || 0;
      }
    }
    
    if (options._avg) {
      response._avg = {};
      for (const field of Object.keys(options._avg)) {
        response._avg[field] = parseFloat(row[`_avg_${field}`]) || null;
      }
    }
    
    if (options._min) {
      response._min = {};
      for (const field of Object.keys(options._min)) {
        response._min[field] = row[`_min_${field}`];
      }
    }
    
    if (options._max) {
      response._max = {};
      for (const field of Object.keys(options._max)) {
        response._max[field] = row[`_max_${field}`];
      }
    }
    
    return response;
  }

  async groupBy(options: {
    by: string[];
    where?: Record<string, any>;
    _sum?: Record<string, boolean>;
    _count?: boolean | Record<string, boolean>;
    orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
    take?: number;
  }): Promise<any[]> {
    const selectParts: string[] = [...options.by.map(f => `"${f}"`)];
    
    if (options._sum) {
      for (const [field, include] of Object.entries(options._sum)) {
        if (include) {
          selectParts.push(`COALESCE(SUM("${field}"), 0) as "_sum_${field}"`);
        }
      }
    }
    
    if (options._count === true) {
      selectParts.push(`COUNT(*) as "_count"`);
    }
    
    let sql = `SELECT ${selectParts.join(', ')} FROM "${this.tableName}"`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options.where) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(options.where)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && value !== null) {
            for (const [op, opValue] of Object.entries(value)) {
              if (op === 'gte') {
                conditions.push(`"${key}" >= $${paramIndex++}`);
                params.push(opValue);
              } else if (op === 'lte') {
                conditions.push(`"${key}" <= $${paramIndex++}`);
                params.push(opValue);
              }
            }
          } else {
            conditions.push(`"${key}" = $${paramIndex++}`);
            params.push(value);
          }
        }
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    sql += ` GROUP BY ${options.by.map(f => `"${f}"`).join(', ')}`;
    
    if (options.orderBy) {
      const orderParts: string[] = [];
      const orderByArray = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      for (const order of orderByArray) {
        for (const [key, dir] of Object.entries(order)) {
          if (key.startsWith('_sum')) {
            const field = key.replace('_sum', '').replace(/^\./, '');
            orderParts.push(`"_sum_${field}" ${dir.toUpperCase()}`);
          } else {
            orderParts.push(`"${key}" ${dir.toUpperCase()}`);
          }
        }
      }
      if (orderParts.length > 0) {
        sql += ` ORDER BY ${orderParts.join(', ')}`;
      }
    }
    
    if (options.take) {
      sql += ` LIMIT ${options.take}`;
    }

    const result = await this.pool.query(sql, params);
    
    // Transform results to Prisma format
    return result.rows.map(row => {
      const item: any = {};
      for (const field of options.by) {
        item[field] = row[field];
      }
      if (options._sum) {
        item._sum = {};
        for (const field of Object.keys(options._sum)) {
          item._sum[field] = parseFloat(row[`_sum_${field}`]) || 0;
        }
      }
      if (options._count === true) {
        item._count = parseInt(row['_count'], 10) || 0;
      }
      return item;
    });
  }
}

// Transaction model - same as PostgreSQLModel but uses PoolClient instead of Pool
class PostgreSQLTransactionModel {
  private client: PoolClient;
  private tableName: string;

  constructor(client: PoolClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  // Helper method to build WHERE clause with support for OR, AND, operators
  private buildWhereClause(
    where: any,
    params: any[],
    startIndex: number = 1
  ): { sql: string; paramIndex: number } {
    if (!where || Object.keys(where).length === 0) {
      return { sql: "", paramIndex: startIndex };
    }

    const conditions: string[] = [];
    let paramIndex = startIndex;

    for (const [key, value] of Object.entries(where)) {
      // Handle logical operators
      if (key === "OR" && Array.isArray(value)) {
        const orConditions: string[] = [];
        for (const orClause of value) {
          const result = this.buildWhereClause(orClause, params, paramIndex);
          if (result.sql) {
            orConditions.push(`(${result.sql})`);
            paramIndex = result.paramIndex;
          }
        }
        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(" OR ")})`);
        }
        continue;
      }

      if (key === "AND" && Array.isArray(value)) {
        const andConditions: string[] = [];
        for (const andClause of value) {
          const result = this.buildWhereClause(andClause, params, paramIndex);
          if (result.sql) {
            andConditions.push(`(${result.sql})`);
            paramIndex = result.paramIndex;
          }
        }
        if (andConditions.length > 0) {
          conditions.push(`(${andConditions.join(" AND ")})`);
        }
        continue;
      }

      if (key === "NOT") {
        const result = this.buildWhereClause(value, params, paramIndex);
        if (result.sql) {
          conditions.push(`NOT (${result.sql})`);
          paramIndex = result.paramIndex;
        }
        continue;
      }

      // Handle nested objects (comparison operators)
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        for (const [op, opValue] of Object.entries(value)) {
          if (op === "contains" && typeof opValue === "string") {
            conditions.push(`"${key}" ILIKE $${paramIndex}`);
            params.push(`%${opValue}%`);
            paramIndex++;
          } else if (op === "in" && Array.isArray(opValue)) {
            const placeholders = opValue.map(() => `$${paramIndex++}`).join(", ");
            conditions.push(`"${key}" IN (${placeholders})`);
            params.push(...opValue);
          } else if (op === "notIn" && Array.isArray(opValue)) {
            const placeholders = opValue.map(() => `$${paramIndex++}`).join(", ");
            conditions.push(`"${key}" NOT IN (${placeholders})`);
            params.push(...opValue);
          } else if (op === "gte") {
            conditions.push(`"${key}" >= $${paramIndex}`);
            params.push(opValue);
            paramIndex++;
          } else if (op === "lte") {
            conditions.push(`"${key}" <= $${paramIndex}`);
            params.push(opValue);
            paramIndex++;
          } else if (op === "gt") {
            conditions.push(`"${key}" > $${paramIndex}`);
            params.push(opValue);
            paramIndex++;
          } else if (op === "lt") {
            conditions.push(`"${key}" < $${paramIndex}`);
            params.push(opValue);
            paramIndex++;
          } else if (op === "not") {
            conditions.push(`"${key}" != $${paramIndex}`);
            params.push(opValue);
            paramIndex++;
          } else {
            console.warn(`[PostgreSQL] Unsupported operator: ${op}`);
          }
        }
      } else {
        // Simple equality
        conditions.push(`"${key}" = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    return {
      sql: conditions.length > 0 ? conditions.join(" AND ") : "",
      paramIndex,
    };
  }

  async findMany(options: any = {}): Promise<any[]> {
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    const whereResult = this.buildWhereClause(options.where || {}, params, paramIndex);
    paramIndex = whereResult.paramIndex;

    // Build SELECT clause with nested relations
    let selectFields = "*";
    let joins = "";
    if (options.include) {
      // Handle nested includes
      const fields: string[] = [];
      for (const field in options.include) {
        if (field === "items" || field === "customer") {
          // Will handle with separate queries
        }
      }
    }

    // Build ORDER BY clause
    let orderBy = "";
    if (options.orderBy) {
      const orderClauses: string[] = [];
      for (const [field, direction] of Object.entries(options.orderBy)) {
        orderClauses.push(`"${field}" ${direction === "asc" ? "ASC" : "DESC"}`);
      }
      if (orderClauses.length > 0) {
        orderBy = `ORDER BY ${orderClauses.join(", ")}`;
      }
    }

    // Build LIMIT/OFFSET clause
    let limitOffset = "";
    if (options.take !== undefined) {
      limitOffset += ` LIMIT $${paramIndex}`;
      params.push(options.take);
      paramIndex++;
    }
    if (options.skip !== undefined) {
      limitOffset += ` OFFSET $${paramIndex}`;
      params.push(options.skip);
      paramIndex++;
    }

    const sql = `
      SELECT ${selectFields}
      FROM "${this.tableName}"
      ${joins}
      ${whereResult.sql ? `WHERE ${whereResult.sql}` : ""}
      ${orderBy}
      ${limitOffset}
    `;

    const result = await this.client.query(sql, params);
    const rows = result.rows;

    // Handle nested includes
    if (options.include && rows.length > 0) {
      for (const row of rows) {
        for (const [field, includeOptions] of Object.entries(options.include)) {
          if (field === "items") {
            // Load related items
            const itemsResult = await this.client.query(
              `SELECT * FROM "SaleItem" WHERE "saleId" = $1`,
              [row.id]
            );
            row.items = itemsResult.rows;
          } else if (field === "customer" && row.customerId) {
            const customerResult = await this.client.query(
              `SELECT * FROM "Customer" WHERE id = $1`,
              [row.customerId]
            );
            row.customer = customerResult.rows[0] || null;
          }
        }
      }
    }

    return rows;
  }

  async findUnique(options: any): Promise<any | null> {
    const params: any[] = [];
    let paramIndex = 1;

    const whereResult = this.buildWhereClause(options.where, params, paramIndex);
    paramIndex = whereResult.paramIndex;

    const sql = `
      SELECT *
      FROM "${this.tableName}"
      WHERE ${whereResult.sql}
      LIMIT 1
    `;

    const result = await this.client.query(sql, params);
    const row = result.rows[0] || null;

    // Handle nested includes
    if (row && options.include) {
      for (const [field, includeOptions] of Object.entries(options.include)) {
        if (field === "items") {
          const itemsResult = await this.client.query(
            `SELECT * FROM "SaleItem" WHERE "saleId" = $1`,
            [row.id]
          );
          row.items = itemsResult.rows;
        } else if (field === "customer" && row.customerId) {
          const customerResult = await this.client.query(
            `SELECT * FROM "Customer" WHERE id = $1`,
            [row.customerId]
          );
          row.customer = customerResult.rows[0] || null;
        }
      }
    }

    return row;
  }

  async create(options: any): Promise<any> {
    const data = options.data;
    const fields: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    // Handle nested creates
    const nestedCreates: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "object" && value !== null && "create" in value) {
        nestedCreates[key] = value.create;
      } else {
        fields.push(`"${key}"`);
        values.push(value);
        placeholders.push(`$${paramIndex++}`);
      }
    }

    const sql = `
      INSERT INTO "${this.tableName}" (${fields.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    `;

    const result = await this.client.query(sql, values);
    const row = result.rows[0];

    // Handle nested creates
    for (const [field, nestedData] of Object.entries(nestedCreates)) {
      if (field === "items" && Array.isArray(nestedData)) {
        const createdItems: any[] = [];
        for (const item of nestedData) {
          const itemModel = new PostgreSQLTransactionModel(this.client, "SaleItem");
          const createdItem = await itemModel.create({
            data: {
              ...item,
              saleId: row.id,
            },
          });
          createdItems.push(createdItem);
        }
        row.items = createdItems;
      }
    }

    return row;
  }

  async update(options: any): Promise<any> {
    const params: any[] = [];
    let paramIndex = 1;

    const whereResult = this.buildWhereClause(options.where, params, paramIndex);
    paramIndex = whereResult.paramIndex;

    const setClauses: string[] = [];
    for (const [key, value] of Object.entries(options.data)) {
      if (typeof value === "object" && value !== null) {
        // Handle atomic operations
        if ("increment" in value) {
          setClauses.push(`"${key}" = "${key}" + $${paramIndex}`);
          params.push(value.increment);
          paramIndex++;
        } else if ("decrement" in value) {
          setClauses.push(`"${key}" = "${key}" - $${paramIndex}`);
          params.push(value.decrement);
          paramIndex++;
        } else if ("multiply" in value) {
          setClauses.push(`"${key}" = "${key}" * $${paramIndex}`);
          params.push(value.multiply);
          paramIndex++;
        } else if ("divide" in value) {
          setClauses.push(`"${key}" = "${key}" / $${paramIndex}`);
          params.push(value.divide);
          paramIndex++;
        }
      } else {
        setClauses.push(`"${key}" = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    const sql = `
      UPDATE "${this.tableName}"
      SET ${setClauses.join(", ")}
      WHERE ${whereResult.sql}
      RETURNING *
    `;

    const result = await this.client.query(sql, params);
    return result.rows[0] || null;
  }

  async upsert(options: any): Promise<any> {
    const existing = await this.findUnique({ where: options.where });
    if (existing) {
      return this.update({
        where: options.where,
        data: options.update,
      });
    } else {
      return this.create({ data: options.create });
    }
  }

  async delete(options: any): Promise<any> {
    const params: any[] = [];
    let paramIndex = 1;

    const whereResult = this.buildWhereClause(options.where, params, paramIndex);

    const sql = `
      DELETE FROM "${this.tableName}"
      WHERE ${whereResult.sql}
      RETURNING *
    `;

    const result = await this.client.query(sql, params);
    return result.rows[0] || null;
  }

  async count(options: any = {}): Promise<number> {
    const params: any[] = [];
    let paramIndex = 1;

    const whereResult = this.buildWhereClause(options.where || {}, params, paramIndex);

    const sql = `
      SELECT COUNT(*) as count
      FROM "${this.tableName}"
      ${whereResult.sql ? `WHERE ${whereResult.sql}` : ""}
    `;

    const result = await this.client.query(sql, params);
    return parseInt(result.rows[0]?.count || "0", 10);
  }
}

