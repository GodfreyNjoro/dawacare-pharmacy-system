import { BrowserWindow, screen, nativeImage, app } from 'electron';
import path from 'path';
import {
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
} from '../../shared/constants';

let mainWindow: BrowserWindow | null = null;

// Get the icon path based on environment
function getIconPath(): string {
  if (process.env.NODE_ENV === 'development') {
    // In development, use the build folder directly
    return path.join(process.cwd(), 'build', 'icons', 'icon_256x256.png');
  } else {
    // In production, the icon is in the app's resources
    // __dirname is dist/main/src/main/windows, need to go to build/icons
    const possiblePaths = [
      path.join(__dirname, '../../../../../build/icons/icon_256x256.png'),
      path.join(app.getAppPath(), 'build', 'icons', 'icon_256x256.png'),
      path.join(process.resourcesPath || '', 'build', 'icons', 'icon_256x256.png'),
    ];
    
    for (const iconPath of possiblePaths) {
      try {
        require('fs').accessSync(iconPath);
        return iconPath;
      } catch {
        continue;
      }
    }
    
    // Fallback to first path
    return possiblePaths[0];
  }
}

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Load icon for taskbar
  const iconPath = getIconPath();
  console.log('[MainWindow] Loading icon from:', iconPath);
  
  let windowIcon;
  try {
    windowIcon = nativeImage.createFromPath(iconPath);
    if (windowIcon.isEmpty()) {
      console.warn('[MainWindow] Icon is empty, using default');
      windowIcon = undefined;
    }
  } catch (error) {
    console.warn('[MainWindow] Failed to load icon:', error);
    windowIcon = undefined;
  }

  mainWindow = new BrowserWindow({
    width: Math.min(DEFAULT_WINDOW_WIDTH, width),
    height: Math.min(DEFAULT_WINDOW_HEIGHT, height),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    icon: windowIcon,
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
    // In production: __dirname is dist/main/src/main/windows
    // Need to go up 4 levels to dist/ then into renderer/
    const rendererPath = path.join(__dirname, '../../../../renderer/index.html');
    console.log('[MainWindow] Loading renderer from:', rendererPath);
    mainWindow.loadFile(rendererPath);
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
