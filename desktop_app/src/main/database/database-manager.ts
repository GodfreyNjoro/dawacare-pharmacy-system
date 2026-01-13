import Store from 'electron-store';
import { PrismaClient } from '@prisma/client';
import type { DatabaseAdapter, DatabaseConfig, DatabaseType } from '../../shared/types';
import { SQLiteAdapter } from './sqlite-adapter';
import { PostgreSQLAdapter } from './postgresql-adapter';
import { STORAGE_KEYS } from '../../shared/constants';

class DatabaseManager {
  private static instance: DatabaseManager;
  private adapter: DatabaseAdapter | null = null;
  private store: Store;

  private constructor() {
    this.store = new Store();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(config?: DatabaseConfig): Promise<void> {
    try {
      let dbConfig: DatabaseConfig;

      if (config) {
        // Save the config for future use
        this.store.set(STORAGE_KEYS.DATABASE_CONFIG, config);
        dbConfig = config;
      } else {
        // Try to load saved config
        const savedConfig = this.store.get(STORAGE_KEYS.DATABASE_CONFIG) as DatabaseConfig;
        if (savedConfig) {
          dbConfig = savedConfig;
        } else {
          // Default to SQLite if no config exists
          dbConfig = { type: 'sqlite' };
          this.store.set(STORAGE_KEYS.DATABASE_CONFIG, dbConfig);
        }
      }

      console.log('[DatabaseManager] Initializing with config:', {
        type: dbConfig.type,
        path: dbConfig.databasePath,
      });

      // Disconnect existing adapter if any
      if (this.adapter) {
        await this.adapter.disconnect();
      }

      // Create appropriate adapter
      if (dbConfig.type === 'sqlite') {
        this.adapter = new SQLiteAdapter(dbConfig.databasePath);
      } else if (dbConfig.type === 'postgresql') {
        if (!dbConfig.connectionString) {
          throw new Error('PostgreSQL connection string is required');
        }
        this.adapter = new PostgreSQLAdapter(dbConfig.connectionString);
      } else {
        throw new Error(`Unsupported database type: ${dbConfig.type}`);
      }

      // Connect and initialize
      await this.adapter.connect();
      await this.adapter.initialize();

      console.log('[DatabaseManager] Database initialized successfully');
    } catch (error) {
      console.error('[DatabaseManager] Initialization error:', error);
      throw error;
    }
  }

  async testConnection(config: DatabaseConfig): Promise<{ success: boolean; message?: string }> {
    let testAdapter: DatabaseAdapter | null = null;

    try {
      if (config.type === 'sqlite') {
        testAdapter = new SQLiteAdapter(config.databasePath);
      } else if (config.type === 'postgresql') {
        if (!config.connectionString) {
          return { success: false, message: 'PostgreSQL connection string is required' };
        }
        testAdapter = new PostgreSQLAdapter(config.connectionString);
      } else {
        return { success: false, message: `Unsupported database type: ${config.type}` };
      }

      await testAdapter.connect();
      await testAdapter.disconnect();

      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || 'Connection failed' };
    } finally {
      if (testAdapter && testAdapter.isConnected()) {
        await testAdapter.disconnect();
      }
    }
  }

  getAdapter(): DatabaseAdapter {
    if (!this.adapter) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  getPrismaClient(): PrismaClient {
    if (!this.adapter) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    // Get Prisma client from adapter
    if ('getPrismaClient' in this.adapter) {
      return (this.adapter as any).getPrismaClient();
    }

    throw new Error('Adapter does not provide Prisma client');
  }

  getConfig(): DatabaseConfig | null {
    return this.store.get(STORAGE_KEYS.DATABASE_CONFIG) as DatabaseConfig | null;
  }

  async setConfig(config: DatabaseConfig): Promise<void> {
    await this.initialize(config);
  }

  isInitialized(): boolean {
    return this.adapter !== null && this.adapter.isConnected();
  }

  async shutdown(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }
  }
}

export default DatabaseManager;
