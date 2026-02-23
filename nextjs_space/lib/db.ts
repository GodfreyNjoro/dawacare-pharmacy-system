// Dynamic import to avoid Vercel build issues with @prisma/client exports
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const PrismaClientModule = require('@prisma/client')
const PrismaClient = PrismaClientModule.PrismaClient

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Transaction client type - use 'any' to avoid Prisma type export issues on Vercel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaTransactionClient = any
