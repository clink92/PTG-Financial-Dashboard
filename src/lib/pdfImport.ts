import type { MonthlyData } from '@/lib/data'

export type ImportedPdfKind = 'financial-statements' | 'bank-reconciliation' | 'cash-summary' | 'unknown'

export type PdfTextInput = {
  fileName: string
  text: string
}

export type PdfImportExtracted = {
  sources: Array<{ fileName: string; kind: ImportedPdfKind }>
  noi?: { actual: number; budget: number; variance: number }
  netIncome?: { actual: number; budget: number; variance: number }
  incomeStatement?: {
    totalIncome?: number
    totalExpenses?: number
    totalRevenue?: { actual: number; budget: number; variance: number }
    totalOperatingExpenses?: { actual: number; budget: number; variance: number }
    lineItems?: Array<{
      label: string
      kind: 'revenue' | 'expense'
      actual: number
      budget: number
      delta: number
      ytdActual?: number
      ytdBudget?: number
      ytdDelta?: number
    }>
  }
  cash?: {
    operating?: number
    escrow?: number
    reserveFunds?: number
    total?: number
  }
  receivables?: {
    current?: number
    over30?: number
    over60?: number
    over90?: number
    total?: number
  }
  bankReconciliation?: {
    asOfDate?: string
    balancePerBankStatement?: number
    adjustedBankBalance?: number
    reconcilingItemsNet?: number
    depositsInTransit?: number
    outstandingChecks?: number
  }
}

export type PdfImportResult = {
  data: MonthlyData
  extracted: PdfImportExtracted
  warnings: string[]
}

