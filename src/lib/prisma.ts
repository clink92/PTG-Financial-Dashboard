import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __ptgPrismaClient__: PrismaClient | undefined
}

export function getPrismaDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL || null
}

export function hasPrismaDatabaseEnv(): boolean {
  return Boolean(getPrismaDatabaseUrl())
}

export function getPrismaClient(): PrismaClient | null {
  const url = getPrismaDatabaseUrl()
  if (!url) return null

  // Prisma schema uses DATABASE_URL; accept alternate env names for convenience.
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url
  }

  if (!globalThis.__ptgPrismaClient__) {
    globalThis.__ptgPrismaClient__ = new PrismaClient()
  }

  return globalThis.__ptgPrismaClient__
}
