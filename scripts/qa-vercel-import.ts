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

function createCookieJar(): CookieJar {
  const jar = new Map<string, string>()

  function setCookieLine(line: string) {
    // Take the first key=value pair; ignore attributes.
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
      // Node's fetch exposes a non-standard getSetCookie() helper.
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

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() ? v : undefined
}

function vercelBypassHeaders(): Record<string, string> {
  const bypass = optionalEnv('VERCEL_PROTECTION_BYPASS')
  if (!bypass) return {}

  return {
    'x-vercel-protection-bypass': bypass,
    // Optional: when you want to use a browser after a single request.
    // Keeping it here does no harm for automated scripts.
    'x-vercel-set-bypass-cookie': 'true',
  }
}

function ensureTmpPdfs(tmpDir: string) {
  fs.mkdirSync(tmpDir, { recursive: true })

  // Tiny, valid-ish PDF with a single "Hello" text.
  const base64 =
    'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEhlbGxvKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2MiAwMDAwMCBuIAowMDAwMDAwMTEzIDAwMDAwIG4gCjAwMDAwMDAyNDcgMDAwMDAgbiAKMDAwMDAwMDM5MCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ5MAolJUVPRgo='

  const buf = Buffer.from(base64, 'base64')

  const files = [
    path.join(tmpDir, 'Financial Statements.pdf'),
    path.join(tmpDir, 'Bank Reconciliation.pdf'),
    path.join(tmpDir, 'Cash Summary.pdf'),
  ]

  for (const f of files) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, buf)
  }

  return files
}

