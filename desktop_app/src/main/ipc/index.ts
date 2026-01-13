import { registerDatabaseHandlers } from './database-handlers';
import { registerAuthHandlers } from './auth-handlers';
import { registerSettingsHandlers } from './settings-handlers';
import { registerWindowHandlers } from './window-handlers';

export function registerAllIpcHandlers(): void {
  console.log('[IPC] Registering all IPC handlers...');
  
  registerDatabaseHandlers();
  registerAuthHandlers();
  registerSettingsHandlers();
  registerWindowHandlers();

  console.log('[IPC] All IPC handlers registered successfully');
}
