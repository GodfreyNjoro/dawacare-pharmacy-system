import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Module from 'module';

let prismaConfigured = false;
let unpackedNodeModulesPath: string | null = null;

/**
 * Configure Prisma for production Electron app
 * This MUST be called IMMEDIATELY on app start, before any other imports
 * It patches Node's module resolution to redirect all prisma requires to unpacked path
 */
export function configurePrismaForProduction(): void {
  if (prismaConfigured) return;
  prismaConfigured = true;

  const isPackaged = app.isPackaged;
  console.log('[Prisma] App is packaged:', isPackaged);

  if (!isPackaged) {
    console.log('[Prisma] Development mode - using default paths');
    return;
  }

  // In production, Prisma files are unpacked in app.asar.unpacked
  const appPath = app.getAppPath();
  const resourcesPath = path.dirname(appPath);
  const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
  unpackedNodeModulesPath = path.join(unpackedPath, 'node_modules');
  
  console.log('[Prisma] App path:', appPath);
  console.log('[Prisma] Resources path:', resourcesPath);
  console.log('[Prisma] Unpacked node_modules:', unpackedNodeModulesPath);

  // Verify unpacked directory exists
  if (!fs.existsSync(unpackedNodeModulesPath)) {
    console.error('[Prisma] ERROR: Unpacked node_modules not found!');
    return;
  }

  // Set query engine path
  const prismaClientDir = path.join(unpackedNodeModulesPath, '.prisma', 'client');
  if (fs.existsSync(prismaClientDir)) {
    const files = fs.readdirSync(prismaClientDir);
    console.log('[Prisma] .prisma/client contents:', files);
    
    const engineFile = files.find(f => f.includes('query_engine') || f.includes('query-engine'));
    if (engineFile) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(prismaClientDir, engineFile);
      console.log('[Prisma] Engine path:', process.env.PRISMA_QUERY_ENGINE_LIBRARY);
    }
  }

  // CRITICAL: Patch Module._resolveFilename to intercept ALL prisma-related requires
  // This redirects any require containing 'prisma' or '.prisma' to the unpacked path
  const originalResolveFilename = (Module as any)._resolveFilename;
  (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options?: any) {
    // Intercept prisma-related requires
    if (request.includes('prisma') || request.includes('.prisma')) {
      // Handle @prisma/client
      if (request === '@prisma/client' || request.startsWith('@prisma/client/')) {
        const newRequest = path.join(unpackedNodeModulesPath!, request.replace('@prisma/client', '@prisma/client'));
        if (fs.existsSync(newRequest) || fs.existsSync(newRequest + '.js')) {
          console.log('[Prisma] Redirecting:', request, '->', newRequest);
          return originalResolveFilename.call(this, newRequest, parent, isMain, options);
        }
      }
      
      // Handle .prisma/client (internal prisma require)
      if (request.includes('.prisma/client')) {
        const relativePath = request.includes('.prisma/client/') 
          ? request.substring(request.indexOf('.prisma/client/'))
          : '.prisma/client';
        const newRequest = path.join(unpackedNodeModulesPath!, relativePath);
        if (fs.existsSync(newRequest) || fs.existsSync(newRequest + '.js')) {
          console.log('[Prisma] Redirecting:', request, '->', newRequest);
          return originalResolveFilename.call(this, newRequest, parent, isMain, options);
        }
      }
    }
    
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  console.log('[Prisma] Module resolution patched successfully');
}

/**
 * Get PrismaClient dynamically after configuration
 */
export function getPrismaClientClass(): any {
  // Ensure configuration is done first
  configurePrismaForProduction();
  
  // Now require will be redirected to unpacked path
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  console.log('[Prisma] PrismaClient loaded successfully');
  return PrismaClient;
}