function normalizeForRegex(text: string) {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeName(name: string) {
  // Normalize to tokens so filenames like "Cash_Payments_11-2025.pdf" still match.
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MONTHS: Array<{ abbr: string; full: string; index: number }> = [
  { abbr: 'jan', full: 'january', index: 0 },
  { abbr: 'feb', full: 'february', index: 1 },
  { abbr: 'mar', full: 'march', index: 2 },
  { abbr: 'apr', full: 'april', index: 3 },
  { abbr: 'may', full: 'may', index: 4 },
  { abbr: 'jun', full: 'june', index: 5 },
  { abbr: 'jul', full: 'july', index: 6 },
  { abbr: 'aug', full: 'august', index: 7 },
  { abbr: 'sep', full: 'september', index: 8 },
  { abbr: 'oct', full: 'october', index: 9 },
  { abbr: 'nov', full: 'november', index: 10 },
  { abbr: 'dec', full: 'december', index: 11 },
]

function monthKeyFromYearMonth(year: number, monthIndex: number): string | null {
  const m = MONTHS.find((mm) => mm.index === monthIndex)
  if (!m || !Number.isFinite(year) || year < 1900 || year > 2100) return null
  return `${m.abbr}-${year}`
}

function detectMonthKeyFromFileName(fileName: string): { monthKey: string; confidence: number; evidence: string } | null {
  const n = normalizeName(fileName)
  if (!n) return null

  const yearMatch = n.match(/\b(20\d{2})\b/)
  const year = yearMatch ? Number(yearMatch[1]) : NaN
  if (!Number.isFinite(year)) return null

  for (const m of MONTHS) {
    // Prefer full name, then abbr as standalone token, then concatenated "nov2025"
    if (n.includes(`${m.full} ${year}`)) {
      const monthKey = monthKeyFromYearMonth(year, m.index)
      if (monthKey) return { monthKey, confidence: 10, evidence: `filename contains "${m.full} ${year}"` }
    }
    const parts = n.split(' ')
    if (parts.includes(m.abbr) && parts.includes(String(year))) {
      const monthKey = monthKeyFromYearMonth(year, m.index)
      if (monthKey) return { monthKey, confidence: 8, evidence: `filename tokens include "${m.abbr}" and "${year}"` }
    }
    if (n.includes(`${m.abbr}${year}`)) {
      const monthKey = monthKeyFromYearMonth(year, m.index)
      if (monthKey) return { monthKey, confidence: 7, evidence: `filename contains "${m.abbr}${year}"` }
    }
  }

  // Numeric month patterns like "11 2025" or "2025 11"
  const ym = n.match(/\b(20\d{2})\s+(1[0-2]|0?[1-9])\b/)
  if (ym) {
    const y = Number(ym[1])
    const monthNum = Number(ym[2])
    const monthKey = monthKeyFromYearMonth(y, monthNum - 1)
    if (monthKey) return { monthKey, confidence: 6, evidence: `filename contains "${ym[1]} ${ym[2]}"` }
  }
  const my = n.match(/\b(1[0-2]|0?[1-9])\s+(20\d{2})\b/)
  if (my) {
    const monthNum = Number(my[1])
    const y = Number(my[2])
    const monthKey = monthKeyFromYearMonth(y, monthNum - 1)
    if (monthKey) return { monthKey, confidence: 6, evidence: `filename contains "${my[1]} ${my[2]}"` }
  }

  return null
}

function detectMonthKeyFromText(text: string): { monthKey: string; confidence: number; evidence: string } | null {
  const t = normalizeForRegex(text).toUpperCase()

  // Bank reconciliation commonly contains: "Balance Per Bank Statement as of 11/30/2025"
  const asOf = t.match(/BALANCE PER BANK STATEMENT AS OF\s+([0-9]{1,2})\/[0-9]{1,2}\/([0-9]{4})/)
  if (asOf) {
    const monthNum = Number(asOf[1])
    const year = Number(asOf[2])
    const monthKey = monthKeyFromYearMonth(year, monthNum - 1)
    if (monthKey) return { monthKey, confidence: 12, evidence: `text contains "Balance Per Bank Statement as of ${asOf[1]}/../${asOf[2]}"` }
  }

  // Generic: "as of 11/30/2025"
  const anyAsOf = t.match(/\bAS OF\s+([0-9]{1,2})\/[0-9]{1,2}\/([0-9]{4})\b/)
  if (anyAsOf) {
    const monthNum = Number(anyAsOf[1])
    const year = Number(anyAsOf[2])
    const monthKey = monthKeyFromYearMonth(year, monthNum - 1)
    if (monthKey) return { monthKey, confidence: 9, evidence: `text contains "as of ${anyAsOf[1]}/../${anyAsOf[2]}"` }
  }

  // Long-form dates: "AS OF NOVEMBER 30, 2025" or "FOR THE MONTH ENDED NOVEMBER 30, 2025"
  const monthNames = '(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)'
  const longAsOf = t.match(new RegExp(`\\bAS OF\\s+${monthNames}\\s+([0-9]{1,2}),\\s+([0-9]{4})\\b`))
  if (longAsOf) {
    const mName = longAsOf[1].toLowerCase()
    const day = Number(longAsOf[2])
    const year = Number(longAsOf[3])
    const monthIndex = MONTHS.find((m) => m.full === mName)?.index
    const monthKey = typeof monthIndex === 'number' ? monthKeyFromYearMonth(year, monthIndex) : null
    if (monthKey) return { monthKey, confidence: 10, evidence: `text contains "AS OF ${longAsOf[1]} ${day}, ${year}"` }
  }

  const monthEnded = t.match(new RegExp(`\\bFOR THE (?:MONTH|PERIOD) ENDED\\s+${monthNames}\\s+([0-9]{1,2}),\\s+([0-9]{4})\\b`))
  if (monthEnded) {
    const mName = monthEnded[1].toLowerCase()
    const day = Number(monthEnded[2])
    const year = Number(monthEnded[3])
    const monthIndex = MONTHS.find((m) => m.full === mName)?.index
    const monthKey = typeof monthIndex === 'number' ? monthKeyFromYearMonth(year, monthIndex) : null
    if (monthKey) return { monthKey, confidence: 10, evidence: `text contains "FOR THE MONTH ENDED ${monthEnded[1]} ${day}, ${year}"` }
  }

  return null
}

export function detectMonthKeyForPdfInput(input: PdfTextInput): { monthKey: string; confidence: number; evidence: string } | null {
  const candidates: Array<{ monthKey: string; confidence: number; evidence: string }> = []
  const fromText = detectMonthKeyFromText(input.text)
  if (fromText) candidates.push(fromText)
  const fromName = detectMonthKeyFromFileName(input.fileName)
  if (fromName) candidates.push(fromName)
  if (!candidates.length) return null
  candidates.sort((a, b) => b.confidence - a.confidence)
  return candidates[0]
}

export function detectMonthKeyFromPdfInputs(inputs: PdfTextInput[]): { monthKey: string; evidence: string[] } | null {
  const candidates: Array<{ monthKey: string; confidence: number; evidence: string }> = []

  for (const input of inputs) {
    const fromText = detectMonthKeyFromText(input.text)
    if (fromText) candidates.push(fromText)
    const fromName = detectMonthKeyFromFileName(input.fileName)
    if (fromName) candidates.push(fromName)
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.confidence - a.confidence)
  const best = candidates[0]

  const evidence = candidates
    .filter((c) => c.monthKey === best.monthKey)
    .slice(0, 3)
    .map((c) => c.evidence)

  return { monthKey: best.monthKey, evidence }
}

function parseMoney(raw: string): number {
  // Handles: 7,117,572$  | 2,089,030.39 | (26,983) | - | $144.22
  const s = raw.trim()
  if (!s || s === '-') return 0

  const isNeg = s.startsWith('(') && s.endsWith(')')
  const cleaned = s
    .replace(/[$,]/g, '')
    .replace(/^\(/, '')
    .replace(/\)$/, '')

  const n = Number(cleaned)
  if (Number.isNaN(n)) return 0
  return isNeg ? -n : n
}

function roundToCents(n: number): number {
  return Math.round(n * 100) / 100
}

function scorePdf(text: string, fileName?: string) {
  // Normalize whitespace so substring checks work even when the PDF has line breaks.
  const t = normalizeForRegex(text).toUpperCase()
  const n = normalizeName(fileName || '')

  const scores: Record<ImportedPdfKind, number> = {
    'financial-statements': 0,
    'bank-reconciliation': 0,
    'cash-summary': 0,
    unknown: 0,
  }

  // Filename hints (best-effort; originals may not be named consistently)
  if (n) {
    const parts = n.split(' ')
    // Many accounting packets label the financial statements PDF as "FS".
    if (parts.includes('fs') || n.includes('financial statements')) scores['financial-statements'] += 5
    if (n.includes('bank') && (n.includes('recon') || n.includes('reconciliation'))) scores['bank-reconciliation'] += 4
    if (n.includes('cash') && (n.includes('summary') || n.includes('payments') || n.includes('payment') || n.includes('position'))) scores['cash-summary'] += 3
    if (n.includes('financial') || n.includes('management') || n.includes('income statement') || n.includes('profit') || n.includes('loss') || n.includes('p&l')) {
      scores['financial-statements'] += 2
    }
  }

  // Content scoring (primary; works with unedited/original PDFs)
  if (/\bBANK\s+RECONCILIATION\b/.test(t)) scores['bank-reconciliation'] += 6
  if (t.includes('BALANCE PER BANK STATEMENT')) scores['bank-reconciliation'] += 6
  if (t.includes('ADJUSTED BANK BALANCE')) scores['bank-reconciliation'] += 4
  if (t.includes('DEPOSITS IN TRANSIT')) scores['bank-reconciliation'] += 3
  if (t.includes('OUTSTANDING CHECKS')) scores['bank-reconciliation'] += 3

  if (/\bCASH\s+PAYMENTS?\b/.test(t)) scores['cash-summary'] += 5
  if (/\bCASH\s+(SUMMARY|POSITION)\b/.test(t)) scores['cash-summary'] += 4
  if (t.includes('TOTAL CASH') || t.includes('CASH AND CASH EQUIVALENTS')) scores['cash-summary'] += 3
  if (t.includes('OPERATING ACCOUNTS')) scores['cash-summary'] += 2
  if (t.includes('RESERVE') || t.includes('ESCROW') || t.includes('SECURITY DEPOSIT')) scores['cash-summary'] += 2

  if (t.includes('NET OPERATING INCOME')) scores['financial-statements'] += 6
  if (/\b(INCOME\s+STATEMENT|PROFIT\s+AND\s+LOSS|P&L|STATEMENT\s+OF\s+ACTIVITIES)\b/.test(t)) scores['financial-statements'] += 4
  if (/\bTOTAL\s+(OPERATING\s+)?(INCOME|REVENUE)\b/.test(t)) scores['financial-statements'] += 2
  if (/\bTOTAL\s+(OPERATING\s+)?EXPENSES?\b/.test(t)) scores['financial-statements'] += 2
  if (t.includes('BUDGET')) scores['financial-statements'] += 1
  if (t.includes('VARIANCE')) scores['financial-statements'] += 1

  const entries = Object.entries(scores) as Array<[ImportedPdfKind, number]>
  entries.sort((a, b) => b[1] - a[1])
  const [kind, score] = entries[0]
  return { kind: score >= 4 ? kind : 'unknown', score, scores }
}

function classifyPdf(text: string, fileName?: string): ImportedPdfKind {
  return scorePdf(text, fileName).kind
}

function parseMoneyStrict(raw: string): number | undefined {
  const s = raw.trim()
  if (!s) return undefined
  // Treat standalone dash as zero (common in financial PDFs for no value)
  if (s === '-' || s === '—' || s === '–') return 0
  const n = parseMoney(s)
  return Number.isFinite(n) ? n : undefined
}

type BudgetLineItemKind = 'revenue' | 'expense'
type BudgetLineItem = {
  label: string
  kind: BudgetLineItemKind
  actual: number
  budget: number
  delta: number
  ytdActual?: number
  ytdBudget?: number
  ytdDelta?: number
}

function inferBudgetLineItemKind(label: string, section: BudgetLineItemKind | null): BudgetLineItemKind {
  const l = label.toLowerCase()
  
  // If we have a section context from the PDF headings, trust it first.
  // This ensures items under "OTHER TENANT/MISC INCOME" stay as revenue
  // even if they have ambiguous keywords like "fees" or "repairs".
  if (section) {
    return section
  }
  
  // Without section context, use keyword hints to classify
  // Explicit maintenance is revenue (common in co-op/condo)
  if (l.includes('maintenance')) return 'revenue'
  // Explicit interest lines
  if (l.includes('interest income')) return 'revenue'
  if (l.includes('interest expense')) return 'expense'

  const revenueHints = [
    'revenue',
    'income',
    'rent',
    'rental',
    'late fee',
    'laundry',
    'parking',
    'application',
    'amenity',
    'interest',
  ]
  const expenseHints = [
    'expense',
    'utilities',
    'utility',
    'electric',
    'gas',
    'water',
    'sewer',
    'repairs',
    'repair',
    'payroll',
    'wages',
    'insurance',
    'tax',
    'taxes',
    'legal',
    'accounting',
    'professional',
    'supplies',
    'contract',
    'landscap',
    'janitorial',
    'trash',
    'security',
    'management',
    'license',
    'licenses',
    'permit',
    'permits',
    'subscription',
    'subscriptions',
    'architect',
    'engineer',
    'sublet',
    'income tax',
  ]

  const isRevenue = revenueHints.some((h) => l.includes(h))
  const isExpense = expenseHints.some((h) => l.includes(h))

  // Fee lines can be revenue (late fees, application fees) OR expenses (legal fees, licensing fees, bank fees).
  if (l.includes('fee') || l.includes('fees')) {
    // If it looks like an expense category, treat as expense by default.
    if (isExpense) return 'expense'
    // Most "fees" on the P&L are expenses; use section if known, otherwise expense.
    return section ?? 'expense'
  }

  // Prefer explicit keyword matches over section context.
  if (isExpense && !isRevenue) return 'expense'
  if (isRevenue && !isExpense) return 'revenue'
  // Default: items in revenue sections stay revenue, otherwise default to expense
  return section === 'revenue' ? 'revenue' : 'expense'
}

function extractBudgetLineItemsFromText(text: string) {
  const lines = (text || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: BudgetLineItem[] = []
  let section: BudgetLineItemKind | null = null
  let lastLabelCandidate: string | null = null

  const isNoiseLabel = (label: string) => {
    const u = label.toUpperCase()
    if (!/[A-Z]/.test(u)) return true
    // Avoid balance sheet / cash activity / GL account lines that pollute "top costs/revenue".
    if (/(CASH|BALANCE|BEGINNING|ENDING|CLOSING|OPENING)\b/.test(u)) return true
    if (/(BANK|RECONCILIATION|STATEMENT)\b/.test(u)) return true
    if (/(ASSETS?|LIABILITIES?|EQUITY)\b/.test(u)) return true
    if (/(DEPOSITS?\s+IN\s+TRANSIT|OUTSTANDING\s+CHECKS?)\b/.test(u)) return true
    if (/(ACCOUNTS?\s+RECEIVABLE|A\/R)\b/.test(u)) return true
    return false
  }

  const cleanLabel = (raw: string) => {
    let s = raw.replace(/\s+/g, ' ').trim()
    s = s.replace(/^[\-\u2013\u2014:\s]+/, '').replace(/[\-\u2013\u2014:\s]+$/, '')
    // Drop leading GL account codes like "1031-0000".
    s = s.replace(/^\d{3,}(?:-\d{2,})+\s+/, '')
    return s.trim()
  }

  for (const line of lines) {
    // Skip headers/footers and very short lines.
    if (line.length < 10) continue

    const upper = line.toUpperCase()
    // Section headings to help classify line items
    if (!/[0-9]/.test(line)) {
      // Revenue section markers - includes "REVENUES", "OTHER TENANT/MISC INCOME", etc.
      if (/^(INCOME|REVENUES?|OPERATING INCOME|OTHER INCOME|OTHER TENANT|RESIDENTIAL CHARGES|TENANT.*INCOME|MISC.*INCOME)\b/.test(upper)) {
        section = 'revenue'
        lastLabelCandidate = null
        continue
      }
      // Expense section markers
      if (/^(EXPENSES?|OPERATING EXPENSES?|OTHER EXPENSES?|OTHER OPERATING EXPENSES?|PAYROLL|UTILITIES|REPAIRS|REPAIRS\s*&\s*MAINTENANCE|ADMINISTRATIVE|ADMINISTRATIVE\s*&\s*GENERAL|PROFESSIONAL|PROFESSIONAL\s+FEES|SERVICE\s+CONTRACTS|PARKING\s*\/\s*AMENITIES|PROPERTY\s+AND\s+OTHER\s+TAXES|DEBT\s+SERVICE)\b/.test(upper)) {
        section = 'expense'
        lastLabelCandidate = null
        continue
      }

      const candidate = cleanLabel(line)
      if (
        candidate &&
        /[A-Za-z]/.test(candidate) &&
        !/^(TOTAL|SUBTOTAL|GRAND TOTAL)\b/i.test(candidate) &&
        !/NET OPERATING INCOME/i.test(candidate) &&
        !isNoiseLabel(candidate)
      ) {
        lastLabelCandidate = candidate
      }
      continue
    }

    const tokens = line.split(' ')
    const moneyTokens: Array<{ idx: number; tok: string }> = []
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      // Recognize standalone dash as money token (represents zero in PDFs)
      if (tok === '-' || tok === '—' || tok === '–') {
        moneyTokens.push({ idx: i, tok })
      } else if (/[0-9]/.test(tok) && /^[()$,\d.\-]+$/.test(tok)) {
        moneyTokens.push({ idx: i, tok })
      }
    }
    if (moneyTokens.length < 3) continue

    const pickTriple = (start: number) => {
      for (let j = start; j <= moneyTokens.length - 3; j++) {
        const a = parseMoneyStrict(moneyTokens[j].tok)
        const b = parseMoneyStrict(moneyTokens[j + 1].tok)
        const d = parseMoneyStrict(moneyTokens[j + 2].tok)
        if (typeof a !== 'number' || typeof b !== 'number' || typeof d !== 'number') continue

        const deltaAB = a - b
        const deltaBA = b - a
        const tol = Math.max(10, Math.max(Math.abs(deltaAB), Math.abs(deltaBA)) * 0.02)

        const matchesAB = Math.abs(deltaAB - d) <= tol
        const matchesBA = Math.abs(deltaBA - d) <= tol
        if (!matchesAB && !matchesBA) continue

        return { actual: a, budget: b, delta: deltaAB, startIdx: moneyTokens[j].idx, tokenIndex: j }
      }
      return null
    }

    // Find the first contiguous triple in the line where the third value matches
    // either (actual - budget) or (budget - actual). Many PDFs include both month and YTD triples;
    // choosing the first match usually corresponds to the month columns.
    const picked = pickTriple(0)
    if (!picked) continue

    // Attempt to find a second matching triple later in the line (likely YTD).
    const pickedYtd = pickTriple(picked.tokenIndex + 3)

    let label = cleanLabel(tokens.slice(0, picked.startIdx).join(' '))
    if (!label && lastLabelCandidate) {
      label = lastLabelCandidate
      lastLabelCandidate = null
    }
    if (!label) continue
    if (!/[A-Za-z]/.test(label)) continue
    if (/^(TOTAL|SUBTOTAL|GRAND TOTAL)\b/i.test(label)) continue
    if (/NET OPERATING INCOME/i.test(label)) continue
    if (isNoiseLabel(label)) continue

    out.push({
      label,
      kind: inferBudgetLineItemKind(label, section),
      actual: picked.actual,
      budget: picked.budget,
      delta: picked.delta,
      ...(pickedYtd
        ? {
            ytdActual: pickedYtd.actual,
            ytdBudget: pickedYtd.budget,
            ytdDelta: pickedYtd.delta,
          }
        : {}),
    })
    if (out.length >= 250) break
  }

  // Deduplicate by label, keeping item with YTD data if available
  const deduped = Array.from(
    out.reduce((map, item) => {
      const existing = map.get(item.label)
      if (!existing || (item.ytdActual !== undefined && existing.ytdActual === undefined)) {
        map.set(item.label, item)
      }
      return map
    }, new Map<string, BudgetLineItem>()).values()
  )
  return deduped.length ? deduped : null
}

function extractNOIFromFS(text: string) {
  // Prefer line-based parsing to avoid capturing OTHER INCOME rows that appear after the label.
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const moneyTokensFromLine = (line: string) =>
    line
      .split(' ')
      .filter((tok) => /[0-9]/.test(tok) && /^[()$,.\d\-]+$/.test(tok))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!/^NET OPERATING INCOME\b/i.test(line)) continue

    const tokens = moneyTokensFromLine(line)
    const nextTokens = i + 1 < lines.length ? moneyTokensFromLine(lines[i + 1]) : []
    const values = tokens.length >= 3 ? tokens : nextTokens.length >= 3 ? nextTokens : []
    if (values.length < 3) continue

    const actual = parseMoneyStrict(values[0])
    const budget = parseMoneyStrict(values[1])
    const variance = parseMoneyStrict(values[2])
    if (typeof actual !== 'number' || typeof budget !== 'number' || typeof variance !== 'number') continue

    return { actual, budget, variance }
  }

  return null
}

