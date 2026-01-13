import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import DatabaseManager from '../database/database-manager';

export function registerDatabaseHandlers(): void {
  const dbManager = DatabaseManager.getInstance();

  // Get current database configuration
  ipcMain.handle(IPC_CHANNELS.DB_GET_CONFIG, async () => {
    try {
      const config = dbManager.getConfig();
      return { success: true, config };
    } catch (error: any) {
      return { success: false, error: error.message };
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
