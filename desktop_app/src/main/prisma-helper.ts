import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Configure Prisma for production Electron app
 * This ensures Prisma can find its query engine in the unpacked asar
 */
export function configurePrismaForProduction() {
  if (!app.isPackaged) {
    // Development mode - no special configuration needed
    return;
  }

  // In production, Prisma files are unpacked in app.asar.unpacked
  const appPath = app.getAppPath();
  const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked');
  const prismaPath = path.join(unpackedPath, 'node_modules', '.prisma', 'client');

  console.log('[Prisma] App path:', appPath);
  console.log('[Prisma] Unpacked path:', unpackedPath);
  console.log('[Prisma] Looking for Prisma at:', prismaPath);

  // Set environment variable to help Prisma find its binaries
  if (fs.existsSync(prismaPath)) {
    // Determine the correct query engine based on platform
    let engineName;
    if (process.platform === 'win32') {
      engineName = 'query_engine-windows.dll.node';
    } else if (process.platform === 'darwin') {
      engineName = 'libquery_engine-darwin.dylib.node';
    } else {
      engineName = 'libquery_engine-linux-nixos.so.node';
    }

    const enginePath = path.join(prismaPath, engineName);
    if (fs.existsSync(enginePath)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
      console.log('[Prisma] Configured query engine at:', enginePath);
    } else {
      console.warn('[Prisma] Query engine not found at:', enginePath);
      // List available files for debugging
      try {
        const files = fs.readdirSync(prismaPath);
        console.log('[Prisma] Available files:', files);
      } catch (err) {
        console.error('[Prisma] Error reading directory:', err);
      }
    }
  } else {
    console.warn('[Prisma] Prisma directory not found at:', prismaPath);
    // Try to list parent directory
    const nodeModulesPath = path.join(unpackedPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      try {
        const dirs = fs.readdirSync(nodeModulesPath);
        console.log('[Prisma] Available in node_modules:', dirs.filter(d => d.includes('prisma')));
      } catch (err) {
        console.error('[Prisma] Error reading node_modules:', err);
      }
    }
  }
}