function extractNetIncomeFromFS(text: string) {
  // Extract "NET INCOME" line (distinct from "NET OPERATING INCOME")
  // NET INCOME appears after Capital Expenditures and includes all items
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const moneyTokensFromLine = (line: string) =>
    line
      .split(' ')
      .filter((tok) => /[0-9]/.test(tok) && /^[()$,.\d\-]+$/.test(tok))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match "NET INCOME" but not "NET OPERATING INCOME"
    if (!/^NET INCOME\b/i.test(line) || /OPERATING/i.test(line)) continue

    const tokens = moneyTokensFromLine(line)
    const nextTokens = i + 1 < lines.length ? moneyTokensFromLine(lines[i + 1]) : []
    const values = tokens.length >= 3 ? tokens : nextTokens.length >= 3 ? nextTokens : []
    if (values.length < 3) continue

    const actual = parseMoneyStrict(values[0])
    const budget = parseMoneyStrict(values[1])
    const variance = parseMoneyStrict(values[2])
    if (typeof actual !== 'number' || typeof budget !== 'number' || typeof variance !== 'number') continue

    return { actual, budget, variance }
  }

  return null
}

function extractIncomeStatementTotals(text: string) {
  // Use line-based parsing to extract actual/budget/variance for Total Revenue and Total Expenses
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const moneyTokensFromLine = (line: string) =>
    line
      .split(' ')
      .filter((tok) => /[0-9]/.test(tok) && /^[()$,.\d\-]+$/.test(tok))

  let totalRevenue: { actual: number; budget: number; variance: number } | undefined
  let totalExpenses: { actual: number; budget: number; variance: number } | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upper = line.toUpperCase()

    // Match TOTAL REVENUES or TOTAL INCOME (but not TOTAL OTHER... or NET OPERATING INCOME)
    if (/^TOTAL\s+(REVENUES?|INCOME)\b/i.test(upper) && !/OTHER|OPERATING INCOME|NET/i.test(upper)) {
      const tokens = moneyTokensFromLine(line)
      const nextTokens = i + 1 < lines.length ? moneyTokensFromLine(lines[i + 1]) : []
      const values = tokens.length >= 3 ? tokens : nextTokens.length >= 3 ? nextTokens : []
      if (values.length >= 3 && !totalRevenue) {
        const actual = parseMoneyStrict(values[0])
        const budget = parseMoneyStrict(values[1])
        const variance = parseMoneyStrict(values[2])
        if (typeof actual === 'number' && typeof budget === 'number' && typeof variance === 'number') {
          totalRevenue = { actual, budget, variance }
        }
      }
    }

    // Match TOTAL OPERATING EXPENSES or TOTAL EXPENSES
    if (/^TOTAL\s+(OPERATING\s+)?EXPENSES?\b/i.test(upper)) {
      const tokens = moneyTokensFromLine(line)
      const nextTokens = i + 1 < lines.length ? moneyTokensFromLine(lines[i + 1]) : []
      const values = tokens.length >= 3 ? tokens : nextTokens.length >= 3 ? nextTokens : []
      if (values.length >= 3 && !totalExpenses) {
        const actual = parseMoneyStrict(values[0])
        const budget = parseMoneyStrict(values[1])
        const variance = parseMoneyStrict(values[2])
        if (typeof actual === 'number' && typeof budget === 'number' && typeof variance === 'number') {
          totalExpenses = { actual, budget, variance }
        }
      }
    }
  }

  const out: { 
    totalIncome?: number; 
    totalExpenses?: number;
    totalRevenue?: { actual: number; budget: number; variance: number };
    totalOperatingExpenses?: { actual: number; budget: number; variance: number };
  } = {}
  
  // Keep legacy single values for backward compatibility
  if (totalRevenue) {
    out.totalIncome = totalRevenue.actual
    out.totalRevenue = totalRevenue
  }
  if (totalExpenses) {
    out.totalExpenses = totalExpenses.actual
    out.totalOperatingExpenses = totalExpenses
  }
  
  return Object.keys(out).length ? out : null
}

