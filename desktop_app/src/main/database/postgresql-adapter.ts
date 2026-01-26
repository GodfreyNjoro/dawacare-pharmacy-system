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
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.connected = true;
      console.log('[PostgreSQL] Connected to database');
    } catch (error: any) {
      console.error('[PostgreSQL] Connection error:', error);
      let message = error.message || 'Failed to connect';
      if (message.includes('ECONNREFUSED')) {
        message = 'Connection refused. Make sure PostgreSQL is running on the specified host and port.';
      } else if (message.includes('authentication failed') || message.includes('password authentication')) {
        message = 'Authentication failed. Check your username and password.';
      } else if (message.includes('does not exist')) {
        message = 'Database does not exist. Please create it in pgAdmin first.';
      } else if (message.includes('ENOTFOUND')) {
        message = 'Host not found. Check the hostname.';
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
}

// Simple Prisma-like model interface
class PostgreSQLModel {
  private pool: Pool;
  private tableName: string;

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
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
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(options.where)) {
        if (value !== undefined && value !== null) {
          conditions.push(`"${key}" = $${paramIndex++}`);
          params.push(value);
        }
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
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
    return result.rows;
  }

  async findFirst(options?: {
    where?: Record<string, any>;
  }): Promise<any | null> {
    const results = await this.findMany({ ...options, take: 1 });
    return results[0] || null;
  }

  async findUnique(options: {
    where: Record<string, any>;
  }): Promise<any | null> {
    return this.findFirst(options);
  }

  async create(options: {
    data: Record<string, any>;
  }): Promise<any> {
    const { data } = options;
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO "${this.tableName}" ("${keys.join('", "')}") VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await this.pool.query(sql, values);
    return result.rows[0];
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
      setParts.push(`"${key}" = $${paramIndex++}`);
      params.push(value);
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

  async count(options?: {
    where?: Record<string, any>;
  }): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.where) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(options.where)) {
        if (value !== undefined && value !== null) {
          conditions.push(`"${key}" = $${paramIndex++}`);
          params.push(value);
        }
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    const result = await this.pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }
}
