import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createMainWindow, getMainWindow } from './windows/main-window';
import { registerAllIpcHandlers } from './ipc';
import DatabaseManager from './database/database-manager';
import { APP_NAME } from '../shared/constants';
import { configurePrismaForProduction } from './prisma-helper';
import { initAutoUpdater, registerUpdateHandlers, checkForUpdatesOnStart } from './auto-updater';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const isDevelopment = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  console.log(`[${APP_NAME}] Creating main window...`);
  mainWindow = createMainWindow();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async () => {
  console.log(`[${APP_NAME}] App ready, initializing...`);

  // Configure Prisma for production (must be done before any database operations)
  configurePrismaForProduction();

  try {
    // Register all IPC handlers
    registerAllIpcHandlers();
    
    // Register auto-updater IPC handlers
    registerUpdateHandlers();

    // Initialize database manager (will try to load saved config)
    const dbManager = DatabaseManager.getInstance();
    const existingConfig = dbManager.getConfig();

    if (existingConfig) {
      console.log('[Main] Found existing database config, initializing...');
      await dbManager.initialize();
    } else {
      console.log('[Main] No existing database config found, will show setup wizard');
    }

    // Create main window
    createWindow();
    
    // Initialize auto-updater with main window
    if (mainWindow) {
      initAutoUpdater(mainWindow);
      // Check for updates on startup (with delay)
      checkForUpdatesOnStart();
    }

    console.log(`[${APP_NAME}] Application started successfully`);
  } catch (error) {
    console.error('[Main] Initialization error:', error);
    // Still create window to show error to user
    createWindow();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app shutdown
app.on('before-quit', async () => {
  console.log('[Main] Application shutting down...');
  
  try {
    const dbManager = DatabaseManager.getInstance();
    if (dbManager.isInitialized()) {
      await dbManager.shutdown();
      console.log('[Main] Database connection closed');
    }
  } catch (error) {
    console.error('[Main] Error during shutdown:', error);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});

// Log startup info
console.log('='.repeat(60));
console.log(`${APP_NAME} - Desktop Application`);
console.log(`Electron: ${process.versions.electron}`);
console.log(`Chrome: ${process.versions.chrome}`);
console.log(`Node: ${process.versions.node}`);
console.log(`Platform: ${process.platform}`);
console.log(`Environment: ${isDevelopment ? 'Development' : 'Production'}`);
console.log('='.repeat(60));
