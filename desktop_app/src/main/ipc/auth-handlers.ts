import { ipcMain } from 'electron';
import bcrypt from 'bcryptjs';
import Store from 'electron-store';
import { IPC_CHANNELS } from '../../shared/types';
import type { LoginCredentials, AuthResponse } from '../../shared/types';
import DatabaseManager from '../database/database-manager';
import { STORAGE_KEYS } from '../../shared/constants';

const store = new Store();

export function registerAuthHandlers(): void {
  const dbManager = DatabaseManager.getInstance();

  // Login
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_, credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const prisma = dbManager.getPrismaClient();

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
        include: { branch: true },
      });

      if (!user) {
        return { success: false, message: 'Invalid email or password' };
      }

      // Check if user is active
      if (user.status !== 'ACTIVE') {
        return { success: false, message: 'Account is inactive. Contact administrator.' };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        return { success: false, message: 'Invalid email or password' };
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Store user session
      store.set(STORAGE_KEYS.CURRENT_USER, userWithoutPassword);

      console.log('[Auth] User logged in:', user.email);

      return {
        success: true,
        user: userWithoutPassword as any,
      };
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      return { success: false, message: error.message || 'Login failed' };
    }
  });

  // Logout
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    try {
      store.delete(STORAGE_KEYS.CURRENT_USER);
      console.log('[Auth] User logged out');
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });

  // Get current user
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_CURRENT_USER, async () => {
    try {
      const user = store.get(STORAGE_KEYS.CURRENT_USER);
      return { success: true, user: user || null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