function extractCashTotals(normalized: string) {
  // Cash summary PDFs are often similar to the FS cash page, but formatting varies.
  // We accept optional $ and decimals/parentheses.
  const operating =
    normalized.match(/TOTAL\s+OPERATING\s+ACCOUNTS?\s+([()\d,.$-]+)/i) ??
    normalized.match(/TOTAL\s+OPERATING\s+([()\d,.$-]+)/i)
  const escrow =
    normalized.match(/TOTAL\s+ESCROW\s+ACCOUNTS?\s+([()\d,.$-]+)/i) ??
    normalized.match(/TOTAL\s+SECURITY\s+DEPOSITS?\s+([()\d,.$-]+)/i)
  const reserveFunds =
    normalized.match(/TOTAL\s+RESERVE\s+FUNDS?\s+([()\d,.$-]+)/i) ??
    normalized.match(/TOTAL\s+RESERVES?\s+([()\d,.$-]+)/i)
  const total =
    normalized.match(/TOTAL\s+CASH\s+AND\s+CASH\s+EQUIVALENTS\s+([()\d,.$-]+)/i) ??
    normalized.match(/TOTAL\s+CASH\s+([()\d,.$-]+)/i)

  const out: { operating?: number; escrow?: number; reserveFunds?: number; total?: number } = {}
  if (operating?.[1]) out.operating = parseMoney(operating[1])
  if (escrow?.[1]) out.escrow = parseMoney(escrow[1])
  if (reserveFunds?.[1]) out.reserveFunds = parseMoney(reserveFunds[1])
  if (total?.[1]) out.total = parseMoney(total[1])

  return Object.keys(out).length ? out : null
}

