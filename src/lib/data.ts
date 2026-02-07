// Monthly data is sourced from uploaded PDFs (no seeded financial numbers).
// Fields are optional because not every PDF set contains every metric.
export interface MonthlyData {
  monthKey: string
  label: string
  month?: string
  year?: number
  updatedAt: string

  sources: Array<{ fileName: string; kind: string }>

  incomeStatement?: {
    totalIncome?: number
    totalExpenses?: number
    // New: Full breakdown with actual/budget/variance
    totalRevenue?: { actual: number; budget: number; variance: number }
    totalOperatingExpenses?: { actual: number; budget: number; variance: number }
    sections?: Array<{
      sectionKey: string
      label: string
      kind: 'revenue' | 'expense'
      actual: number
      budget: number
      delta: number
      order: number
      source: 'fs-subtotal' | 'computed'
    }>
    lineItems?: Array<{
      label: string
      kind: 'revenue' | 'expense' | 'other'
      sectionKey?: string
      actual: number
      budget: number
      delta: number
      ytdActual?: number
      ytdBudget?: number
      ytdDelta?: number
    }>
  }

  noi?: {
    actual?: number
    budget?: number
    variance?: number
  }

  netIncome?: {
    actual?: number
    budget?: number
    variance?: number
  }

  cash?: {
    total?: number
    operating?: number
    reserves?: number
    breakdown?: {
      operating?: number
      reserve?: number
      capital?: number
      security?: number
    }
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

  notes?: string[]
}

export type MonthOption = { value: string; label: string }

const MONTH_ABBR = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const

const MONTH_ABBR_TO_FULL: Record<(typeof MONTH_ABBR)[number], string> = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  may: 'May',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December',
}

export type ParsedMonthKey = { year: number; monthIndex: number }

export function parseMonthKey(monthKey: string): ParsedMonthKey | null {
  const raw = (monthKey || '').trim().toLowerCase()

  const abbr = raw.match(/^([a-z]{3})-(\d{4})$/)
  if (abbr) {
    const monthAbbr = abbr[1] as keyof typeof MONTH_ABBR_TO_FULL
    const year = Number(abbr[2])
    const monthIndex = MONTH_ABBR.indexOf(monthAbbr)
    if (!Number.isFinite(year) || monthIndex === -1) return null
    return { year, monthIndex }
  }

  // Accept YYYY-MM (1 or 2 digit month) but normalize elsewhere.
  const ym = raw.match(/^(\d{4})-(\d{1,2})$/)
  if (ym) {
    const year = Number(ym[1])
    const monthNum = Number(ym[2])
    if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null
    return { year, monthIndex: monthNum - 1 }
  }

  return null
}

export function formatMonthKey(year: number, monthIndex: number): string {
  const abbr = MONTH_ABBR[monthIndex]
  return abbr ? `${abbr}-${year}` : String(year)
}

export function addMonthsToMonthKey(monthKey: string, deltaMonths: number): string | null {
  const parsed = parseMonthKey(monthKey)
  if (!parsed) return null
  const d = new Date(parsed.year, parsed.monthIndex, 1)
  d.setMonth(d.getMonth() + deltaMonths)
  return formatMonthKey(d.getFullYear(), d.getMonth())
}

export function monthKeyToPeriod(monthKey: string): { label: string; month?: string; year?: number } {
  const parsed = parseMonthKey(monthKey)
  if (!parsed) return { label: monthKey }

  const abbr = MONTH_ABBR[parsed.monthIndex]
  const month = abbr ? MONTH_ABBR_TO_FULL[abbr] : undefined
  const label = month ? `${month} ${parsed.year}` : monthKey
  return { label, month, year: parsed.year }
}

export function getMonthKeyFromDate(date: Date): string {
  return formatMonthKey(date.getFullYear(), date.getMonth())
}

export function getMonthOptions(opts?: { baseDate?: Date; pastMonths?: number; futureMonths?: number }): MonthOption[] {
  const baseDate = opts?.baseDate ?? new Date()
  const pastMonths = Math.max(0, opts?.pastMonths ?? 24)
  const futureMonths = Math.max(0, opts?.futureMonths ?? 1)

  const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const out: MonthOption[] = []

  for (let delta = futureMonths; delta >= -pastMonths; delta--) {
    const d = new Date(base)
    d.setMonth(d.getMonth() + delta)
    const value = formatMonthKey(d.getFullYear(), d.getMonth())
    const label = monthKeyToPeriod(value).label
    out.push({ value, label })
  }

  return out
}

export function getTrailingMonthKeys(endMonthKey: string, count: number): string[] {
  const safeCount = Math.max(1, Math.floor(count))
  const parsed = parseMonthKey(endMonthKey)
  if (!parsed) return [endMonthKey]

  const end = new Date(parsed.year, parsed.monthIndex, 1)
  const keys: string[] = []
  for (let i = safeCount - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setMonth(d.getMonth() - i)
    keys.push(formatMonthKey(d.getFullYear(), d.getMonth()))
  }
  return keys
}

export function compareMonthKeysAsc(a: string, b: string): number {
  const pa = parseMonthKey(a)
  const pb = parseMonthKey(b)
  if (!pa && !pb) return a.localeCompare(b)
  if (!pa) return 1
  if (!pb) return -1
  return pa.year !== pb.year ? pa.year - pb.year : pa.monthIndex - pb.monthIndex
}

export function uniqueMonthKeys(keys: string[]): string[] {
  return Array.from(new Set(keys.filter(Boolean)))
}
