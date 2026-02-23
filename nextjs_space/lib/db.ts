// Lazy Prisma client initialization to avoid Vercel build issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPrismaClient(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client')
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

// Use singleton pattern with global cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Transaction client type - use 'any' to avoid Prisma type export issues on Vercel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaTransactionClient = any