function extractReceivablesFromFS(normalized: string) {
  // Example lines:
  // A/R CURRENT 20,835$ ...
  // A/R OVER 30 DAYS 12,396 ...
  // A/R OVER 60 DAYS 8,184 ...
  // A/R OVER 90 DAYS 33,532 ...
  // ------TOTAL------ 74,948$
  const current =
    normalized.match(/A\/R\s+CURRENT\s+([()\d,.$-]+)/i) ??
    normalized.match(/ACCOUNTS?\s+RECEIVABLE\s+CURRENT\s+([()\d,.$-]+)/i) ??
    normalized.match(/\bCURRENT\s+\(?(?:0|0-?30|0\s*-\s*30)\)?\s+([()\d,.$-]+)/i)
  const over30 =
    normalized.match(/A\/R\s+OVER\s+30\s+DAYS\s+([()\d,.$-]+)/i) ??
    normalized.match(/\b(?:31\s*-\s*60|30\s*-\s*60|OVER\s*30)\b\s+([()\d,.$-]+)/i)
  const over60 =
    normalized.match(/A\/R\s+OVER\s+60\s+DAYS\s+([()\d,.$-]+)/i) ??
    normalized.match(/\b(?:61\s*-\s*90|OVER\s*60)\b\s+([()\d,.$-]+)/i)
  const over90 =
    normalized.match(/A\/R\s+OVER\s+90\s+DAYS\s+([()\d,.$-]+)/i) ??
    normalized.match(/\b(?:OVER\s*90|91\s*\+)\b\s+([()\d,.$-]+)/i)
  const total =
    normalized.match(/------TOTAL------\s+([()\d,.$-]+)/i) ??
    normalized.match(/\bTOTAL\s+A\/R\b\s+([()\d,.$-]+)/i) ??
    normalized.match(/\bTOTAL\s+ACCOUNTS?\s+RECEIVABLE\b\s+([()\d,.$-]+)/i)

  const out: { current?: number; over30?: number; over60?: number; over90?: number; total?: number } = {}
  if (current?.[1]) out.current = parseMoney(current[1])
  if (over30?.[1]) out.over30 = parseMoney(over30[1])
  if (over60?.[1]) out.over60 = parseMoney(over60[1])
  if (over90?.[1]) out.over90 = parseMoney(over90[1])
  if (total?.[1]) out.total = parseMoney(total[1])

  return Object.keys(out).length ? out : null
}

