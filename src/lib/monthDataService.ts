import type { MonthlyData } from '@/lib/data'
import { getStoredMonthData } from '@/lib/monthStore'

// PDF-only data source of truth: whatever has been imported and stored for a month.
export async function getMonthData(monthKey: string): Promise<MonthlyData | null> {
  return getStoredMonthData(monthKey)
}

// Returns data aligned to the input order (nulls preserved for missing months).
export async function getTrendData(monthKeys: string[]): Promise<Array<MonthlyData | null>> {
  const out: Array<MonthlyData | null> = []
  for (const k of monthKeys) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await getMonthData(k))
  }
  return out
}
