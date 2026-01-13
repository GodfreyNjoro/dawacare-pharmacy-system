import path from 'path';
import { app } from 'electron';
import { PrismaClient } from '@prisma/client';
import type { DatabaseAdapter } from '../../shared/types';
import { DEFAULT_SQLITE_DB_NAME } from '../../shared/constants';

export class SQLiteAdapter implements DatabaseAdapter {
  private prisma: PrismaClient | null = null;
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
    try {
      console.log('[SQLite] Running migrations...');
      // In production, migrations should be embedded
      // For now, we'll use Prisma's push command
      const { execSync } = require('child_process');
      const prismaPath = path.join(__dirname, '../../../node_modules/.bin/prisma');
      
      execSync(`"${prismaPath}" db push --skip-generate`, {
        env: { ...process.env, DATABASE_URL: `file:${this.dbPath}` },
        stdio: 'inherit',
      });
      
      console.log('[SQLite] Migrations completed');
    } catch (error) {
      console.error('[SQLite] Migration error:', error);
      // Don't throw - migrations might already be applied
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

  getPrismaClient(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }
}