function extractBankReconciliation(normalized: string) {
  // Examples:
  // Balance Per Bank Statement as of 11/30/2025 2,089,030.39
  // Adjusted Bank Balance 2,012,345.67
  const asOf = normalized.match(/BALANCE PER BANK STATEMENT AS OF\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i)
  const bal = normalized.match(/BALANCE PER BANK STATEMENT AS OF\s+[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}\s+([()\d,.$-]+)/i)
  const adjusted = normalized.match(/ADJUSTED BANK BALANCE\s+([()\d,.$-]+)/i)

  const depositsInTransit = normalized.match(/DEPOSITS?\s+IN\s+TRANSIT\s+([()\d,.$-]+)/i)
  const outstandingChecks = normalized.match(/OUTSTANDING\s+CHECKS?\s+([()\d,.$-]+)/i)

  const out: {
    asOfDate?: string
    balancePerBankStatement?: number
    adjustedBankBalance?: number
    depositsInTransit?: number
    outstandingChecks?: number
  } = {}
  if (asOf?.[1]) out.asOfDate = asOf[1]
  if (bal?.[1]) out.balancePerBankStatement = parseMoney(bal[1])
  if (adjusted?.[1]) out.adjustedBankBalance = parseMoney(adjusted[1])
  if (depositsInTransit?.[1]) out.depositsInTransit = parseMoney(depositsInTransit[1])
  if (outstandingChecks?.[1]) out.outstandingChecks = parseMoney(outstandingChecks[1])

  return Object.keys(out).length ? out : null
}

