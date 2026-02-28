/* eslint-disable no-console */

import fs from 'node:fs'
import path from 'node:path'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

type LineItem = {
  label: string
  kind: 'revenue' | 'expense' | 'other'
  actual: number
  budget: number
}

type MonthData = {
  incomeStatement?: {
    totalIncome?: number
    totalExpenses?: number
    totalRevenue?: { actual: number }
    totalOperatingExpenses?: { actual: number }
    lineItems?: LineItem[]
  }
}

type Store = Record<string, MonthData>

const suspiciousPatterns = [
  /METROPOLITAN\s*\/?/i,
  /\bIDB\b/i,
  /STERLING\s+NATIONAL/i,
  /A\/P\s+OVER\s+\d+\s+DAYS/i,
  /\b\d{3,}\s+[A-Z]\d{1,3}\b/i,
  /BANK\s+RECONCILIATION/i,
  /DEPOSITS?\s+IN\s+TRANSIT/i,
  /OUTSTANDING\s+CHECKS?/i,
]

function loadStore(): Store {
  const p = path.join(process.cwd(), '.data', 'month-data.json')
  assert(fs.existsSync(p), `Missing month data file: ${p}`)
  const raw = fs.readFileSync(p, 'utf8')
  return JSON.parse(raw) as Store
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function main() {
  const store = loadStore()
  const monthKeys = Object.keys(store).sort()
  assert(monthKeys.length > 0, 'No month keys found in .data/month-data.json')

  const hardFindings: string[] = []
  const softWarnings: string[] = []

  for (const monthKey of monthKeys) {
    const month = store[monthKey]
    const items = month?.incomeStatement?.lineItems ?? []
    if (!items.length) continue

    const revenueTotal = month?.incomeStatement?.totalRevenue?.actual ?? month?.incomeStatement?.totalIncome
    const expenseTotal = month?.incomeStatement?.totalOperatingExpenses?.actual ?? month?.incomeStatement?.totalExpenses

    const revTotalAbs = typeof revenueTotal === 'number' ? Math.abs(revenueTotal) : null
    const expTotalAbs = typeof expenseTotal === 'number' ? Math.abs(expenseTotal) : null

    let revSum = 0
    let expSum = 0

    for (const item of items) {
      if (!['revenue', 'expense', 'other'].includes(item.kind)) {
        hardFindings.push(`${monthKey}: invalid kind on "${item.label}" -> ${String(item.kind)}`)
      }

      if (suspiciousPatterns.some((re) => re.test(item.label))) {
        hardFindings.push(`${monthKey}: suspicious label "${item.label}"`)
      }

      const basis = item.kind === 'revenue' ? revTotalAbs : item.kind === 'expense' ? expTotalAbs : Math.max(revTotalAbs ?? 0, expTotalAbs ?? 0)
      if (basis && basis > 0) {
        const limit = Math.max(1_000_000, basis * 1.5)
        if (Math.abs(item.actual) > limit || Math.abs(item.budget) > limit) {
          hardFindings.push(`${monthKey}: outlier amount on "${item.label}" (actual=${item.actual}, budget=${item.budget}, basis=${basis})`)
        }
      }

      if (item.kind === 'revenue') revSum += item.actual
      if (item.kind === 'expense') expSum += item.actual
    }

    if (typeof revenueTotal === 'number') {
      const diff = Math.abs(revSum - revenueTotal)
      const tol = Math.max(1, Math.abs(revenueTotal) * 0.02)
      if (diff > tol) {
        const pct = Math.abs(revenueTotal) > 0 ? (diff / Math.abs(revenueTotal)) * 100 : 0
        const msg = `${monthKey}: revenue sum mismatch (sum=${round2(revSum)} total=${round2(revenueTotal)} diff=${round2(diff)} / ${round2(pct)}%)`
        if (pct > 15) hardFindings.push(msg)
        else softWarnings.push(msg)
      }
    }

    if (typeof expenseTotal === 'number') {
      const diff = Math.abs(expSum - expenseTotal)
      const tol = Math.max(1, Math.abs(expenseTotal) * 0.02)
      if (diff > tol) {
        const pct = Math.abs(expenseTotal) > 0 ? (diff / Math.abs(expenseTotal)) * 100 : 0
        const msg = `${monthKey}: expense sum mismatch (sum=${round2(expSum)} total=${round2(expenseTotal)} diff=${round2(diff)} / ${round2(pct)}%)`
        if (pct > 15) hardFindings.push(msg)
        else softWarnings.push(msg)
      }
    }
  }

  if (hardFindings.length) {
    console.error('QA FAIL: data integrity checks found issues:')
    for (const finding of hardFindings) console.error(`- ${finding}`)
    process.exitCode = 1
    return
  }

  console.log(`QA PASS: data integrity clean for ${monthKeys.length} month(s): ${monthKeys.join(', ')}`)
  if (softWarnings.length) {
    console.log('Warnings (reconciliation residuals within allowed threshold):')
    for (const warning of softWarnings) console.log(`- ${warning}`)
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err))
  process.exitCode = 1
})
