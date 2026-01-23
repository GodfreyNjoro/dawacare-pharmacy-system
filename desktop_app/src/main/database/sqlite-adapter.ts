import path from 'path';
import { app } from 'electron';
import type { DatabaseAdapter } from '../../shared/types';
import { DEFAULT_SQLITE_DB_NAME } from '../../shared/constants';
import { getSQLitePrismaClientClass } from '../prisma-helper';

export class SQLiteAdapter implements DatabaseAdapter {
  private prisma: any = null;
  private dbPath: string;
  private connected: boolean = false;

  constructor(dbPath?: string) {
    // If no path provided, use default in user data directory
    this.dbPath = dbPath || path.join(app.getPath('userData'), DEFAULT_SQLITE_DB_NAME);
  }

  async connect(): Promise<void> {
    try {
      // Set DATABASE_URL environment variable for Prisma
      process.env.DATABASE_URL = `file:${this.dbPath}`;

      // Get PrismaClient dynamically (after env is configured)
      const PrismaClient = getSQLitePrismaClientClass();
      
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: `file:${this.dbPath}`,
          },
        },
      });

      await this.prisma.$connect();
      this.connected = true;
      console.log('[SQLite] Connected to database at:', this.dbPath);
    } catch (error) {
      console.error('[SQLite] Connection error:', error);
      throw new Error(`Failed to connect to SQLite database: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
      this.connected = false;
      console.log('[SQLite] Disconnected from database');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionString(): string {
    return `file:${this.dbPath}`;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[SQLite] Initializing database...');
      await this.runMigrations();
      await this.seedDefaultData();
      console.log('[SQLite] Database initialized successfully');
    } catch (error) {
      console.error('[SQLite] Initialization error:', error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.prisma) throw new Error('Database not connected');
    
    try {
      console.log('[SQLite] Creating schema...');
      
      // Run schema updates/migrations for existing tables
      await this.runSchemaMigrations();
      
      // Create all tables using raw SQL (SQLite compatible)
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Branch" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "name" TEXT NOT NULL,
          "code" TEXT NOT NULL UNIQUE,
          "address" TEXT,
          "phone" TEXT,
          "email" TEXT,
          "isMainBranch" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          "lastSyncedAt" DATETIME
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "email" TEXT NOT NULL UNIQUE,
          "name" TEXT,
          "password" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'CASHIER',
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "branchId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          "lastSyncedAt" DATETIME,
          FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Medicine" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "name" TEXT NOT NULL,
          "genericName" TEXT,
          "manufacturer" TEXT,
          "batchNumber" TEXT NOT NULL,
          "expiryDate" DATETIME NOT NULL,
          "quantity" INTEGER NOT NULL,
          "reorderLevel" INTEGER NOT NULL DEFAULT 10,
          "unitPrice" REAL NOT NULL,
          "category" TEXT NOT NULL,
          "branchId" TEXT,
          "syncStatus" TEXT NOT NULL DEFAULT 'LOCAL',
          "lastSyncedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Customer" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "name" TEXT NOT NULL,
          "phone" TEXT NOT NULL UNIQUE,
          "email" TEXT,
          "address" TEXT,
          "dateOfBirth" DATETIME,
          "gender" TEXT,
          "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
          "creditBalance" REAL NOT NULL DEFAULT 0,
          "creditLimit" REAL NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "notes" TEXT,
          "syncStatus" TEXT NOT NULL DEFAULT 'LOCAL',
          "lastSyncedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Sale" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "invoiceNumber" TEXT NOT NULL UNIQUE,
          "customerId" TEXT,
          "customerName" TEXT,
          "customerPhone" TEXT,
          "subtotal" REAL NOT NULL,
          "discount" REAL NOT NULL DEFAULT 0,
          "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0,
          "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
          "total" REAL NOT NULL,
          "paymentMethod" TEXT NOT NULL,
          "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
          "notes" TEXT,
          "soldBy" TEXT,
          "branchId" TEXT,
          "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
          "lastSyncedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
          FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SaleItem" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "saleId" TEXT NOT NULL,
          "medicineId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "unitPrice" REAL NOT NULL,
          "total" REAL NOT NULL,
          FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Supplier" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "name" TEXT NOT NULL,
          "contactPerson" TEXT,
          "email" TEXT,
          "phone" TEXT,
          "address" TEXT,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "lastSyncedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "poNumber" TEXT NOT NULL UNIQUE,
          "supplierId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'DRAFT',
          "subtotal" REAL NOT NULL,
          "tax" REAL NOT NULL DEFAULT 0,
          "total" REAL NOT NULL,
          "notes" TEXT,
          "expectedDate" DATETIME,
          "createdBy" TEXT,
          "branchId" TEXT,
          "lastSyncedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "purchaseOrderId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "genericName" TEXT,
          "quantity" INTEGER NOT NULL,
          "receivedQty" INTEGER NOT NULL DEFAULT 0,
          "unitCost" REAL NOT NULL,
          "total" REAL NOT NULL,
          "category" TEXT,
          FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GoodsReceivedNote" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "grnNumber" TEXT NOT NULL UNIQUE,
          "purchaseOrderId" TEXT NOT NULL,
          "receivedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "receivedBy" TEXT,
          "notes" TEXT,
          "status" TEXT NOT NULL DEFAULT 'RECEIVED',
          "branchId" TEXT,
          "lastSyncedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GRNItem" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "grnId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "expiryDate" DATETIME NOT NULL,
          "quantityReceived" INTEGER NOT NULL,
          "unitCost" REAL NOT NULL,
          "total" REAL NOT NULL,
          "addedToInventory" INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY ("grnId") REFERENCES "GoodsReceivedNote"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "customerId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "points" INTEGER NOT NULL,
          "saleId" TEXT,
          "description" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CreditTransaction" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "customerId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "amount" REAL NOT NULL,
          "saleId" TEXT,
          "description" TEXT,
          "createdBy" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StockTransfer" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "transferNumber" TEXT NOT NULL UNIQUE,
          "fromBranchId" TEXT NOT NULL,
          "toBranchId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "notes" TEXT,
          "createdBy" TEXT,
          "completedBy" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "completedAt" DATETIME,
          "updatedAt" DATETIME NOT NULL,
          FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StockTransferItem" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "transferId" TEXT NOT NULL,
          "medicineId" TEXT NOT NULL,
          "medicineName" TEXT NOT NULL,
          "batchNumber" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "unitPrice" REAL NOT NULL,
          FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AccountMapping" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "accountType" TEXT NOT NULL,
          "accountCode" TEXT NOT NULL,
          "accountName" TEXT NOT NULL,
          "description" TEXT,
          "tallyLedger" TEXT,
          "sageLedger" TEXT,
          "isActive" INTEGER NOT NULL DEFAULT 1,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ExportHistory" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "exportType" TEXT NOT NULL,
          "format" TEXT NOT NULL,
          "dateFrom" DATETIME NOT NULL,
          "dateTo" DATETIME NOT NULL,
          "recordCount" INTEGER NOT NULL DEFAULT 0,
          "fileName" TEXT NOT NULL,
          "fileSize" INTEGER,
          "status" TEXT NOT NULL DEFAULT 'COMPLETED',
          "errorMessage" TEXT,
          "exportedBy" TEXT,
          "branchId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SyncQueue" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "operation" TEXT NOT NULL,
          "payload" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "lastAttemptAt" DATETIME,
          "errorMessage" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AppSettings" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "key" TEXT NOT NULL UNIQUE,
          "value" TEXT NOT NULL,
          "description" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);

      console.log('[SQLite] Schema created successfully');
    } catch (error) {
      console.error('[SQLite] Schema creation error:', error);
      throw error;
    }
  }

  private async runSchemaMigrations(): Promise<void> {
    if (!this.prisma) return;
    
    try {
      console.log('[SQLite] Checking for schema migrations...');
      
      // Check if SyncQueue table exists and has old schema
      const tableInfo: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA table_info("SyncQueue")`);
      
      if (tableInfo.length > 0) {
        // Table exists, check if it has old column names
        const hasOldTableColumn = tableInfo.some((col: any) => col.name === 'table');
        const hasEntityTypeColumn = tableInfo.some((col: any) => col.name === 'entityType');
        
        if (hasOldTableColumn && !hasEntityTypeColumn) {
          console.log('[SQLite] Migrating SyncQueue table from old schema...');
          
          // Rename old table
          await this.prisma.$executeRawUnsafe(`ALTER TABLE "SyncQueue" RENAME TO "SyncQueue_old"`);
          
          // Create new table with correct schema
          await this.prisma.$executeRawUnsafe(`
            CREATE TABLE "SyncQueue" (
              "id" TEXT PRIMARY KEY NOT NULL,
              "entityType" TEXT NOT NULL,
              "entityId" TEXT NOT NULL,
              "operation" TEXT NOT NULL,
              "payload" TEXT NOT NULL DEFAULT '{}',
              "status" TEXT NOT NULL DEFAULT 'PENDING',
              "attempts" INTEGER NOT NULL DEFAULT 0,
              "lastAttemptAt" DATETIME,
              "errorMessage" TEXT,
              "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" DATETIME NOT NULL
            )
          `);
          
          // Copy data from old table mapping old columns to new
          try {
            await this.prisma.$executeRawUnsafe(`
              INSERT INTO "SyncQueue" ("id", "entityType", "entityId", "operation", "payload", "status", "createdAt", "updatedAt")
              SELECT "id", COALESCE("table", 'UNKNOWN'), COALESCE("recordId", "id"), COALESCE("action", 'CREATE'), 
                     COALESCE("data", '{}'), COALESCE("status", 'PENDING'), "createdAt", COALESCE("updatedAt", "createdAt")
              FROM "SyncQueue_old"
            `);
          } catch (e) {
            console.log('[SQLite] Could not migrate old data, starting fresh');
          }
          
          // Drop old table
          await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "SyncQueue_old"`);
          
          console.log('[SQLite] SyncQueue table migration completed');
        }
      }
      
      console.log('[SQLite] Schema migrations completed');
    } catch (error) {
      console.error('[SQLite] Schema migration error:', error);
      // Don't throw - allow the app to continue with fresh table creation
    }
  }

  private async seedDefaultData(): Promise<void> {
    if (!this.prisma) throw new Error('Database not connected');

    try {
      // Check if default admin user exists
      const adminExists = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });

      if (!adminExists) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);

        await this.prisma.user.create({
          data: {
            email: 'admin@dawacare.local',
            name: 'System Administrator',
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        });

        console.log('[SQLite] Default admin user created');
      }

      // Create default branch if none exists
      const branchExists = await this.prisma.branch.count();
      if (branchExists === 0) {
        await this.prisma.branch.create({
          data: {
            name: 'Main Branch',
            code: 'MAIN',
            isMainBranch: true,
            status: 'ACTIVE',
          },
        });

        console.log('[SQLite] Default branch created');
      }

      // Create default app settings
      const settingsExist = await this.prisma.appSettings.count();
      if (settingsExist === 0) {
        await this.prisma.appSettings.createMany({
          data: [
            { key: 'cloud_sync_enabled', value: 'false', description: 'Enable cloud synchronization' },
            { key: 'theme', value: 'light', description: 'Application theme' },
            { key: 'auto_sync_interval', value: '15', description: 'Auto sync interval in minutes' },
          ],
        });

        console.log('[SQLite] Default settings created');
      }
    } catch (error) {
      console.error('[SQLite] Error seeding default data:', error);
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
