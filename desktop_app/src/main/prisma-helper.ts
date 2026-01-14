import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Module from 'module';

let prismaConfigured = false;
let unpackedNodeModulesPath: string | null = null;

/**
 * Configure Prisma for production Electron app
 * Patches Node's module resolution to load ALL prisma modules from unpacked path
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
  console.log('[Prisma] Unpacked node_modules:', unpackedNodeModulesPath);

  // Verify unpacked directories exist
  const prismaClientDir = path.join(unpackedNodeModulesPath, '.prisma', 'client');
  const atPrismaDir = path.join(unpackedNodeModulesPath, '@prisma', 'client');
  
  console.log('[Prisma] Checking .prisma/client:', fs.existsSync(prismaClientDir));
  console.log('[Prisma] Checking @prisma/client:', fs.existsSync(atPrismaDir));

  if (fs.existsSync(prismaClientDir)) {
    const files = fs.readdirSync(prismaClientDir);
    console.log('[Prisma] .prisma/client files:', files);
    
    // Set query engine path
    const engineFile = files.find(f => f.includes('query_engine') || f.includes('query-engine'));
    if (engineFile) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(prismaClientDir, engineFile);
      console.log('[Prisma] Engine path:', process.env.PRISMA_QUERY_ENGINE_LIBRARY);
    }
  } else {
    console.error('[Prisma] ERROR: .prisma/client not found in unpacked!');
  }

  // CRITICAL: Patch Module._resolveFilename to intercept ALL prisma requires
  const originalResolveFilename = (Module as any)._resolveFilename;
  (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options?: any) {
    
    // Only intercept if unpacked path is set and request is prisma-related
    if (unpackedNodeModulesPath && (request.includes('prisma') || request.startsWith('.prisma'))) {
      let newRequest: string | null = null;
      
      // Handle @prisma/client and subpaths
      if (request.startsWith('@prisma/')) {
        newRequest = path.join(unpackedNodeModulesPath, request);
      }
      // Handle .prisma/client (note: starts with dot, treated as module name not relative path)
      else if (request.startsWith('.prisma/') || request === '.prisma') {
        newRequest = path.join(unpackedNodeModulesPath, request);
      }
      
      if (newRequest) {
        // Check various extensions
        const candidates = [
          newRequest,
          newRequest + '.js',
          newRequest + '.node',
          path.join(newRequest, 'index.js'),
          path.join(newRequest, 'default.js'),
        ];
        
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            console.log('[Prisma] Redirect:', request, '->', candidate);
            return candidate;
          }
        }
        
        // Even if file check fails, try the redirect anyway
        console.log('[Prisma] Forcing redirect:', request, '->', newRequest);
        try {
          return originalResolveFilename.call(this, newRequest, parent, isMain, options);
        } catch (e) {
          console.log('[Prisma] Redirect failed, trying original');
        }
      }
    }
    
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  console.log('[Prisma] Module resolution patched');
}

/**
 * Get PrismaClient dynamically
 */
export function getPrismaClientClass(): any {
  configurePrismaForProduction();
  
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  console.log('[Prisma] PrismaClient loaded');
  return PrismaClient;
}
