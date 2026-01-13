import { BrowserWindow, screen } from 'electron';
import path from 'path';
import {
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
} from '../../shared/constants';

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(DEFAULT_WINDOW_WIDTH, width),
    height: Math.min(DEFAULT_WINDOW_HEIGHT, height),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
    },
    title: 'DawaCare POS',
    backgroundColor: '#ffffff',
    show: false, // Show only when ready
  });

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function closeMainWindow(): void {
  if (mainWindow) {
    mainWindow.close();
  }
}
