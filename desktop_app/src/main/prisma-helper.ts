import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let prismaConfigured = false;

/**
 * Configure Prisma for production Electron app
 * This MUST be called before any Prisma imports
 */
export function configurePrismaForProduction(): void {
  if (prismaConfigured) return;
  prismaConfigured = true;

  const isPackaged = app.isPackaged;
  console.log('[Prisma] App is packaged:', isPackaged);

  if (!isPackaged) {
    // Development mode - no special configuration needed
    console.log('[Prisma] Development mode - using default paths');
    return;
  }

  // In production, Prisma files are unpacked in app.asar.unpacked
  const appPath = app.getAppPath();
  const resourcesPath = path.dirname(appPath);
  const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
  
  console.log('[Prisma] App path:', appPath);
  console.log('[Prisma] Resources path:', resourcesPath);
  console.log('[Prisma] Unpacked path:', unpackedPath);

  // Check multiple possible locations for Prisma
  const possiblePrismaPaths = [
    path.join(unpackedPath, 'node_modules', '.prisma', 'client'),
    path.join(unpackedPath, 'node_modules', '@prisma', 'client'),
    path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client'),
  ];

  let prismaPath: string | null = null;
  for (const p of possiblePrismaPaths) {
    if (fs.existsSync(p)) {
      prismaPath = p;
      console.log('[Prisma] Found Prisma at:', p);
      break;
    }
  }

  if (!prismaPath) {
    console.error('[Prisma] Could not find Prisma client directory!');
    console.error('[Prisma] Searched paths:', possiblePrismaPaths);
    
    // List what's actually in the unpacked directory
    if (fs.existsSync(unpackedPath)) {
      try {
        console.log('[Prisma] Contents of unpacked:', fs.readdirSync(unpackedPath));
        const nmPath = path.join(unpackedPath, 'node_modules');
        if (fs.existsSync(nmPath)) {
          const contents = fs.readdirSync(nmPath);
          console.log('[Prisma] node_modules contents:', contents.filter(d => d.includes('prisma') || d === '.prisma'));
        }
      } catch (err) {
        console.error('[Prisma] Error listing directory:', err);
      }
    }
    return;
  }

  // List files in the prisma client directory
  try {
    const files = fs.readdirSync(prismaPath);
    console.log('[Prisma] Files in client dir:', files);
  } catch (err) {
    console.error('[Prisma] Error listing prisma dir:', err);
  }

  // Determine the correct query engine based on platform
  const engineNames: Record<string, string[]> = {
    win32: ['query_engine-windows.dll.node', 'query-engine-windows.dll.node'],
    darwin: [
      'libquery_engine-darwin.dylib.node',
      'libquery_engine-darwin-arm64.dylib.node',
      'query-engine-darwin.dylib.node',
      'query-engine-darwin-arm64.dylib.node',
    ],
    linux: [
      'libquery_engine-debian-openssl-3.0.x.so.node',
      'libquery_engine-debian-openssl-1.1.x.so.node',
      'libquery_engine-linux-musl.so.node',
      'libquery_engine-rhel-openssl-3.0.x.so.node',
      'query-engine-debian-openssl-3.0.x.so.node',
    ],
  };

  const platform = process.platform;
  const candidates = engineNames[platform] || [];

  let enginePath: string | null = null;
  for (const engineName of candidates) {
    const testPath = path.join(prismaPath, engineName);
    if (fs.existsSync(testPath)) {
      enginePath = testPath;
      break;
    }
  }

  if (enginePath) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
    console.log('[Prisma] Set PRISMA_QUERY_ENGINE_LIBRARY:', enginePath);
  } else {
    console.warn('[Prisma] Query engine not found! Tried:', candidates);
  }

  // Also set the schema path
  const schemaPath = path.join(unpackedPath, 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    process.env.PRISMA_SCHEMA = schemaPath;
    console.log('[Prisma] Set PRISMA_SCHEMA:', schemaPath);
  }
}

/**
 * Get PrismaClient dynamically after configuration
 * This avoids static import issues in production
 */
export function getPrismaClientClass(): any {
  // Ensure configuration is done first
  configurePrismaForProduction();
  
  // Dynamic require to avoid static import issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  return PrismaClient;
}
