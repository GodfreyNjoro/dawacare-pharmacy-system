import { registerDatabaseHandlers } from './database-handlers';
import { registerAuthHandlers } from './auth-handlers';
import { registerSettingsHandlers } from './settings-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerPosHandlers } from './pos-handlers';
import { registerSyncHandlers } from './sync-handlers';
import { registerSalesHandlers } from './sales-handlers';
import { registerCustomerHandlers } from './customer-handlers';
import { registerInventoryHandlers } from './inventory-handlers';
import { registerSuppliersHandlers } from './suppliers-handlers';
import { registerPurchaseOrdersHandlers } from './purchase-orders-handlers';
import { registerGRNHandlers } from './grn-handlers';
import { registerUsersHandlers } from './users-handlers';
import { registerBranchesHandlers } from './branches-handlers';
import { registerReportsHandlers } from './reports-handlers';
import { registerAIHandlers } from './ai-handlers';
import { registerControlledSubstancesHandlers } from './controlled-substances-handlers';

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
  registerSuppliersHandlers();
  registerPurchaseOrdersHandlers();
  registerGRNHandlers();
  registerUsersHandlers();
  registerBranchesHandlers();
  registerReportsHandlers();
  registerAIHandlers();
  registerControlledSubstancesHandlers();

  console.log('[IPC] All IPC handlers registered successfully');
}
