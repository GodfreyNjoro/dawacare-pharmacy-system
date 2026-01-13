import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import type { LoginCredentials, DatabaseConfig } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth APIs
  login: (credentials: LoginCredentials) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),
  logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
  getCurrentUser: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_CURRENT_USER),

  // Database APIs
  getDbConfig: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_CONFIG),
  setDbConfig: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_SET_CONFIG, config),
  testDbConnection: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_TEST_CONNECTION, config),
  initializeDb: (config: DatabaseConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_INITIALIZE, config),

  // Settings APIs
  getSetting: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  getAllSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),

  // Sync APIs
  startSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_START),
  stopSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STOP),
  getSyncStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STATUS),
  manualSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_MANUAL),

  // Window APIs
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),

  // App APIs
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),
  quitApp: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),
});

// Type definitions for TypeScript
export interface ElectronAPI {
  // Auth
  login: (credentials: LoginCredentials) => Promise<any>;
  logout: () => Promise<any>;
  getCurrentUser: () => Promise<any>;

  // Database
  getDbConfig: () => Promise<any>;
  setDbConfig: (config: DatabaseConfig) => Promise<any>;
  testDbConnection: (config: DatabaseConfig) => Promise<any>;
  initializeDb: (config: DatabaseConfig) => Promise<any>;

  // Settings
  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: string) => Promise<any>;
  getAllSettings: () => Promise<any>;

  // Sync
  startSync: () => Promise<any>;
  stopSync: () => Promise<any>;
  getSyncStatus: () => Promise<any>;
  manualSync: () => Promise<any>;

  // Window
  minimizeWindow: () => Promise<any>;
  maximizeWindow: () => Promise<any>;
  closeWindow: () => Promise<any>;

  // App
  getAppVersion: () => Promise<any>;
  quitApp: () => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
