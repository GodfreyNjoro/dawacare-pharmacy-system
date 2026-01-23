import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Module from 'module';

let prismaConfigured = false;
let unpackedNodeModulesPath: string | null = null;
let dotPrismaClientSqlitePath: string | null = null;
let dotPrismaClientPostgresPath: string | null = null;

// Track which client we need to load
let currentClientType: 'sqlite' | 'postgresql' = 'sqlite';

/**
 * Configure Prisma for production Electron app
 */
export function configurePrismaForProduction(clientType: 'sqlite' | 'postgresql' = 'sqlite'): void {
  currentClientType = clientType;
  
  if (prismaConfigured) return;
  prismaConfigured = true;

  const isPackaged = app.isPackaged;
  console.log('[Prisma] App is packaged:', isPackaged);
  console.log('[Prisma] Client type:', clientType);

  if (!isPackaged) {
    console.log('[Prisma] Development mode');
    return;
  }

  const appPath = app.getAppPath();
  const resourcesPath = path.dirname(appPath);
  const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
  unpackedNodeModulesPath = path.join(unpackedPath, 'node_modules');
  dotPrismaClientSqlitePath = path.join(unpackedNodeModulesPath, '.prisma', 'client-sqlite');
  dotPrismaClientPostgresPath = path.join(unpackedNodeModulesPath, '.prisma', 'client-postgresql');
  
  // Fallback to old single client path for backwards compatibility
  const dotPrismaClientPath = path.join(unpackedNodeModulesPath, '.prisma', 'client');
  if (!fs.existsSync(dotPrismaClientSqlitePath) && fs.existsSync(dotPrismaClientPath)) {
    dotPrismaClientSqlitePath = dotPrismaClientPath;
  }
  
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

  // Get the correct client path based on type
  const activeClientPath = clientType === 'postgresql' ? dotPrismaClientPostgresPath : dotPrismaClientSqlitePath;
  
  // Check .prisma/client
  if (activeClientPath && fs.existsSync(activeClientPath)) {
    const files = fs.readdirSync(activeClientPath);
    console.log('[Prisma] .prisma/' + (clientType === 'postgresql' ? 'client-postgresql' : 'client-sqlite') + ' files:', files);
    
    const defaultJsPath = path.join(activeClientPath, 'default.js');
    console.log('[Prisma] default.js exists:', fs.existsSync(defaultJsPath));
    
    const engineFile = files.find(f => f.includes('query_engine') || f.includes('query-engine'));
    if (engineFile) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(activeClientPath, engineFile);
      console.log('[Prisma] Engine:', process.env.PRISMA_QUERY_ENGINE_LIBRARY);
    }
  } else {
    console.error('[Prisma] ERROR: .prisma/' + (clientType === 'postgresql' ? 'client-postgresql' : 'client-sqlite') + ' NOT FOUND!');
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

    // Get the correct client path based on current type
    const activeClientPath = currentClientType === 'postgresql' ? dotPrismaClientPostgresPath : dotPrismaClientSqlitePath;

    // Handle .prisma/client/default specifically (the main issue)
    if (request === '.prisma/client/default' || request === '.prisma\\client\\default' ||
        request === '.prisma/client-sqlite/default' || request === '.prisma\\client-sqlite\\default' ||
        request === '.prisma/client-postgresql/default' || request === '.prisma\\client-postgresql\\default') {
      const targetPath = path.join(activeClientPath!, 'default.js');
      console.log('[Prisma] Intercepting .prisma/client/default ->', targetPath);
      if (fs.existsSync(targetPath)) {
        return targetPath;
      }
      console.log('[Prisma] WARNING: default.js not found at', targetPath);
    }
    
    // Handle other .prisma paths
    if (request.startsWith('.prisma/') || request.startsWith('.prisma\\')) {
      const relativePart = request.replace(/^\.prisma[\/\\](client-sqlite|client-postgresql|client)[\/\\]?/, '');
      const targetPath = path.join(activeClientPath!, relativePart);
      
      const candidates = [targetPath, targetPath + '.js', targetPath + '.node'];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          console.log('[Prisma] Redirect:', request, '->', candidate);
          return candidate;
        }
      }
    }
    
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  console.log('[Prisma] Module resolution patched');
}

/**
 * Get PrismaClient for SQLite dynamically
 */
export function getSQLitePrismaClientClass(): any {
  configurePrismaForProduction('sqlite');
  
  try {
    // Try the separate client path first
    const clientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client-sqlite');
    if (fs.existsSync(clientPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient } = require(clientPath);
      console.log('[Prisma] SQLite PrismaClient loaded from client-sqlite');
      return PrismaClient;
    }
  } catch {
    // Fallback
  }
  
  // Fallback to default client path
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  console.log('[Prisma] SQLite PrismaClient loaded from default');
  return PrismaClient;
}

/**
 * Get PrismaClient for PostgreSQL dynamically
 */
export function getPostgreSQLPrismaClientClass(): any {
  configurePrismaForProduction('postgresql');
  
  try {
    // Try the separate client path first
    const clientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client-postgresql');
    if (fs.existsSync(clientPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient } = require(clientPath);
      console.log('[Prisma] PostgreSQL PrismaClient loaded from client-postgresql');
      return PrismaClient;
    }
  } catch {
    // Fallback
  }
  
  throw new Error('PostgreSQL Prisma client not found. Make sure to run: prisma generate --schema=prisma/postgresql/schema.prisma');
}

/**
 * Get PrismaClient dynamically (backwards compatible - defaults to SQLite)
 */
export function getPrismaClientClass(): any {
  return getSQLitePrismaClientClass();
}
