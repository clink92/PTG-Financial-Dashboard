import { promises as fs } from 'node:fs'
import path from 'node:path'

import Redis from 'ioredis'
import { z } from 'zod'

import type { MonthlyData } from '@/lib/data'
import { compareMonthKeysAsc } from '@/lib/data'

const MonthKeySchema = z.string().min(3)

// Intentionally permissive for now; we validate via TypeScript + runtime parsing
// around the parts we touch.
const MonthlyDataSchema: z.ZodType<MonthlyData> = z.custom<MonthlyData>()

const StoreFileSchema = z.record(MonthKeySchema, MonthlyDataSchema)
type StoreFile = z.infer<typeof StoreFileSchema>

// Redis client singleton
let redisClient: Redis | null = null
let redisRetryAfter = 0
const REDIS_RETRY_BACKOFF_MS = 60_000

type MemoryStore = Record<string, MonthlyData>
const MEMORY_KEY = '__ptg_month_store__'

function getMemoryStore(): MemoryStore {
	const g = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryStore }
	if (!g[MEMORY_KEY]) g[MEMORY_KEY] = {}
	return g[MEMORY_KEY]!
}

function getRedisUrl() {
	return process.env.PTG_REDIS_URL || process.env.REDIS_URL
}

function resetRedisClient() {
	if (!redisClient) return
	redisClient.disconnect()
	redisClient = null
}

function markRedisUnavailable(reason: string, err: unknown) {
	redisRetryAfter = Date.now() + REDIS_RETRY_BACKOFF_MS
	console.warn(`[monthStore] ${reason}`, err)
	resetRedisClient()
}

async function getRedisClient(): Promise<Redis | null> {
	const url = getRedisUrl()
	if (!url) return null

	if (redisRetryAfter > Date.now()) {
		return null
	}
	
	if (!redisClient) {
		console.log('[monthStore] Creating new Redis client')
		redisClient = new Redis(url, {
			maxRetriesPerRequest: 3,
			connectTimeout: 10000,
		})
		
		// Wait for connection
		redisClient.on('error', (err) => {
			console.error('[monthStore] Redis error:', err.message)
			markRedisUnavailable('Redis client entered backoff', err)
		})
	}
	
	// Check if connected
	if (redisClient.status !== 'ready') {
		try {
			await redisClient.ping()
			console.log('[monthStore] Redis connected, status:', redisClient.status)
			redisRetryAfter = 0
		} catch (err) {
			markRedisUnavailable('Redis ping failed', err)
			return null
		}
	}
	
	return redisClient
}

function hasRedisEnv() {
	return Boolean(getRedisUrl())
}

