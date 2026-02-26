import type { MonthlyData, NoteEntry } from '../src/lib/data'
import { buildLineItemDictionary, mapNotesToLineItems } from '../src/lib/noteMapping'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function makeNote(partial: Partial<NoteEntry>): NoteEntry {
  return {
    entryId: partial.entryId || `note_${Math.random().toString(16).slice(2)}`,
    category: partial.category || 'GENERAL',
    description: partial.description || 'GENERAL NOTE',
    rawText: partial.rawText || 'GENERAL NOTE',
    parseConfidence: partial.parseConfidence ?? 1,
    ...partial,
  }
}

async function main() {
  const monthData: MonthlyData = {
    monthKey: 'nov-2025',
    label: 'November 2025',
    updatedAt: new Date().toISOString(),
    sources: [{ fileName: 'Financial Statements.pdf', kind: 'financial-statements' }],
    incomeStatement: {
      lineItems: [
        { label: 'LEGAL FEES', kind: 'expense', actual: 44016, budget: 10000, delta: 34016 },
        { label: 'REPAIRS AND MAINTENANCE', kind: 'expense', actual: 15000, budget: 10000, delta: 5000 },
      ],
    },
  }

  const notes: NoteEntry[] = [
    makeNote({
      code: 'K',
      category: 'LEGAL FEES',
      vendor: 'PHILLIPS NIZER LLP',
      amount: 44016,
      serviceMonth: '10/2025',
      description: 'PROVIDING GAS DRYER LITIGATION SERVICES',
      rawText: 'K. LEGAL FEES: PAYMENT TO PHILLIPS NIZER LLP...',
    }),
    makeNote({
      code: 'B',
      category: 'FLOORING REPAIRS',
      vendor: 'CMP CONTRACTING',
      amount: 849,
      serviceMonth: '07/2025',
      description: 'A-72 FLOOR REPAIRING',
      rawText: 'B. FLOORING REPAIRS: PAYMENT TO CMP CONTRACTING...',
    }),
    makeNote({
      code: 'X',
      category: 'UNKNOWN CATEGORY',
      description: 'NON-DESCRIPT ENTRY',
      rawText: 'X. UNKNOWN CATEGORY: SOMETHING',
    }),
  ]

  const dictionary = buildLineItemDictionary(monthData)
  assert(dictionary.length === 2, 'QA FAIL: buildLineItemDictionary returned unexpected size')

  const mapped = mapNotesToLineItems(notes, dictionary)
  const legal = mapped.find((m) => m.code === 'K')
  const repairs = mapped.find((m) => m.code === 'B')
  const unknown = mapped.find((m) => m.code === 'X')

  assert(legal?.mapping?.targetLabel === 'LEGAL FEES', 'QA FAIL: legal note did not map to LEGAL FEES')
  assert((legal?.mapping?.confidence ?? 0) >= 0.7, 'QA FAIL: legal note confidence below high threshold')
  assert(repairs?.mapping?.targetKind !== 'unmapped', 'QA FAIL: repairs note should not be unmapped')
  assert(unknown?.mapping?.targetKind === 'unmapped', 'QA FAIL: unknown note should be unmapped')

  // eslint-disable-next-line no-console
  console.log('QA PASS: note mapping deterministic checks succeeded')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack || err))
  process.exitCode = 1
})
