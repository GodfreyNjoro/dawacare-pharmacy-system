import { autoUpdater, UpdateCheckResult, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import { APP_NAME } from '../shared/constants';

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, let user decide
autoUpdater.autoInstallOnAppQuit = true; // Install on quit if downloaded

let mainWindow: BrowserWindow | null = null;

// Update status types
export type UpdateStatus = 
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

// Send update status to renderer
function sendStatusToWindow(status: UpdateStatus, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, data });
  }
}

// Initialize auto-updater with window reference
export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window;
  
  console.log(`[${APP_NAME}] Auto-updater initialized`);

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    sendStatusToWindow('checking');
  });

  // Event: Update available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update available:', info.version);
    sendStatusToWindow('available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: No update available
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('[AutoUpdater] No update available. Current version is latest.');
    sendStatusToWindow('not-available', {
      version: info.version,
    });
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress: UpdateProgress) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    sendStatusToWindow('downloading', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    sendStatusToWindow('downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: Error
  autoUpdater.on('error', (error: Error) => {
    console.error('[AutoUpdater] Error:', error.message);
    sendStatusToWindow('error', {
      message: error.message,
    });
  });
}

// Register IPC handlers for update actions
export function registerUpdateHandlers() {
  // Check for updates
  ipcMain.handle('update:check', async () => {
    try {
      console.log('[AutoUpdater] Manual update check triggered');
      const result = await autoUpdater.checkForUpdates();
      return { success: true, result };
    } catch (error: any) {
      console.error('[AutoUpdater] Check failed:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Download update
  ipcMain.handle('update:download', async () => {
    try {
      console.log('[AutoUpdater] Starting download...');
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error: any) {
      console.error('[AutoUpdater] Download failed:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Install update (quit and install)
  ipcMain.handle('update:install', () => {
    console.log('[AutoUpdater] Installing update and restarting...');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  });

  // Get current version
  ipcMain.handle('update:get-version', () => {
    const { app } = require('electron');
    return {
      version: app.getVersion(),
      name: app.getName(),
    };
  });

  console.log('[AutoUpdater] IPC handlers registered');
}

// Check for updates on app start (with delay)
export function checkForUpdatesOnStart() {
  // Wait 10 seconds after app start to check for updates
  setTimeout(() => {
    console.log('[AutoUpdater] Auto-checking for updates on startup...');
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] Startup check failed:', err.message);
    });
  }, 10000);
}
