import type { MonthlyData, NoteEntry } from '@/lib/data'

type LineItemLite = {
  label: string
  kind: 'revenue' | 'expense' | 'other'
  actual: number
  budget: number
  delta: number
}

type LineItemDictionaryEntry = {
  label: string
  labelNorm: string
  kind: 'revenue' | 'expense' | 'other'
  tokens: string[]
  actual: number
}

const CATEGORY_SYNONYMS: Array<{ pattern: RegExp; tokens: string[]; expectedKind?: 'expense' | 'revenue' }> = [
  { pattern: /LEGAL/i, tokens: ['legal', 'litigation', 'attorney', 'law'], expectedKind: 'expense' },
  { pattern: /CONSULTANT|PROFESSIONAL/i, tokens: ['consulting', 'professional', 'inspection', 'test'], expectedKind: 'expense' },
  { pattern: /FIRE|SMOKE|CARBON MONOXIDE|DETECTOR/i, tokens: ['fire', 'smoke', 'detector', 'safety'], expectedKind: 'expense' },
  { pattern: /ROOF|FLOOR|BOILER|REPAIR|GLASS|WINDOW/i, tokens: ['repair', 'maintenance', 'boiler', 'floor', 'roof', 'glass', 'window'], expectedKind: 'expense' },
  { pattern: /SECURITY|PROTECTION/i, tokens: ['security', 'intercom', 'protection'], expectedKind: 'expense' },
  { pattern: /ENVIRONMENTAL|WATER TREATMENT/i, tokens: ['environmental', 'water', 'treatment', 'sample'], expectedKind: 'expense' },
  { pattern: /INCINERATOR|COMPACTOR/i, tokens: ['compactor', 'incinerator', 'mechanical'], expectedKind: 'expense' },
]

function normalizeToken(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(s: string): string[] {
  const norm = normalizeToken(s)
  if (!norm) return []
  return norm.split(' ').filter((t) => t.length >= 3)
}

function uniqueTokens(tokens: string[]): string[] {
  return Array.from(new Set(tokens))
}

function overlapRatio(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const bSet = new Set(b)
  let hits = 0
  for (const t of a) {
    if (bSet.has(t)) hits += 1
  }
  return hits / Math.max(1, a.length)
}

function scoreAmountProximity(noteAmount: number | undefined, itemActual: number): number {
  if (typeof noteAmount !== 'number' || !Number.isFinite(noteAmount)) return 0
  const absItem = Math.abs(itemActual || 0)
  if (absItem <= 0) return 0
  if (noteAmount <= absItem * 1.1) return 1
  if (noteAmount <= absItem * 1.5) return 0.5
  return 0
}

function expectedKindForCategory(category: string): 'expense' | 'revenue' | undefined {
  for (const rule of CATEGORY_SYNONYMS) {
    if (rule.pattern.test(category)) return rule.expectedKind
  }
  return undefined
}

function categorySeedTokens(category: string): string[] {
  const out: string[] = []
  for (const rule of CATEGORY_SYNONYMS) {
    if (rule.pattern.test(category)) out.push(...rule.tokens)
  }
  return uniqueTokens(out)
}

export function buildLineItemDictionary(monthData: MonthlyData): LineItemDictionaryEntry[] {
  const lineItems = (monthData.incomeStatement?.lineItems ?? []) as LineItemLite[]
  return lineItems
    .filter((item) => Number.isFinite(item.actual) && Number.isFinite(item.budget))
    .map((item) => ({
      label: item.label,
      labelNorm: normalizeToken(item.label),
      kind: item.kind === 'revenue' ? 'revenue' : item.kind === 'expense' ? 'expense' : 'other',
      tokens: uniqueTokens(tokenize(item.label)),
      actual: item.actual,
    }))
}

export function mapNotesToLineItems(notesStructured: NoteEntry[], lineItems: LineItemDictionaryEntry[]): NoteEntry[] {
  if (!notesStructured.length || !lineItems.length) {
    return notesStructured.map((note) => ({
      ...note,
      mapping: {
        targetKind: 'unmapped',
        reason: ['No line-item candidates available'],
        confidence: 0,
      },
    }))
  }

  return notesStructured.map((note) => {
    const expectedKind = expectedKindForCategory(note.category)
    const seedTokens = categorySeedTokens(note.category)
    const noteTokens = uniqueTokens([
      ...tokenize(note.category),
      ...tokenize(note.description),
      ...seedTokens,
    ])

    let best:
      | {
          item: LineItemDictionaryEntry
          confidence: number
          reason: string[]
        }
      | undefined

    for (const item of lineItems) {
      const reasons: string[] = []
      let score = 0

      const tokenScore = overlapRatio(item.tokens, noteTokens)
      if (tokenScore > 0) {
        score += Math.min(0.55, tokenScore * 0.55)
        reasons.push(`keyword overlap ${(tokenScore * 100).toFixed(0)}%`)
      }

      if (expectedKind && item.kind === expectedKind) {
        score += 0.2
        reasons.push(`category implies ${expectedKind}`)
      }
      if (expectedKind && item.kind !== expectedKind) {
        score -= 0.18
        reasons.push(`kind mismatch (${item.kind} vs expected ${expectedKind})`)
      }

      if (note.vendor) {
        const vendorTokens = tokenize(note.vendor)
        const vendorHit = overlapRatio(vendorTokens, item.tokens)
        if (vendorHit > 0) {
          score += Math.min(0.15, vendorHit * 0.15)
          reasons.push('vendor token hint')
        }
      }

      const amtScore = scoreAmountProximity(note.amount, item.actual)
      if (amtScore > 0) {
        score += 0.1 * amtScore
        reasons.push('amount within plausible range')
      }

      const confidence = Math.max(0, Math.min(1, score))
      if (!best || confidence > best.confidence) {
        best = { item, confidence, reason: reasons }
      }
    }

    if (!best || best.confidence < 0.4) {
      return {
        ...note,
        mapping: {
          targetKind: 'unmapped',
          reason: best?.reason?.length ? best.reason : ['No strong line-item match'],
          confidence: best?.confidence ?? 0,
        },
      }
    }

    return {
      ...note,
      mapping: {
        targetKind: best.item.kind === 'revenue' ? 'revenue_line_item' : 'expense_line_item',
        targetLabel: best.item.label,
        reason: best.reason,
        confidence: best.confidence,
      },
    }
  })
}