function hasVercelKVEnv() {
	return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function isServerless() {
	return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

function getLocalStorePath() {
	// Keep it out of route segments and /public.
	return path.join(process.cwd(), '.data', 'month-data.json')
}

async function ensureLocalStoreDir() {
	const p = getLocalStorePath()
	await fs.mkdir(path.dirname(p), { recursive: true })
	return p
}

async function readLocalStore(): Promise<StoreFile> {
	const p = await ensureLocalStoreDir()
	try {
		const raw = await fs.readFile(p, 'utf8')
		const parsed = JSON.parse(raw)
		const validated = StoreFileSchema.safeParse(parsed)
		return validated.success ? validated.data : {}
	} catch (err: unknown) {
		if (isErrnoException(err) && err.code === 'ENOENT') return {}
		return {}
	}
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
	return typeof err === 'object' && err !== null && 'code' in err
}

async function writeLocalStore(data: StoreFile): Promise<void> {
	if (isServerless()) return
	const p = await ensureLocalStoreDir()
	await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8')
}

async function readFallbackStore(): Promise<StoreFile> {
	const localStore = await readLocalStore()
	if (!isServerless()) return localStore

	// Serverless instances can read the traced .data bundle, but only ephemeral
	// in-memory writes are possible when Redis/KV are unavailable.
	return {
		...localStore,
		...getMemoryStore(),
	}
}

const KV_PREFIX = 'ptg:monthData:'

export async function getStoredMonthData(monthKey: string): Promise<MonthlyData | null> {
	const parsedKey = MonthKeySchema.safeParse(monthKey)
	if (!parsedKey.success) return null

	console.log('[monthStore] getStoredMonthData', { monthKey, hasRedis: hasRedisEnv(), hasKV: hasVercelKVEnv(), isServerless: isServerless() })

	// Try Redis first (works on Vercel with Redis Cloud)
	if (hasRedisEnv()) {
		const redis = await getRedisClient()
		console.log('[monthStore] Using Redis, client exists:', !!redis)
		if (redis) {
			try {
				const raw = await redis.get(`${KV_PREFIX}${parsedKey.data}`)
				console.log('[monthStore] Redis get result:', { key: `${KV_PREFIX}${parsedKey.data}`, hasData: !!raw, dataLen: raw?.length })
				if (!raw) return null
				try {
					return JSON.parse(raw) as MonthlyData
				} catch {
					return null
				}
			} catch (err) {
				console.warn('[monthStore] Redis get failed, falling back:', err)
			}
		}
	}

	// Fallback to Vercel KV if configured
	if (hasVercelKVEnv()) {
		const { kv } = await import('@vercel/kv')
		const v = await kv.get<MonthlyData>(`${KV_PREFIX}${parsedKey.data}`)
		return v ?? null
	}

	const store = await readFallbackStore()
	return store[parsedKey.data] ?? null
}

export async function setStoredMonthData(monthKey: string, data: MonthlyData): Promise<void> {
	const parsedKey = MonthKeySchema.safeParse(monthKey)
	if (!parsedKey.success) {
		throw new Error('Invalid monthKey')
	}

	const lineItemCount = data.incomeStatement?.lineItems?.length ?? 0
	console.log('[monthStore] setStoredMonthData', { monthKey, lineItemCount, hasRedis: hasRedisEnv(), hasKV: hasVercelKVEnv() })

	// Try Redis first
	if (hasRedisEnv()) {
		const redis = await getRedisClient()
		console.log('[monthStore] Attempting Redis set, client exists:', !!redis)
		if (redis) {
			try {
				const jsonStr = JSON.stringify(data)
				console.log('[monthStore] Saving to Redis, data length:', jsonStr.length)
				await redis.set(`${KV_PREFIX}${parsedKey.data}`, jsonStr)
				console.log('[monthStore] Redis set SUCCESS')
				return
			} catch (err) {
				console.warn('[monthStore] Redis set failed, falling back:', err)
			}
		}
	}

	// Fallback to Vercel KV
	if (hasVercelKVEnv()) {
		const { kv } = await import('@vercel/kv')
		await kv.set(`${KV_PREFIX}${parsedKey.data}`, data)
		return
	}

	// Local file storage
	if (isServerless()) {
		console.warn('[monthStore] Falling back to in-memory serverless write', { monthKey })
		getMemoryStore()[parsedKey.data] = data
		return
	}
	const store = await readLocalStore()
	store[parsedKey.data] = data
	await writeLocalStore(store)
}

export async function deleteStoredMonthData(monthKey: string): Promise<void> {
	const parsedKey = MonthKeySchema.safeParse(monthKey)
	if (!parsedKey.success) {
		throw new Error('Invalid monthKey')
	}

	// Try Redis first
	if (hasRedisEnv()) {
		const redis = await getRedisClient()
		if (redis) {
			try {
				await redis.del(`${KV_PREFIX}${parsedKey.data}`)
				return
			} catch (err) {
				console.warn('[monthStore] Redis del failed, falling back:', err)
			}
		}
	}

	// Fallback to Vercel KV
	if (hasVercelKVEnv()) {
		const { kv } = await import('@vercel/kv')
		await kv.del(`${KV_PREFIX}${parsedKey.data}`)
		return
	}

	// Local file storage
	if (isServerless()) {
		delete getMemoryStore()[parsedKey.data]
		return
	}
	const store = await readLocalStore()
	delete store[parsedKey.data]
	await writeLocalStore(store)
}

export async function listStoredMonthKeys(): Promise<string[]> {
	// Redis
	if (hasRedisEnv()) {
		const redis = await getRedisClient()
		if (redis) {
			try {
				const keys: string[] = []
				const seen = new Set<string>()
				let cursor = '0'
				const match = `${KV_PREFIX}*`
				const maxKeys = 500

				do {
					// eslint-disable-next-line no-await-in-loop
					const res = await redis.scan(cursor, 'MATCH', match, 'COUNT', '100')
					cursor = res[0]
					for (const k of res[1]) {
						if (!k.startsWith(KV_PREFIX)) continue
						const monthKey = k.slice(KV_PREFIX.length)
						if (!monthKey || seen.has(monthKey)) continue
						seen.add(monthKey)
						keys.push(monthKey)
						if (keys.length >= maxKeys) break
					}
				} while (cursor !== '0' && keys.length < maxKeys)

				return keys.sort(compareMonthKeysAsc)
			} catch (err) {
				console.warn('[monthStore] Redis scan failed, falling back:', err)
			}
		}
	}

	// Vercel KV (Upstash Redis under the hood)
	if (hasVercelKVEnv()) {
		try {
			const { kv } = await import('@vercel/kv')
			const keys: string[] = []
			const seen = new Set<string>()
			let cursor = '0'
			const match = `${KV_PREFIX}*`
			const maxKeys = 500

			do {
				// eslint-disable-next-line no-await-in-loop
				const [next, found] = await kv.scan(cursor, { match, count: 100 })
				cursor = next
				for (const k of found) {
					if (!k.startsWith(KV_PREFIX)) continue
					const monthKey = k.slice(KV_PREFIX.length)
					if (!monthKey || seen.has(monthKey)) continue
					seen.add(monthKey)
					keys.push(monthKey)
					if (keys.length >= maxKeys) break
				}
			} while (cursor !== '0' && keys.length < maxKeys)

			return keys.sort(compareMonthKeysAsc)
		} catch (err) {
			console.warn('[monthStore] KV scan failed, falling back:', err)
		}
	}

	const store = await readFallbackStore()
	return Object.keys(store).sort(compareMonthKeysAsc)
}
