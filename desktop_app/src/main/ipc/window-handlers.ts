import { ipcMain, app } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { getMainWindow, closeMainWindow } from '../windows/main-window';
import { APP_NAME, APP_VERSION } from '../../shared/constants';

export function registerWindowHandlers(): void {
  // Window minimize
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    const window = getMainWindow();
    if (window) {
      window.minimize();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // Window maximize/restore
  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    const window = getMainWindow();
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      return { success: true, maximized: window.isMaximized() };
    }
    return { success: false, error: 'Window not found' };
  });

  // Window close
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    closeMainWindow();
    return { success: true };
  });

  // Get app version
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => {
    return {
      success: true,
      version: APP_VERSION,
      name: APP_NAME,
    };
  });

  // Quit app
  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
    app.quit();
    return { success: true };
  });
}
