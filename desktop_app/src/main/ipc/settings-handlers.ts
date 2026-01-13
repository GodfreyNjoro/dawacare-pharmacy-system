import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import DatabaseManager from '../database/database-manager';

export function registerSettingsHandlers(): void {
  const dbManager = DatabaseManager.getInstance();

  // Get specific setting
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      const setting = await prisma.appSettings.findUnique({
        where: { key },
      });

      return { success: true, setting };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Set specific setting
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: string) => {
    try {
      const prisma = dbManager.getPrismaClient();
      const setting = await prisma.appSettings.upsert({
        where: { key },
        update: { value, updatedAt: new Date() },
        create: { key, value },
      });

      return { success: true, setting };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get all settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    try {
      const prisma = dbManager.getPrismaClient();
      const settings = await prisma.appSettings.findMany();

      // Convert to object for easier access
      const settingsMap = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);

      return { success: true, settings: settingsMap };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
