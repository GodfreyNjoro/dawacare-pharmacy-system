import type { DatabaseAdapter } from '../../shared/types';
import { getPrismaClientClass } from '../prisma-helper';

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

      // Get PrismaClient dynamically (after env is configured)
      const PrismaClient = getPrismaClientClass();
      
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: this.connectionString,
          },
        },
      });

      await this.prisma.$connect();
      this.connected = true;
      console.log('[PostgreSQL] Connected to database');
    } catch (error) {
      console.error('[PostgreSQL] Connection error:', error);
      throw new Error(`Failed to connect to PostgreSQL database: ${error}`);
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
      await this.runMigrations();
      await this.seedDefaultData();
      console.log('[PostgreSQL] Database initialized successfully');
    } catch (error) {
      console.error('[PostgreSQL] Initialization error:', error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    // PostgreSQL migrations are typically run via external migration tools
    // or handled by the cloud database. This is a no-op for now.
    console.log('[PostgreSQL] Migrations handled externally');
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

        console.log('[PostgreSQL] Default admin user created');
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

        console.log('[PostgreSQL] Default branch created');
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
