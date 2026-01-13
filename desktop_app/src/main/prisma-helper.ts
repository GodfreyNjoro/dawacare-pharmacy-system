import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Module from 'module';

let prismaConfigured = false;
let unpackedNodeModulesPath: string | null = null;

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
  console.log('[Prisma] Unpacked path:', unpackedPath);
  console.log('[Prisma] Unpacked node_modules:', unpackedNodeModulesPath);

  // Verify unpacked directory exists
  if (!fs.existsSync(unpackedNodeModulesPath)) {
    console.error('[Prisma] Unpacked node_modules not found!');
    return;
  }

  // List prisma-related directories
  try {
    const contents = fs.readdirSync(unpackedNodeModulesPath);
    const prismaRelated = contents.filter(d => d.includes('prisma') || d === '.prisma');
    console.log('[Prisma] Found in unpacked node_modules:', prismaRelated);
  } catch (err) {
    console.error('[Prisma] Error listing unpacked node_modules:', err);
  }

  // Check .prisma/client directory
  const prismaClientPath = path.join(unpackedNodeModulesPath, '.prisma', 'client');
  if (fs.existsSync(prismaClientPath)) {
    try {
      const files = fs.readdirSync(prismaClientPath);
      console.log('[Prisma] .prisma/client contents:', files);
      
      // Find query engine
      const engineFile = files.find(f => f.includes('query_engine') || f.includes('query-engine'));
      if (engineFile) {
        const enginePath = path.join(prismaClientPath, engineFile);
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
        console.log('[Prisma] Set PRISMA_QUERY_ENGINE_LIBRARY:', enginePath);
      }
    } catch (err) {
      console.error('[Prisma] Error reading .prisma/client:', err);
    }
  }

  // Set schema path
  const schemaPath = path.join(unpackedPath, 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    process.env.PRISMA_SCHEMA = schemaPath;
    console.log('[Prisma] Set PRISMA_SCHEMA:', schemaPath);
  }

  // Add unpacked node_modules to module search paths
  // This ensures require('@prisma/client') finds the unpacked version
  const originalResolveLookupPaths = (Module as any)._resolveLookupPaths;
  (Module as any)._resolveLookupPaths = function(request: string, parent: any) {
    const result = originalResolveLookupPaths.call(this, request, parent);
    if (request.includes('prisma') && unpackedNodeModulesPath) {
      // Prepend unpacked path for prisma modules
      if (Array.isArray(result)) {
        if (!result.includes(unpackedNodeModulesPath)) {
          result.unshift(unpackedNodeModulesPath);
        }
      } else if (result && Array.isArray(result.paths)) {
        if (!result.paths.includes(unpackedNodeModulesPath)) {
          result.paths.unshift(unpackedNodeModulesPath);
        }
      }
    }
    return result;
  };

  console.log('[Prisma] Module resolution patched for unpacked directory');
}

/**
 * Get PrismaClient dynamically after configuration
 * This loads from the unpacked directory in production
 */
export function getPrismaClientClass(): any {
  // Ensure configuration is done first
  configurePrismaForProduction();
  
  if (app.isPackaged && unpackedNodeModulesPath) {
    // In production, explicitly require from unpacked path
    const prismaClientPath = path.join(unpackedNodeModulesPath, '@prisma', 'client');
    console.log('[Prisma] Loading PrismaClient from:', prismaClientPath);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient } = require(prismaClientPath);
      console.log('[Prisma] PrismaClient loaded successfully');
      return PrismaClient;
    } catch (err) {
      console.error('[Prisma] Failed to load from unpacked path:', err);
      // Fallback to default require
    }
  }
  
  // Development mode or fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  return PrismaClient;
}
