import type { MonthlyData } from '@/lib/data'
import { getStoredMonthData } from '@/lib/monthStore'
import { parseStructuredNotesFromRaw } from '@/lib/pdfImport'
import { buildLineItemDictionary, mapNotesToLineItems } from '@/lib/noteMapping'

function enrichNotesForLegacyMonthData(data: MonthlyData): MonthlyData {
  const hasStructured = Array.isArray(data.notesStructured) && data.notesStructured.length > 0
  const baseNotesRaw = data.notesRaw?.length ? data.notesRaw : data.notes
  if (hasStructured || !baseNotesRaw?.length) return data

  const parsed = parseStructuredNotesFromRaw(data.monthKey, baseNotesRaw)
  const mapped =
    parsed.length && data.incomeStatement?.lineItems?.length
      ? mapNotesToLineItems(parsed, buildLineItemDictionary(data))
      : parsed.map((note) => ({
          ...note,
          mapping: {
            targetKind: 'unmapped' as const,
            reason: ['No line-item candidates available'],
            confidence: 0,
          },
        }))

  return {
    ...data,
    notesRaw: data.notesRaw?.length ? data.notesRaw : baseNotesRaw,
    notesStructured: mapped,
    notes: data.notes?.length ? data.notes : baseNotesRaw,
  }
}

// PDF-only data source of truth: whatever has been imported and stored for a month.
export async function getMonthData(monthKey: string): Promise<MonthlyData | null> {
  const data = await getStoredMonthData(monthKey)
  if (!data) return null
  return enrichNotesForLegacyMonthData(data)
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
