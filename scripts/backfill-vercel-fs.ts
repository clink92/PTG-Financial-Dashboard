/* eslint-disable no-console */

import fs from 'node:fs'
import path from 'node:path'

type CookieJar = {
  setFromResponse: (res: Response) => void
  headerValue: () => string
}

type MonthTokens = {
  year?: string
  monthNum?: string
  monthNum2?: string
  monthAbbr?: string
  monthFull?: string
  combinedAbbrYear?: string
}

type ImportApiResponse = {
  ok: boolean
  monthKey?: string
  warnings?: string[]
  extracted?: {
    incomeStatement?: {
      totalRevenue?: { actual?: number }
      totalOperatingExpenses?: { actual?: number }
      lineItems?: Array<unknown>
    }
  }
  updated?: {
    incomeStatement?: {
      totalRevenue?: { actual?: number }
      totalOperatingExpenses?: { actual?: number }
      lineItems?: Array<unknown>
    }
  }
}

type BackfillResult = {
  monthKey: string
  filePath?: string
  ok: boolean
  warnings: string[]
  revenue?: number
  expenses?: number
  lineItemCount?: number
  error?: string
}

const MONTH_ABBR_TO_FULL: Record<string, string> = {
  jan: 'january',
  feb: 'february',
  mar: 'march',
  apr: 'april',
  may: 'may',
  jun: 'june',
  jul: 'july',
  aug: 'august',
  sep: 'september',
  oct: 'october',
  nov: 'november',
  dec: 'december',
}

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`)
  return v.trim()
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : undefined
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y'].includes(v)) return true
  if (['0', 'false', 'no', 'n'].includes(v)) return false
  return defaultValue
}

function createCookieJar(): CookieJar {
  const jar = new Map<string, string>()

  function setCookieLine(line: string) {
    const first = line.split(';', 1)[0]
    const eq = first.indexOf('=')
    if (eq === -1) return
    const name = first.slice(0, eq).trim()
    const value = first.slice(eq + 1).trim()
    if (!name) return
    jar.set(name, value)
  }

  return {
    setFromResponse(res) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyHeaders = res.headers as any
      if (typeof anyHeaders.getSetCookie === 'function') {
        const lines: string[] = anyHeaders.getSetCookie()
        for (const line of lines) setCookieLine(line)
        return
      }

      const single = res.headers.get('set-cookie')
      if (single) setCookieLine(single)
    },
    headerValue() {
      return Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    },
  }
}

function vercelBypassHeaders(): Record<string, string> {
  const bypass = optionalEnv('VERCEL_PROTECTION_BYPASS')
  if (!bypass) return {}

  return {
    'x-vercel-protection-bypass': bypass,
    'x-vercel-set-bypass-cookie': 'true',
  }
}

function normalize(value: string) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function monthKeyToTokens(monthKey: string): MonthTokens {
  const raw = (monthKey || '').trim().toLowerCase()

  const m1 = raw.match(/^([a-z]{3})[-_ ]?(\d{4})$/)
  if (m1) {
    const monthAbbr = m1[1]
    const year = m1[2]
    const monthNum = String(Object.keys(MONTH_ABBR_TO_FULL).indexOf(monthAbbr) + 1)
    const monthNum2 = monthNum.padStart(2, '0')
    return {
      year,
      monthAbbr,
      monthFull: MONTH_ABBR_TO_FULL[monthAbbr],
      monthNum,
      monthNum2,
      combinedAbbrYear: `${monthAbbr}${year}`,
    }
  }

  const m2 = raw.match(/^(\d{4})[-_/ ](\d{1,2})$/)
  if (m2) {
    const year = m2[1]
    const monthNum = String(Number(m2[2]))
    const monthNum2 = monthNum.padStart(2, '0')
    const abbrByIndex = Object.keys(MONTH_ABBR_TO_FULL)
    const idx = Number(monthNum2) - 1
    const abbr = idx >= 0 && idx < abbrByIndex.length ? abbrByIndex[idx] : undefined
    return {
      year,
      monthNum,
      monthNum2,
      monthAbbr: abbr,
      monthFull: abbr ? MONTH_ABBR_TO_FULL[abbr] : undefined,
      combinedAbbrYear: abbr ? `${abbr}${year}` : undefined,
    }
  }

  return {}
}

function scoreMonthMatch(normalizedPath: string, tokens: MonthTokens): number {
  let score = 0

  if (tokens.year && normalizedPath.includes(tokens.year)) score += 6
  if (tokens.monthFull && normalizedPath.includes(tokens.monthFull)) score += 7
  if (tokens.monthAbbr && normalizedPath.split(' ').includes(tokens.monthAbbr)) score += 6
  if (tokens.monthNum && normalizedPath.split(' ').includes(tokens.monthNum)) score += 4
  if (tokens.monthNum2 && normalizedPath.split(' ').includes(tokens.monthNum2)) score += 4
  if (tokens.combinedAbbrYear && normalizedPath.includes(tokens.combinedAbbrYear)) score += 9

  return score
}

function scoreFinancialStatementsHint(normalizedPath: string): number {
  let score = 0

  if (normalizedPath.includes('financial statements')) score += 20
  if (normalizedPath.includes('financial statement')) score += 16
  if (normalizedPath.split(' ').includes('fs')) score += 14
  if (normalizedPath.includes('management report') || normalizedPath.includes('monthly management report')) score += 10
  if (normalizedPath.includes('income statement') || normalizedPath.includes('p l') || normalizedPath.includes('p&l')) score += 8

  // Penalize files that are likely not the FS P&L packet.
  if (normalizedPath.includes('bank recon') || normalizedPath.includes('reconciliation')) score -= 14
  if (normalizedPath.includes('cash summary') || normalizedPath.includes('cash payments')) score -= 12
  if (normalizedPath.includes('accounts receivable') || normalizedPath.includes('aging')) score -= 8

  return score
}

function listPdfFilesInDir(dir: string, recursive: boolean): string[] {
  if (!fs.existsSync(dir)) throw new Error(`PDF_DIR does not exist: ${dir}`)

  const out: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) out.push(full)
    if (recursive && ent.isDirectory() && !ent.name.startsWith('.') && ent.name !== 'node_modules') {
      out.push(...listPdfFilesInDir(full, recursive))
    }
  }

  return out
}

function pickFinancialStatementsPdf(opts: { monthKey: string; allPdfs: string[] }): string {
  const tokens = monthKeyToTokens(opts.monthKey)

  const scored = opts.allPdfs.map((filePath) => {
    const normalizedPath = normalize(filePath)
    const monthScore = scoreMonthMatch(normalizedPath, tokens)
    const fsScore = scoreFinancialStatementsHint(normalizedPath)
    const total = monthScore * 10 + fsScore
    return { filePath, monthScore, fsScore, total }
  })

  const monthCandidates = scored.filter((s) => s.monthScore >= 6)
  const candidatePool = monthCandidates.length ? monthCandidates : scored

  const fsCandidates = candidatePool.filter((s) => s.fsScore > 0)
  const rankedPool = (fsCandidates.length ? fsCandidates : candidatePool)
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      if (b.monthScore !== a.monthScore) return b.monthScore - a.monthScore
      return b.fsScore - a.fsScore
    })

  const best = rankedPool[0]
  if (!best) throw new Error(`No candidate PDFs found for ${opts.monthKey}`)

  // Guardrail: if we had month-scoped candidates but best has no FS hint, fail loudly.
  if (monthCandidates.length && best.fsScore <= 0) {
    throw new Error(
      `Could not confidently pick an FS PDF for ${opts.monthKey}. Top candidate was "${path.basename(best.filePath)}" without FS/financial-statements hints.`
    )
  }

  return best.filePath
}

async function getCsrfToken(baseUrl: string, jar: CookieJar) {
  const res = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: {
      ...vercelBypassHeaders(),
      cookie: jar.headerValue(),
    },
  })

  jar.setFromResponse(res)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CSRF request failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as { csrfToken?: string }
  if (!json.csrfToken) throw new Error('Missing csrfToken in response')
  return json.csrfToken
}

async function login(baseUrl: string, jar: CookieJar, email: string, password: string) {
  const csrfToken = await getCsrfToken(baseUrl, jar)

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/dashboard`,
  })

  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      ...vercelBypassHeaders(),
      'content-type': 'application/x-www-form-urlencoded',
      cookie: jar.headerValue(),
    },
    body,
    redirect: 'manual',
  })

  jar.setFromResponse(res)

  if (res.status !== 302 && !res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Login failed (${res.status}): ${text.slice(0, 200)}`)
  }
}

async function importFsForMonth(baseUrl: string, jar: CookieJar, monthKey: string, filePath: string) {
  const form = new FormData()
  form.append('monthKey', monthKey)

  const buf = await fs.promises.readFile(filePath)
  form.append('files', new Blob([buf], { type: 'application/pdf' }), path.basename(filePath))

  const res = await fetch(`${baseUrl}/api/import/pdf`, {
    method: 'POST',
    headers: {
      ...vercelBypassHeaders(),
      cookie: jar.headerValue(),
    },
    body: form,
  })

  const raw = await res.text().catch(() => '')
  let json: ImportApiResponse | null = null
  try {
    json = raw ? (JSON.parse(raw) as ImportApiResponse) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const detail = json ? JSON.stringify(json, null, 2) : raw || `(empty body)`
    throw new Error(`Import failed (${res.status}): ${detail.slice(0, 3000)}`)
  }

  return json ?? { ok: true }
}

function parseMonthList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function formatMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  return `$${value.toLocaleString()}`
}

function getRevenueFromImport(resp: ImportApiResponse): number | undefined {
  const fromUpdated = resp.updated?.incomeStatement?.totalRevenue?.actual
  if (typeof fromUpdated === 'number') return fromUpdated
  return resp.extracted?.incomeStatement?.totalRevenue?.actual
}

function getExpensesFromImport(resp: ImportApiResponse): number | undefined {
  const fromUpdated = resp.updated?.incomeStatement?.totalOperatingExpenses?.actual
  if (typeof fromUpdated === 'number') return fromUpdated
  return resp.extracted?.incomeStatement?.totalOperatingExpenses?.actual
}

function getLineItemCount(resp: ImportApiResponse): number | undefined {
  const fromUpdated = resp.updated?.incomeStatement?.lineItems?.length
  if (typeof fromUpdated === 'number') return fromUpdated
  return resp.extracted?.incomeStatement?.lineItems?.length
}

async function main() {
  const baseUrl = mustEnv('BASE_URL').replace(/\/$/, '')
  const pdfDir = mustEnv('PDF_DIR')
  const recursive = parseBool(optionalEnv('PDF_DIR_RECURSIVE'), true)

  const email = optionalEnv('EMAIL') ?? 'admin@ptgfinancial.com'
  const password = optionalEnv('PASSWORD') ?? 'PJM315g!'

  const monthsRaw = optionalEnv('BACKFILL_MONTHS') ?? 'nov-2025,dec-2025,jan-2026'
  const months = parseMonthList(monthsRaw)
  if (!months.length) throw new Error('No months provided. Set BACKFILL_MONTHS (comma-separated).')

  const allPdfs = listPdfFilesInDir(pdfDir, recursive)
  if (!allPdfs.length) throw new Error(`No PDFs found in PDF_DIR: ${pdfDir}`)

  const jar = createCookieJar()

  console.log(`Base URL: ${baseUrl}`)
  console.log(`PDF_DIR: ${pdfDir}${recursive ? ' (recursive)' : ''}`)
  console.log(`Months: ${months.join(', ')}`)
  console.log(`Bypass header set: ${Boolean(optionalEnv('VERCEL_PROTECTION_BYPASS'))}`)

  await login(baseUrl, jar, email, password)

  const results: BackfillResult[] = []

  for (const monthKey of months) {
    try {
      const filePath = pickFinancialStatementsPdf({ monthKey, allPdfs })
      const resp = await importFsForMonth(baseUrl, jar, monthKey, filePath)

      const warnings = Array.isArray(resp.warnings) ? resp.warnings : []
      const revenue = getRevenueFromImport(resp)
      const expenses = getExpensesFromImport(resp)
      const lineItemCount = getLineItemCount(resp)

      results.push({
        monthKey,
        filePath,
        ok: true,
        warnings,
        revenue,
        expenses,
        lineItemCount,
      })

      console.log(`[${monthKey}] OK`)
      console.log(`  File: ${path.basename(filePath)}`)
      console.log(`  Revenue: ${formatMoney(revenue)}`)
      console.log(`  Expenses: ${formatMoney(expenses)}`)
      console.log(`  Line items: ${typeof lineItemCount === 'number' ? lineItemCount : 'n/a'}`)
      console.log(`  Warnings: ${warnings.length}`)
      if (warnings.length) {
        for (const w of warnings) console.log(`    - ${w}`)
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({ monthKey, ok: false, warnings: [], error })
      console.log(`[${monthKey}] FAILED`)
      console.log(`  Error: ${error}`)
    }
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  console.log('\nBackfill summary:')
  for (const r of results) {
    const status = r.ok ? 'OK' : 'FAILED'
    console.log(`- ${r.monthKey}: ${status}`)
  }
  console.log(`Completed ${results.length} month(s): ${okCount} succeeded, ${failCount} failed.`)

  if (failCount > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
