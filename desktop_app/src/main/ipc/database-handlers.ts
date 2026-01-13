import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import DatabaseManager from '../database/database-manager';

export function registerDatabaseHandlers(): void {
  const dbManager = DatabaseManager.getInstance();

  // Get current database configuration AND initialization status
  ipcMain.handle(IPC_CHANNELS.DB_GET_CONFIG, async () => {
    try {
      const config = dbManager.getConfig();
      const isInitialized = dbManager.isInitialized();
      // Only return config as valid if database is actually initialized
      return { 
        success: true, 
        config: isInitialized ? config : null,
        isInitialized 
      };
    } catch (error: any) {
      return { success: false, error: error.message, config: null, isInitialized: false };
    }
  });

  // Set database configuration
  ipcMain.handle(IPC_CHANNELS.DB_SET_CONFIG, async (_, config) => {
    try {
      await dbManager.setConfig(config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Test database connection
  ipcMain.handle(IPC_CHANNELS.DB_TEST_CONNECTION, async (_, config) => {
    try {
      const result = await dbManager.testConnection(config);
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });

  // Initialize database
  ipcMain.handle(IPC_CHANNELS.DB_INITIALIZE, async (_, config) => {
    try {
      await dbManager.initialize(config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
