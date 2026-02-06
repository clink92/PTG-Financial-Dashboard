import { promises as fs } from 'node:fs'
import path from 'node:path'

import Redis from 'ioredis'
import { z } from 'zod'

import type { ImportedPdfKind } from '@/lib/pdfImport'

export type ImportLogEntry = {
  importedAt: string
  monthKey: string
  requestedMonthKey: string
  sources: Array<{ fileName: string; kind: ImportedPdfKind; size?: number; detectedMonthKey?: string | null }>
  warnings: string[]
}

const ImportLogEntrySchema = z.object({
  importedAt: z.string(),
  monthKey: z.string(),
  requestedMonthKey: z.string(),
  sources: z.array(
    z.object({
      fileName: z.string(),
      kind: z.string() as unknown as z.ZodType<ImportedPdfKind>,
      size: z.number().optional(),
      detectedMonthKey: z.string().nullable().optional(),
    })
  ),
  warnings: z.array(z.string()),
})

const ImportLogSchema = z.array(ImportLogEntrySchema)
type ImportLog = z.infer<typeof ImportLogSchema>

let redisClient: Redis | null = null

type MemoryLogStore = Record<string, ImportLog>
const MEMORY_LOG_KEY = '__ptg_import_log_store__'

function getMemoryLogStore(): MemoryLogStore {
  const g = globalThis as typeof globalThis & { [MEMORY_LOG_KEY]?: MemoryLogStore }
  if (!g[MEMORY_LOG_KEY]) g[MEMORY_LOG_KEY] = {}
  return g[MEMORY_LOG_KEY]!
}

function getRedisClient(): Redis | null {
  const url = process.env.PTG_REDIS_URL || process.env.REDIS_URL
  if (!url) return null
  if (!redisClient) {
    redisClient = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true })
  }
  return redisClient
}

function hasRedisEnv() {
  return Boolean(process.env.PTG_REDIS_URL || process.env.REDIS_URL)
}

function hasVercelKVEnv() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

function getLocalStorePath() {
  return path.join(process.cwd(), '.data', 'import-log.json')
}

async function ensureLocalStoreDir() {
  const p = getLocalStorePath()
  await fs.mkdir(path.dirname(p), { recursive: true })
  return p
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === 'object' && err !== null && 'code' in err
}

async function readLocalStore(): Promise<Record<string, ImportLog>> {
  if (isServerless()) return {}
  const p = await ensureLocalStoreDir()
  try {
    const raw = await fs.readFile(p, 'utf8')
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Record<string, ImportLog>
  } catch (err: unknown) {
    if (isErrnoException(err) && err.code === 'ENOENT') return {}
    return {}
  }
}

async function writeLocalStore(data: Record<string, ImportLog>): Promise<void> {
  if (isServerless()) return
  const p = await ensureLocalStoreDir()
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8')
}

const KV_PREFIX = 'ptg:importLog:'

export async function getImportLog(monthKey: string): Promise<ImportLogEntry[]> {
  const key = `${KV_PREFIX}${monthKey}`

  // Redis
  if (hasRedisEnv()) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const raw = await redis.get(key)
        if (!raw) return []
        try {
          const parsed = JSON.parse(raw)
          const validated = ImportLogSchema.safeParse(parsed)
          return validated.success ? validated.data : []
        } catch {
          return []
        }
      } catch (err) {
        console.warn('[importLogStore] Redis get failed, falling back:', err)
      }
    }
  }

  // Vercel KV
  if (hasVercelKVEnv()) {
    const { kv } = await import('@vercel/kv')
    const v = await kv.get<unknown>(key)
    const validated = ImportLogSchema.safeParse(v)
    return validated.success ? validated.data : []
  }

  // Local
  if (isServerless()) {
    const mem = getMemoryLogStore()[monthKey] ?? []
    const validated = ImportLogSchema.safeParse(mem)
    return validated.success ? validated.data : []
  }
  const store = await readLocalStore()
  const validated = ImportLogSchema.safeParse(store[monthKey] ?? [])
  return validated.success ? validated.data : []
}

export async function appendImportLog(monthKey: string, entry: ImportLogEntry, opts?: { maxEntries?: number }) {
  const maxEntries = Math.max(1, Math.floor(opts?.maxEntries ?? 25))
  const key = `${KV_PREFIX}${monthKey}`

  const existing = await getImportLog(monthKey)
  const next = [entry, ...existing].slice(0, maxEntries)

  // Redis
  if (hasRedisEnv()) {
    const redis = getRedisClient()
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(next))
        return
      } catch (err) {
        console.warn('[importLogStore] Redis set failed, falling back:', err)
      }
    }
  }

  // Vercel KV
  if (hasVercelKVEnv()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(key, next)
    return
  }

  // Local
  if (isServerless()) {
    getMemoryLogStore()[monthKey] = next
    return
  }
  const store = await readLocalStore()
  store[monthKey] = next
  await writeLocalStore(store)
}

