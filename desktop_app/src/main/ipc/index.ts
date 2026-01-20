import { registerDatabaseHandlers } from './database-handlers';
import { registerAuthHandlers } from './auth-handlers';
import { registerSettingsHandlers } from './settings-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerPosHandlers } from './pos-handlers';
import { registerSyncHandlers } from './sync-handlers';
import { registerSalesHandlers } from './sales-handlers';
import { registerCustomerHandlers } from './customer-handlers';
import { registerInventoryHandlers } from './inventory-handlers';

export function registerAllIpcHandlers(): void {
  console.log('[IPC] Registering all IPC handlers...');
  
  registerDatabaseHandlers();
  registerAuthHandlers();
  registerSettingsHandlers();
  registerWindowHandlers();
  registerPosHandlers();
  registerSyncHandlers();
  registerSalesHandlers();
  registerCustomerHandlers();
  registerInventoryHandlers();

  console.log('[IPC] All IPC handlers registered successfully');
}
