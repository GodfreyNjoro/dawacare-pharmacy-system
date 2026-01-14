import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Module from 'module';

let prismaConfigured = false;
let unpackedNodeModulesPath: string | null = null;
let dotPrismaClientPath: string | null = null;

/**
 * Configure Prisma for production Electron app
 */
export function configurePrismaForProduction(): void {
  if (prismaConfigured) return;
  prismaConfigured = true;

  const isPackaged = app.isPackaged;
  console.log('[Prisma] App is packaged:', isPackaged);

  if (!isPackaged) {
    console.log('[Prisma] Development mode');
    return;
  }

  const appPath = app.getAppPath();
  const resourcesPath = path.dirname(appPath);
  const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
  unpackedNodeModulesPath = path.join(unpackedPath, 'node_modules');
  dotPrismaClientPath = path.join(unpackedNodeModulesPath, '.prisma', 'client');
  
  console.log('[Prisma] Resources path:', resourcesPath);
  console.log('[Prisma] Unpacked path:', unpackedPath);
  console.log('[Prisma] Unpacked exists:', fs.existsSync(unpackedPath));

  // List EVERYTHING in resources directory
  if (fs.existsSync(resourcesPath)) {
    const resourceContents = fs.readdirSync(resourcesPath);
    console.log('[Prisma] Resources directory contents:', resourceContents);
  }

  // List what's in the unpacked directory  
  if (fs.existsSync(unpackedPath)) {
    const unpackedContents = fs.readdirSync(unpackedPath);
    console.log('[Prisma] app.asar.unpacked contents:', unpackedContents);
  }

  if (fs.existsSync(unpackedNodeModulesPath)) {
    const dirs = fs.readdirSync(unpackedNodeModulesPath);
    console.log('[Prisma] Unpacked node_modules contents:', dirs);
    
    // Add unpacked path to Node's module search paths
    const modulePaths = (Module as any)._nodeModulePaths;
    (Module as any)._nodeModulePaths = function(from: string) {
      const paths = modulePaths.call(this, from);
      // Prepend our unpacked path
      if (!paths.includes(unpackedNodeModulesPath)) {
        paths.unshift(unpackedNodeModulesPath);
      }
      return paths;
    };
    console.log('[Prisma] Added unpacked path to module search paths');
  } else {
    console.error('[Prisma] ERROR: unpacked node_modules does not exist!');
  }

  // Check .prisma/client
  if (fs.existsSync(dotPrismaClientPath)) {
    const files = fs.readdirSync(dotPrismaClientPath);
    console.log('[Prisma] .prisma/client files:', files);
    
    const defaultJsPath = path.join(dotPrismaClientPath, 'default.js');
    console.log('[Prisma] default.js exists:', fs.existsSync(defaultJsPath));
    
    const engineFile = files.find(f => f.includes('query_engine') || f.includes('query-engine'));
    if (engineFile) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(dotPrismaClientPath, engineFile);
      console.log('[Prisma] Engine:', process.env.PRISMA_QUERY_ENGINE_LIBRARY);
    }
  } else {
    console.error('[Prisma] ERROR: .prisma/client NOT FOUND!');
    const prismaDir = path.join(unpackedNodeModulesPath, '.prisma');
    console.log('[Prisma] .prisma dir exists:', fs.existsSync(prismaDir));
    if (fs.existsSync(prismaDir)) {
      console.log('[Prisma] .prisma contents:', fs.readdirSync(prismaDir));
    }
  }

  // Patch Module._resolveFilename
  const originalResolveFilename = (Module as any)._resolveFilename;
  (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options?: any) {
    
    // Log ALL prisma-related requests for debugging
    if (request.includes('prisma') || request.includes('.prisma')) {
      console.log('[Prisma] Resolve request:', request);
    }
    
    if (!unpackedNodeModulesPath) {
      return originalResolveFilename.call(this, request, parent, isMain, options);
    }

    // Handle .prisma/client/default specifically (the main issue)
    if (request === '.prisma/client/default' || request === '.prisma\\client\\default') {
      const targetPath = path.join(dotPrismaClientPath!, 'default.js');
      console.log('[Prisma] Intercepting .prisma/client/default ->', targetPath);
      if (fs.existsSync(targetPath)) {
        return targetPath;
      }
      console.log('[Prisma] WARNING: default.js not found at', targetPath);
    }
    
    // Handle other .prisma paths
    if (request.startsWith('.prisma/') || request.startsWith('.prisma\\')) {
      const relativePart = request.replace(/^\.prisma[\/\\]/, '');
      const targetPath = path.join(unpackedNodeModulesPath, '.prisma', relativePart);
      
      const candidates = [targetPath, targetPath + '.js', targetPath + '.node'];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          console.log('[Prisma] Redirect:', request, '->', candidate);
          return candidate;
        }
      }
    }
    
    // Handle @prisma paths - DON'T redirect these, let Node resolve them naturally
    // after we've set up the module paths
    // The key is to intercept .prisma/client which is the generated client
    
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
