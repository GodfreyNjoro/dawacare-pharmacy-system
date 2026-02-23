// Lazy Prisma client initialization to avoid Vercel build issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaInstance: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPrismaClient(): any {
  if (prismaInstance) return prismaInstance
  
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client')
  
  const globalForPrisma = globalThis as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any
  }
  
  if (globalForPrisma.prisma) {
    prismaInstance = globalForPrisma.prisma
  } else {
    prismaInstance = new PrismaClient()
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaInstance
    }
  }
  
  return prismaInstance
}

// Export a proxy that lazily initializes on first property access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = new Proxy({} as any, {
  get(_target, prop) {
    return getPrismaClient()[prop]
  }
})

// Transaction client type - use 'any' to avoid Prisma type export issues on Vercel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaTransactionClient = any
