import type { DatabaseAdapter } from '../../shared/types';
import { getPostgreSQLPrismaClientClass } from '../prisma-helper';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private prisma: any = null;
  private connectionString: string;
  private connected: boolean = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    try {
      // Set DATABASE_URL environment variable for Prisma
      process.env.DATABASE_URL = this.connectionString;

      // Get PostgreSQL-specific PrismaClient
      const PrismaClient = getPostgreSQLPrismaClientClass();
      
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: this.connectionString,
          },
        },
        log: ['error', 'warn'],
      });

      await this.prisma.$connect();
      this.connected = true;
      console.log('[PostgreSQL] Connected to database');
    } catch (error: any) {
      console.error('[PostgreSQL] Connection error:', error);
      // Provide more helpful error messages
      let message = error.message || 'Failed to connect';
      if (message.includes('ECONNREFUSED')) {
        message = 'Connection refused. Make sure PostgreSQL is running on the specified host and port.';
      } else if (message.includes('authentication failed')) {
        message = 'Authentication failed. Check your username and password.';
      } else if (message.includes('does not exist')) {
        message = 'Database does not exist. Please create it in pgAdmin first.';
      }
      throw new Error(`Failed to connect to PostgreSQL database: ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
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

  private async createTablesIfNotExist(): Promise<void> {
    if (!this.prisma) throw new Error('Database not connected');

    try {
      // Check if tables exist by trying to query User table
      await this.prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
      console.log('[PostgreSQL] Tables already exist');
    } catch (error: any) {
      console.log('[PostgreSQL] Tables not found, creating schema...');
      
      // Create all tables using raw SQL
      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "SaleItem" (
          "id" TEXT PRIMARY KEY,
          "saleId" TEXT NOT NULL,
          "medicineId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "unitPrice" DOUBLE PRECISION NOT NULL,
          "total" DOUBLE PRECISION NOT NULL,
          FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
          "id" TEXT PRIMARY KEY,
          "poNumber" TEXT UNIQUE NOT NULL,
          "supplierId" TEXT NOT NULL,
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
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
          "id" TEXT PRIMARY KEY,
          "purchaseOrderId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "genericName" TEXT,
          "quantity" INTEGER NOT NULL,
          "receivedQty" INTEGER DEFAULT 0,
          "unitCost" DOUBLE PRECISION NOT NULL,
          "total" DOUBLE PRECISION NOT NULL,
          "category" TEXT,
          FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "GoodsReceivedNote" (
          "id" TEXT PRIMARY KEY,
          "grnNumber" TEXT UNIQUE NOT NULL,
          "purchaseOrderId" TEXT NOT NULL,
          "receivedDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "receivedBy" TEXT,
          "notes" TEXT,
          "status" TEXT DEFAULT 'RECEIVED',
          "branchId" TEXT,
          "lastSyncedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "GRNItem" (
          "id" TEXT PRIMARY KEY,
          "grnId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "expiryDate" TIMESTAMP NOT NULL,
          "quantityReceived" INTEGER NOT NULL,
          "unitCost" DOUBLE PRECISION NOT NULL,
          "total" DOUBLE PRECISION NOT NULL,
          "addedToInventory" BOOLEAN DEFAULT FALSE,
          FOREIGN KEY ("grnId") REFERENCES "GoodsReceivedNote"("id") ON DELETE CASCADE
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "points" INTEGER NOT NULL,
          "saleId" TEXT,
          "description" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "CreditTransaction" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "amount" DOUBLE PRECISION NOT NULL,
          "saleId" TEXT,
          "description" TEXT,
          "createdBy" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "StockTransferItem" (
          "id" TEXT PRIMARY KEY,
          "transferId" TEXT NOT NULL,
          "medicineId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "unitPrice" DOUBLE PRECISION NOT NULL,
          FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
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
        )`;

      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "AppSettings" (
          "id" TEXT PRIMARY KEY,
          "key" TEXT UNIQUE NOT NULL,
          "value" TEXT NOT NULL,
          "description" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

      console.log('[PostgreSQL] All tables created successfully');
    }
  }

  private async seedDefaultData(): Promise<void> {
    if (!this.prisma) throw new Error('Database not connected');

    try {
      // Check if default admin user exists
      const adminResult = await this.prisma.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1`;

      if (!adminResult || (adminResult as any[]).length === 0) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const id = `user_${Date.now()}_admin`;

        await this.prisma.$executeRaw`
          INSERT INTO "User" ("id", "email", "name", "password", "role", "status")
          VALUES (${id}, 'admin@dawacare.local', 'System Administrator', ${hashedPassword}, 'ADMIN', 'ACTIVE')
        `;

        console.log('[PostgreSQL] Default admin user created');
      }

      // Create default branch if none exists
      const branchResult = await this.prisma.$queryRaw`SELECT COUNT(*) as count FROM "Branch"`;
      const branchCount = parseInt((branchResult as any[])[0]?.count || '0', 10);
      
      if (branchCount === 0) {
        const branchId = `branch_${Date.now()}_main`;
        await this.prisma.$executeRaw`
          INSERT INTO "Branch" ("id", "name", "code", "isMainBranch", "status")
          VALUES (${branchId}, 'Main Branch', 'MAIN', TRUE, 'ACTIVE')
        `;

        console.log('[PostgreSQL] Default branch created');
      }

      // Create default app settings
      const settingsResult = await this.prisma.$queryRaw`SELECT COUNT(*) as count FROM "AppSettings"`;
      const settingsCount = parseInt((settingsResult as any[])[0]?.count || '0', 10);
      
      if (settingsCount === 0) {
        await this.prisma.$executeRaw`
          INSERT INTO "AppSettings" ("id", "key", "value", "description")
          VALUES 
            ('setting_1', 'cloud_sync_enabled', 'false', 'Enable cloud synchronization'),
            ('setting_2', 'theme', 'light', 'Application theme'),
            ('setting_3', 'auto_sync_interval', '15', 'Auto sync interval in minutes')
        `;

        console.log('[PostgreSQL] Default settings created');
      }
    } catch (error) {
      console.error('[PostgreSQL] Error seeding default data:', error);
      throw error;
    }
  }

  getPrismaClient(): any {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }
}