export function extractMonthDataFromPdfTexts(monthKey: string, inputs: PdfTextInput[]): PdfImportResult {
  const warnings: string[] = []
  const extracted: PdfImportExtracted = { sources: [] }

  let noi: PdfImportExtracted['noi']
  let netIncome: PdfImportExtracted['netIncome']
  let incomeStatement: PdfImportExtracted['incomeStatement']
  let cash: PdfImportExtracted['cash']
  let receivables: PdfImportExtracted['receivables']
  let bankReconciliation: PdfImportExtracted['bankReconciliation']
  let lineItems: NonNullable<NonNullable<PdfImportExtracted['incomeStatement']>['lineItems']> | undefined

  const isFsNamed = (fileName: string) => {
    const n = normalizeName(fileName)
    if (!n) return false
    const parts = n.split(' ')
    return parts.includes('fs') || n.includes('financial statement') || n.includes('financial statements')
  }

  const fsNamedInputs = inputs.filter((input) => isFsNamed(input.fileName))
  const extractionInputs = fsNamedInputs.length ? fsNamedInputs : inputs
  const extractionFileNames = new Set(extractionInputs.map((input) => input.fileName))

  for (const input of inputs) {
    const kind = classifyPdf(input.text, input.fileName)
    extracted.sources.push({ fileName: input.fileName, kind })

    const shouldUse = extractionFileNames.has(input.fileName)
    if (!shouldUse) continue

    const normalized = normalizeForRegex(input.text)

    const isFsSource = kind === 'financial-statements' || (fsNamedInputs.length > 0 && shouldUse)

    if (isFsSource) {
      noi = noi ?? extractNOIFromFS(input.text) ?? undefined
      netIncome = netIncome ?? extractNetIncomeFromFS(input.text) ?? undefined
      incomeStatement = incomeStatement ?? extractIncomeStatementTotals(input.text) ?? undefined
      cash = cash ?? extractCashTotals(normalized) ?? undefined
      receivables = receivables ?? extractReceivablesFromFS(normalized) ?? undefined
      lineItems = lineItems ?? extractBudgetLineItemsFromText(input.text) ?? undefined
    }

    if (kind === 'cash-summary') {
      // Prefer cash summary values when present, but only fill missing parts.
      const c = extractCashTotals(normalized) ?? undefined
      if (c) {
        cash = {
          ...(cash || {}),
          ...(typeof cash?.operating === 'number' ? {} : typeof c.operating === 'number' ? { operating: c.operating } : {}),
          ...(typeof cash?.escrow === 'number' ? {} : typeof c.escrow === 'number' ? { escrow: c.escrow } : {}),
          ...(typeof cash?.reserveFunds === 'number' ? {} : typeof c.reserveFunds === 'number' ? { reserveFunds: c.reserveFunds } : {}),
          ...(typeof cash?.total === 'number' ? {} : typeof c.total === 'number' ? { total: c.total } : {}),
        }
      }
    }

    if (kind === 'bank-reconciliation') {
      bankReconciliation = bankReconciliation ?? (extractBankReconciliation(normalized) ?? undefined)
      if (
        bankReconciliation &&
        typeof bankReconciliation.balancePerBankStatement === 'number' &&
        typeof bankReconciliation.adjustedBankBalance === 'number' &&
        typeof bankReconciliation.reconcilingItemsNet !== 'number'
      ) {
        bankReconciliation = {
          ...bankReconciliation,
          reconcilingItemsNet: roundToCents(bankReconciliation.adjustedBankBalance - bankReconciliation.balancePerBankStatement),
        }
      }
    }
  }

  // Best-effort fallback: if classification missed a document, still try to extract
  // key metrics from any PDF that contains the relevant headers.
  for (const input of inputs) {
    const normalized = normalizeForRegex(input.text)
    if (!noi && /NET OPERATING INCOME/i.test(normalized)) noi = extractNOIFromFS(input.text) ?? undefined
    if (!netIncome && /NET INCOME/i.test(normalized)) netIncome = extractNetIncomeFromFS(input.text) ?? undefined
    if (!incomeStatement) incomeStatement = extractIncomeStatementTotals(input.text) ?? undefined
    if (!cash) cash = extractCashTotals(normalized) ?? undefined
    if (!receivables) receivables = extractReceivablesFromFS(normalized) ?? undefined
    if (!bankReconciliation && /BANK STATEMENT|ADJUSTED BANK BALANCE/i.test(normalized)) {
      bankReconciliation = extractBankReconciliation(normalized) ?? undefined
    }
    if (!lineItems && /(BUDGET|VARIANCE)\b/i.test(normalized)) lineItems = extractBudgetLineItemsFromText(input.text) ?? undefined
  }

  // Legacy: if the user uploaded exactly 3 PDFs and we confidently detected
  // financial statements + bank reconciliation, treat the remaining file as
  // the required cash summary even if its name/text doesn't match our heuristics.
  // This uses process of elimination: the 3rd PDF MUST be the cash summary.
  if (inputs.length === 3) {
    const detectedKinds = extracted.sources.map((s) => s.kind)
    const hasFS = detectedKinds.includes('financial-statements')
    const hasBR = detectedKinds.includes('bank-reconciliation')
    const hasCS = detectedKinds.includes('cash-summary')

    if (hasFS && hasBR && !hasCS) {
      // Find the file that isn't FS or BR — that must be the cash summary
      for (let i = 0; i < extracted.sources.length; i++) {
        const s = extracted.sources[i]
        if (s.kind !== 'financial-statements' && s.kind !== 'bank-reconciliation') {
          extracted.sources[i] = { ...s, kind: 'cash-summary' }
          warnings.push(
            `Classified "${s.fileName}" as cash summary (by elimination from the 3-PDF monthly set).`
          )
          break
        }
      }
    }
  }

  if (inputs.length === 1 && extracted.sources.length === 1 && extracted.sources[0].kind !== 'financial-statements') {
    warnings.push(`"${extracted.sources[0].fileName}" did not classify as financial statements; treating it as the FS source.`)
    extracted.sources[0].kind = 'financial-statements'
  }

  if (noi) extracted.noi = noi
  if (netIncome) extracted.netIncome = netIncome
  if (incomeStatement || lineItems) {
    extracted.incomeStatement = {
      ...(incomeStatement || {}),
      ...(lineItems?.length ? { lineItems } : {}),
    }
  }
  if (cash) extracted.cash = cash
  if (receivables) extracted.receivables = receivables
  if (bankReconciliation) extracted.bankReconciliation = bankReconciliation

  if (!noi) warnings.push('Could not find NET OPERATING INCOME in the FS PDF.')
  const hasIncomeTotals =
    typeof incomeStatement?.totalIncome === 'number' ||
    typeof incomeStatement?.totalExpenses === 'number' ||
    typeof incomeStatement?.totalRevenue?.actual === 'number' ||
    typeof incomeStatement?.totalOperatingExpenses?.actual === 'number'
  if (!hasIncomeTotals && !lineItems?.length) {
    warnings.push('Could not find income statement totals or line items in the FS PDF.')
  }

  const now = new Date().toISOString()
  const data: MonthlyData = {
    monthKey,
    label: monthKey,
    updatedAt: now,
    sources: extracted.sources.map((s) => ({ fileName: s.fileName, kind: s.kind })),
  }

  if (noi) {
    data.noi = { actual: noi.actual, budget: noi.budget, variance: noi.variance }
  }

  if (netIncome) {
    data.netIncome = { actual: netIncome.actual, budget: netIncome.budget, variance: netIncome.variance }
  }

  // Deduplicate line items by label (keep the one with YTD data if available)
  const dedupedLineItems = lineItems?.length
    ? Array.from(
        lineItems.reduce((map, item) => {
          const existing = map.get(item.label)
          // Keep item with YTD data if available, otherwise keep first
          if (!existing || (item.ytdActual !== undefined && existing.ytdActual === undefined)) {
            map.set(item.label, item)
          }
          return map
        }, new Map<string, typeof lineItems[number]>()).values()
      )
    : undefined

  if (incomeStatement || dedupedLineItems?.length) {
    data.incomeStatement = {
      ...(typeof incomeStatement?.totalIncome === 'number' ? { totalIncome: incomeStatement.totalIncome } : {}),
      ...(typeof incomeStatement?.totalExpenses === 'number' ? { totalExpenses: incomeStatement.totalExpenses } : {}),
      ...(incomeStatement?.totalRevenue ? { totalRevenue: incomeStatement.totalRevenue } : {}),
      ...(incomeStatement?.totalOperatingExpenses ? { totalOperatingExpenses: incomeStatement.totalOperatingExpenses } : {}),
      ...(dedupedLineItems?.length ? { lineItems: dedupedLineItems } : {}),
    }
  }

  if (cash) {
    const total = cash.total
    const operating = cash.operating
    const reserves =
      typeof total === 'number' && typeof operating === 'number' ? Math.max(0, roundToCents(total - operating)) : undefined

    data.cash = {
      ...(typeof total === 'number' ? { total } : {}),
      ...(typeof operating === 'number' ? { operating } : {}),
      ...(typeof reserves === 'number' ? { reserves } : {}),
      breakdown: {
        ...(typeof operating === 'number' ? { operating } : {}),
        ...(typeof cash.reserveFunds === 'number' ? { reserve: cash.reserveFunds } : {}),
        ...(typeof cash.escrow === 'number' ? { security: cash.escrow } : {}),
      },
    }
  }

  if (receivables) {
    data.receivables = {
      ...(typeof receivables.current === 'number' ? { current: receivables.current } : {}),
      ...(typeof receivables.over30 === 'number' ? { over30: receivables.over30 } : {}),
      ...(typeof receivables.over60 === 'number' ? { over60: receivables.over60 } : {}),
      ...(typeof receivables.over90 === 'number' ? { over90: receivables.over90 } : {}),
      ...(typeof receivables.total === 'number' ? { total: receivables.total } : {}),
    }
  }

  if (bankReconciliation) {
    data.bankReconciliation = {
      ...(bankReconciliation.asOfDate ? { asOfDate: bankReconciliation.asOfDate } : {}),
      ...(typeof bankReconciliation.balancePerBankStatement === 'number'
        ? { balancePerBankStatement: bankReconciliation.balancePerBankStatement }
        : {}),
      ...(typeof bankReconciliation.adjustedBankBalance === 'number'
        ? { adjustedBankBalance: bankReconciliation.adjustedBankBalance }
        : {}),
      ...(typeof bankReconciliation.reconcilingItemsNet === 'number'
        ? { reconcilingItemsNet: bankReconciliation.reconcilingItemsNet }
        : {}),
      ...(typeof bankReconciliation.depositsInTransit === 'number'
        ? { depositsInTransit: bankReconciliation.depositsInTransit }
        : {}),
      ...(typeof bankReconciliation.outstandingChecks === 'number'
        ? { outstandingChecks: bankReconciliation.outstandingChecks }
        : {}),
    }
  }

  data.notes = [`Imported from PDFs on ${new Date().toLocaleString()}.`]

  return { data, extracted, warnings }
}