function normalizeName(name: string) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function monthKeyToTokens(monthKey: string): MonthTokens {
  const raw = (monthKey || '').trim().toLowerCase()

  // Formats we accept:
  // - nov-2025
  // - 2025-11
  // - 11-2025
  // - nov2025
  // - nov_2025
  const m1 = raw.match(/^([a-z]{3})[-_ ]?(\d{4})$/)
  if (m1) {
    const monthAbbr = m1[1]
    const year = m1[2]
    return {
      year,
      monthAbbr,
      monthFull: MONTH_ABBR_TO_FULL[monthAbbr],
      combinedAbbrYear: `${monthAbbr}${year}`,
    }
  }

  const m2 = raw.match(/^(\d{4})[-_/ ](\d{1,2})$/)
  if (m2) {
    const year = m2[1]
    const monthNum = String(Number(m2[2]))
    const monthNum2 = monthNum.padStart(2, '0')
    // Map numeric month -> abbr
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

  const m3 = raw.match(/^(\d{1,2})[-_/ ](\d{4})$/)
  if (m3) {
    const monthNum = String(Number(m3[1]))
    const monthNum2 = monthNum.padStart(2, '0')
    const year = m3[2]
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

type PdfKind = 'financial-statements' | 'bank-reconciliation' | 'cash-summary'

function scoreMonthMatch(normalizedFileName: string, tokens: MonthTokens): number {
  let score = 0
  if (tokens.year && normalizedFileName.includes(tokens.year)) score += 4
  if (tokens.monthFull && normalizedFileName.includes(tokens.monthFull)) score += 6
  if (tokens.monthAbbr) {
    const parts = normalizedFileName.split(' ')
    if (parts.includes(tokens.monthAbbr)) score += 5
  }
  if (tokens.monthNum && normalizedFileName.split(' ').includes(tokens.monthNum)) score += 3
  if (tokens.monthNum2 && normalizedFileName.split(' ').includes(tokens.monthNum2)) score += 3
  if (tokens.combinedAbbrYear && normalizedFileName.includes(tokens.combinedAbbrYear)) score += 8
  return score
}

function scoreKindMatch(normalizedFileName: string, kind: PdfKind): number {
  if (!normalizedFileName) return 0

  if (kind === 'bank-reconciliation') {
    const hasBank = normalizedFileName.includes('bank')
    const hasRecon = normalizedFileName.includes('recon') || normalizedFileName.includes('reconciliation')
    return (hasBank ? 6 : 0) + (hasRecon ? 6 : 0)
  }

  if (kind === 'cash-summary') {
    const hasCashish =
      normalizedFileName.includes('cash') ||
      normalizedFileName.includes('treasury') ||
      normalizedFileName.includes('account') ||
      normalizedFileName.includes('accounts')
    const hasDescriptor =
      normalizedFileName.includes('summary') ||
      normalizedFileName.includes('report') ||
      normalizedFileName.includes('position') ||
      normalizedFileName.includes('payment') ||
      normalizedFileName.includes('payments')
    return (hasCashish ? 4 : 0) + (hasDescriptor ? 4 : 0)
  }

  // financial-statements
  const isFinancial =
    normalizedFileName.includes('financial') ||
    normalizedFileName.includes('management') ||
    normalizedFileName.includes('mgt') ||
    normalizedFileName.includes('income statement') ||
    normalizedFileName.includes('p l') ||
    normalizedFileName.includes('p&l') ||
    normalizedFileName.includes('profit') ||
    normalizedFileName.includes('loss')
  return isFinancial ? 10 : 0
}

function pickMonthlyPdfFiles(opts: { pdfDir: string; recursive: boolean; monthKey: string }): string[] {
  const tokens = monthKeyToTokens(opts.monthKey)
  const allPdfs = listPdfFilesInDir(opts.pdfDir, opts.recursive)

  if (!allPdfs.length) throw new Error(`No PDFs found in PDF_DIR: ${opts.pdfDir}`)

  // If there are exactly 3 PDFs, just use them. The API will classify them by content/filename.
  if (allPdfs.length === 3) return allPdfs

  const scored = allPdfs.map((fullPath) => {
    const fileName = path.basename(fullPath)
    const normalized = normalizeName(fileName)
    const monthScore = scoreMonthMatch(normalized, tokens)
    return { fullPath, fileName, normalized, monthScore }
  })

  // Prefer PDFs that match the requested month (when we can infer it).
  const monthFiltered = tokens.year || tokens.monthFull || tokens.monthAbbr ? scored.filter((s) => s.monthScore >= 6) : []
  const candidates = monthFiltered.length ? monthFiltered : scored

  const kinds: PdfKind[] = ['financial-statements', 'bank-reconciliation', 'cash-summary']
  const picked: string[] = []
  const used = new Set<string>()

  for (const kind of kinds) {
    const best = candidates
      .map((c) => ({
        ...c,
        kindScore: scoreKindMatch(c.normalized, kind),
        total: c.monthScore * 10 + scoreKindMatch(c.normalized, kind),
      }))
      .filter((c) => c.kindScore > 0)
      .filter((c) => !used.has(c.fullPath))
      .sort((a, b) => b.total - a.total)[0]

    if (best && best.total > 0) {
      picked.push(best.fullPath)
      used.add(best.fullPath)
    }
  }

  // If we couldn't confidently pick 3 by name heuristics, fall back to "best month matches".
  if (picked.length !== 3) {
    const fallback = candidates
      .filter((c) => !used.has(c.fullPath))
      .sort((a, b) => b.monthScore - a.monthScore)
      .slice(0, 3 - picked.length)
      .map((c) => c.fullPath)

    for (const f of fallback) {
      picked.push(f)
      used.add(f)
    }
  }

  if (picked.length !== 3) {
    throw new Error(
      `Could not select exactly 3 PDFs from PDF_DIR (${opts.pdfDir}). Found ${allPdfs.length}, selected ${picked.length}.`
    )
  }

  return picked
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

  // NextAuth often responds with 302 to callbackUrl.
  if (res.status !== 302 && !res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Login failed (${res.status}): ${text.slice(0, 200)}`)
  }
}

async function importMonth(baseUrl: string, jar: CookieJar, monthKey: string, filePaths: string[]) {
  const form = new FormData()
  form.append('monthKey', monthKey)

  for (const filePath of filePaths) {
    const buf = await fs.promises.readFile(filePath)
    const fileName = path.basename(filePath)
    form.append('files', new Blob([buf], { type: 'application/pdf' }), fileName)
  }

  const res = await fetch(`${baseUrl}/api/import/pdf`, {
    method: 'POST',
    headers: {
      ...vercelBypassHeaders(),
      cookie: jar.headerValue(),
    },
    body: form,
  })

  const text = await res.text().catch(() => '')
  let json: unknown = undefined
  try {
    json = JSON.parse(text)
  } catch {
    // ignore
  }

  if (!res.ok) {
    const pretty = json ? JSON.stringify(json, null, 2) : text
    throw new Error(`Import failed (${res.status}):\n${pretty.slice(0, 2000)}`)
  }

  console.log('Import OK')
  console.log(json ? JSON.stringify(json, null, 2) : text)
}

async function main() {
  const baseUrl = mustEnv('BASE_URL').replace(/\/$/, '')
  const monthKey = optionalEnv('MONTH_KEY') ?? 'nov-2025'

  const email = optionalEnv('EMAIL') ?? 'admin@ptgfinancial.com'
  const password = optionalEnv('PASSWORD') ?? 'PJM315g!'

  const tmpDir = path.join(process.cwd(), '.tmp-test-pdfs')

  const pdfDir = optionalEnv('PDF_DIR')
  const recursive = ['1', 'true', 'yes'].includes((optionalEnv('PDF_DIR_RECURSIVE') ?? '').toLowerCase())

  const files =
    optionalEnv('PDF_FILES')
      ? optionalEnv('PDF_FILES')!
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : pdfDir
        ? pickMonthlyPdfFiles({ pdfDir, recursive, monthKey })
        : ensureTmpPdfs(tmpDir)

  const jar = createCookieJar()

  console.log(`Base URL: ${baseUrl}`)
  console.log(`Month: ${monthKey}`)
  console.log(`Files: ${files.map((f) => path.basename(f)).join(', ')}`)
  if (pdfDir) console.log(`PDF_DIR: ${pdfDir}${recursive ? ' (recursive)' : ''}`)
  console.log(`Bypass header set: ${Boolean(optionalEnv('VERCEL_PROTECTION_BYPASS'))}`)

  await login(baseUrl, jar, email, password)
  await importMonth(baseUrl, jar, monthKey, files)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
