'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js'
import { Line, Pie } from 'react-chartjs-2'
import { addMonthsToMonthKey, compareMonthKeysAsc, getMonthKeyFromDate, getMonthOptions, getTrailingMonthKeys, monthKeyToPeriod, uniqueMonthKeys, type MonthOption, type MonthlyData } from '@/lib/data'
import { generateInsights, generateAISummary, AIInsight } from '@/lib/insights'
import type { PdfImportExtracted } from '@/lib/pdfImport'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type ImportOkResponse = {
  ok: true
  monthKey: string
  requestedMonthKey?: string
  detectedMonthKey?: string | null
  extracted: PdfImportExtracted
  warnings: string[]
  updated: MonthlyData
}

type ImportLogEntry = {
  importedAt: string
  monthKey: string
  requestedMonthKey: string
  sources: Array<{ fileName: string; kind: string; size?: number; detectedMonthKey?: string | null }>
  warnings: string[]
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type StructuredFsNote = {
  code?: string
  category: string
  vendor?: string
  amount?: number
  mmYyyy?: string
  description: string
  raw: string
}

function parseCurrencyToken(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[$,]/g, '').trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

function parseStructuredFsNotes(notes: string[] | undefined): StructuredFsNote[] {
  if (!notes?.length) return []
  const out: StructuredFsNote[] = []

  for (const note of notes) {
    const n = (note || '').trim()
    if (!n || /^Imported from PDFs on\b/i.test(n)) continue

    const headerMatch = n.match(/^([A-Z])\.\s+([^:]+):\s+(.+)$/)
    const code = headerMatch?.[1]
    const category = (headerMatch?.[2] || 'General').trim()
    const body = (headerMatch?.[3] || n).trim()

    const clauses = body.match(/PAYMENT TO\s+.+?(?=(?:PAYMENT TO\s+)|$)/gi) ?? [body]
    for (const clause of clauses) {
      const vendor = clause.match(/PAYMENT TO\s+(.+?)\s+IN\s+\d{1,2}\/\d{4}\s+OF\b/i)?.[1]?.trim()
      const mmYyyy = clause.match(/\bIN\s+(\d{1,2}\/\d{4})\b/i)?.[1]
      const amount = parseCurrencyToken(clause.match(/\bOF\s+\$?\s*([0-9][0-9,]*(?:\.\d+)?)\b/i)?.[1])
      const description = (clause.match(/\bFOR\s+(.+)$/i)?.[1] || clause).trim()
      out.push({ code, category, vendor, amount, mmYyyy, description, raw: n })
    }
  }

  return out
}

async function safeReadJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    // If the server/proxy returned HTML or an empty/non-JSON body
    return { raw: text }
  }
}

async function apiFetchMonthData(monthKey: string): Promise<MonthlyData | null> {
  const res = await fetch(`/api/month-data?monthKey=${encodeURIComponent(monthKey)}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  // Empty state: month not imported yet.
  if (res.status === 404) return null
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error((json as { error?: string })?.error || 'Failed to load month data')
  }
  const json = await res.json()
  return (json?.data as MonthlyData) ?? null
}

async function apiFetchTrendData(keys: string[]): Promise<Array<MonthlyData | null>> {
  const res = await fetch(`/api/month-data?months=${encodeURIComponent(keys.join(','))}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error((json as { error?: string })?.error || 'Failed to load trend data')
  }
  const json = await res.json()
  return (json?.data as Array<MonthlyData | null>) ?? []
}

async function apiFetchStoredMonthKeys(): Promise<string[]> {
  const res = await fetch('/api/month-data', {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = (await safeReadJson(res)) as { keys?: unknown } | null
  return Array.isArray(json?.keys) ? (json!.keys as string[]).filter((k) => typeof k === 'string') : []
}

async function apiFetchImportLog(monthKey: string): Promise<ImportLogEntry[]> {
  const res = await fetch(`/api/import-log?monthKey=${encodeURIComponent(monthKey)}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = (await safeReadJson(res)) as { log?: unknown } | null
  return Array.isArray(json?.log) ? (json!.log as ImportLogEntry[]) : []
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const canImport = session?.user?.role === 'admin' || session?.user?.role === 'manager'
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>(() => getMonthOptions({ pastMonths: 36, futureMonths: 1 }))
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = getMonthKeyFromDate(new Date())
    // Most monthly packets are imported after month-end, so default to the previous month.
    return addMonthsToMonthKey(now, -1) ?? now
  })
  const [monthData, setMonthData] = useState<MonthlyData | null>(null)
  const [trendData, setTrendData] = useState<Array<MonthlyData | null>>([])
  const [loadingMonthData, setLoadingMonthData] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'ai-intro',
      role: 'assistant',
      content: 'Ask me about NOI, cash, receivables, budget variances, or trends for the selected month.',
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [incomeView, setIncomeView] = useState<'mtd' | 'ytd'>('mtd')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ revenue: false, expenses: false, other: false })
  const [revenueSort, setRevenueSort] = useState<{ col: 'actual' | 'budget' | 'variance' | 'label'; dir: 'asc' | 'desc' }>({ col: 'actual', dir: 'desc' })
  const [expenseSort, setExpenseSort] = useState<{ col: 'actual' | 'budget' | 'variance' | 'label'; dir: 'asc' | 'desc' }>({ col: 'actual', dir: 'desc' })
  const autoSelectedMonthRef = useRef(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const [importFiles, setImportFiles] = useState<File[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDetected, setImportDetected] = useState<Array<{fileName: string; kind: string}> | null>(null)
  const [importResult, setImportResult] = useState<ImportOkResponse | null>(null)
  const [importLog, setImportLog] = useState<ImportLogEntry[]>([])
  const [trendReloadToken, setTrendReloadToken] = useState(0)

  const trendKeys = useMemo(() => getTrailingMonthKeys(selectedMonth, 6), [selectedMonth])
  const trendLabels = useMemo(() => trendKeys.map((k) => monthKeyToPeriod(k).label), [trendKeys])
  const trendSeries = useMemo(() => trendKeys.map((_, i) => trendData[i] ?? null), [trendKeys, trendData])

  const selectedMonthLabel =
    monthOptions.find((m) => m.value === selectedMonth)?.label || monthKeyToPeriod(selectedMonth).label || selectedMonth

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    // Load server-merged month data (seed + imported overrides)
    let cancelled = false
    ;(async () => {
      try {
        setLoadingMonthData(true)
        const data = await apiFetchMonthData(selectedMonth)
        if (!cancelled) setMonthData(data)
      } catch {
        if (!cancelled) setMonthData(null)
      } finally {
        if (!cancelled) setLoadingMonthData(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedMonth])

  useEffect(() => {
    // Merge any stored month keys into the dropdown so older months remain selectable.
    let cancelled = false
    ;(async () => {
      try {
        const stored = await apiFetchStoredMonthKeys()
        if (cancelled || !stored.length) return

        setMonthOptions((prev) => {
          const mergedKeys = uniqueMonthKeys([...prev.map((m) => m.value), ...stored])
          mergedKeys.sort((a, b) => compareMonthKeysAsc(b, a))
          return mergedKeys.map((k) => ({ value: k, label: monthKeyToPeriod(k).label }))
        })

        if (!autoSelectedMonthRef.current && !stored.includes(selectedMonth)) {
          const sorted = uniqueMonthKeys([...stored]).sort((a, b) => compareMonthKeysAsc(b, a))
          const latest = sorted[0]
          if (latest && latest !== selectedMonth) {
            setSelectedMonth(latest)
          }
          autoSelectedMonthRef.current = true
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedMonth])

  useEffect(() => {
    // Load trend data for the selected month window
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetchTrendData(trendKeys)
        if (!cancelled) setTrendData(data)
      } catch {
        if (!cancelled) setTrendData([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [trendKeys, trendReloadToken])

  useEffect(() => {
    if (!canImport || activeTab !== 'qa') return
    let cancelled = false
    ;(async () => {
      const log = await apiFetchImportLog(selectedMonth)
      if (!cancelled) setImportLog(log)
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, canImport, selectedMonth])

  useEffect(() => {
    setLoadingInsights(true)
    // Simulate AI analysis delay
    const t = setTimeout(() => {
      if (monthData) {
        setInsights(generateInsights(monthData))
        setAiSummary(generateAISummary(monthData))
      } else {
        setInsights([])
        setAiSummary('Upload the monthly Financial Statements (FS) PDF to generate insights grounded in the document.')
      }
      setLoadingInsights(false)
    }, 800)
    return () => clearTimeout(t)
  }, [monthData])

  useEffect(() => {
    if (!chatEndRef.current) return
    chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, chatLoading])

  if (status === 'loading' || (loadingMonthData && !monthData)) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    )
  }

  const goToUpload = () => {
    setActiveTab('qa')
    // best-effort: allow the tab to render then scroll
    setTimeout(() => {
      const el = document.getElementById('pdf-import-panel')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleImport = async () => {
    setImportError(null)
    setImportDetected(null)
    setImportResult(null)
    if (!canImport) {
      setImportError('You do not have permission to import the FS PDF.')
      return
    }
    if (!importFiles.length) {
      setImportError('Please select the Financial Statements (FS) PDF.')
      return
    }
    if (importFiles.length > 1) {
      setImportError('Please upload only the Financial Statements (FS) PDF.')
      return
    }

    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('monthKey', selectedMonth)
      importFiles.forEach((f) => fd.append('files', f))

      const res = await fetch('/api/import/pdf', {
        method: 'POST',
        body: fd,
      })
      const json = await safeReadJson(res)
      if (!res.ok) {
        const err = json as {
          error?: string
          raw?: string
          detected?: Array<{fileName: string; kind: string}>
        } | null
        // Capture detected sources so user can see what was classified
        if (err?.detected) setImportDetected(err.detected)
        throw new Error(err?.error || err?.raw || `Import failed (HTTP ${res.status})`)
      }

      setImportResult(json as ImportOkResponse)
      const importedMonthKey = (json as ImportOkResponse)?.monthKey
      const targetMonthKey = importedMonthKey || selectedMonth
      if (targetMonthKey !== selectedMonth) {
        setSelectedMonth(targetMonthKey)
      }

      // Refresh stored data
      const targetTrendKeys = getTrailingMonthKeys(targetMonthKey, 6)
      const [m, t] = await Promise.all([
        apiFetchMonthData(targetMonthKey),
        apiFetchTrendData(targetTrendKeys),
      ])
      setMonthData(m)
      setTrendData(t)
      setTrendReloadToken((n) => n + 1)
      setImportLog(await apiFetchImportLog(targetMonthKey))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Import failed'
      setImportError(message)
    } finally {
      setImporting(false)
    }
  }

  // Chart data
  const noiChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Actual NOI',
        data: trendSeries.map((d) => d?.noi?.actual ?? null),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Budget',
        data: trendSeries.map((d) => d?.noi?.budget ?? null),
        borderColor: '#9ca3af',
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
      }
    ]
  }

  const cashTrendChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Total Cash',
        data: trendSeries.map((d) => d?.cash?.total ?? null),
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.10)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const receivablesTrendChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'A/R Total',
        data: trendSeries.map((d) => d?.receivables?.total ?? null),
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.10)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const bankBalanceTrendChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Balance per Bank Statement',
        data: trendSeries.map((d) => d?.bankReconciliation?.balancePerBankStatement ?? null),
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.10)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const hasCashTrend = trendSeries.some((d) => typeof d?.cash?.total === 'number')
  const hasReceivablesTrend = trendSeries.some((d) => typeof d?.receivables?.total === 'number')
  const hasBankTrend = trendSeries.some((d) => typeof d?.bankReconciliation?.balancePerBankStatement === 'number')

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
  }

  const formatCurrency = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—'
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
  }

  const formatCurrencyFull = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—'
    return `$${value.toLocaleString()}`
  }

  const formatSignedCurrency = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—'
    const sign = value >= 0 ? '+' : '-'
    return `${sign}$${Math.abs(value).toLocaleString()}`
  }

  const formatSignedPercent = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—'
    const sign = value >= 0 ? '+' : '-'
    return `${sign}${Math.abs(value).toFixed(1)}%`
  }

  const periodFallback = monthKeyToPeriod(selectedMonth)
  const displayMonth = monthData?.month || periodFallback.month || selectedMonth
  const displayYear = monthData?.year || periodFallback.year

  const cashBreakdown = monthData?.cash?.breakdown
  const totalCash = monthData?.cash?.total

  const receivables = monthData?.receivables
  const incomeStatement = monthData?.incomeStatement
  const bankReconciliation = monthData?.bankReconciliation

  const requiredKinds = ['financial-statements'] as const
  const presentKinds = new Set((monthData?.sources || []).map((s) => s.kind))
  const missingKinds = requiredKinds.filter((k) => !presentKinds.has(k))

  const budgetLineItems = incomeStatement?.lineItems ?? []
  const selectLineItemView = (item: typeof budgetLineItems[number]) => {
    const hasYtd = typeof item.ytdActual === 'number' || typeof item.ytdBudget === 'number' || typeof item.ytdDelta === 'number'
    const useYtd = incomeView === 'ytd' && hasYtd
    const actual = useYtd && typeof item.ytdActual === 'number' ? item.ytdActual : item.actual
    const budget = useYtd && typeof item.ytdBudget === 'number' ? item.ytdBudget : item.budget
    const delta = useYtd && typeof item.ytdDelta === 'number' ? item.ytdDelta : actual - budget
    return { ...item, viewActual: actual, viewBudget: budget, viewDelta: delta, viewIsYtd: useYtd }
  }

  const lineItemsForView = budgetLineItems
    .filter((x) => Number.isFinite(x.actual) && Number.isFinite(x.budget))
    .map(selectLineItemView)

  const hasYtdData = lineItemsForView.some((x) => x.viewIsYtd)
  const revenueLineItems = lineItemsForView.filter((x) => x.kind === 'revenue')
  const expenseLineItems = lineItemsForView.filter((x) => x.kind !== 'revenue')
  const topRevenueItems = [...revenueLineItems].sort((a, b) => b.viewActual - a.viewActual).slice(0, 3)
  const topExpenseItems = [...expenseLineItems].sort((a, b) => b.viewActual - a.viewActual).slice(0, 3)
  const topVarianceItems = [...lineItemsForView].sort((a, b) => Math.abs(b.viewDelta) - Math.abs(a.viewDelta)).slice(0, 3)
  const lineItemScopeLabel = incomeView === 'ytd' && hasYtdData ? 'YTD' : 'MTD'
  const structuredNotes = parseStructuredFsNotes(monthData?.notes)
  const topOneTimeNotes = [...structuredNotes]
    .filter((n) => typeof n.amount === 'number')
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 5)

  const vendorNoteSummary = (() => {
    const map = new Map<string, { vendor: string; total: number; count: number }>()
    for (const note of structuredNotes) {
      const vendor = (note.vendor || '').trim()
      if (!vendor || typeof note.amount !== 'number') continue
      const key = vendor.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.total += note.amount
        existing.count += 1
      } else {
        map.set(key, { vendor, total: note.amount, count: 1 })
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  })()

  // Sort helper function
  const sortItems = <T extends { label: string; viewActual: number; viewBudget: number; viewDelta: number }>(
    items: T[],
    sort: { col: 'actual' | 'budget' | 'variance' | 'label'; dir: 'asc' | 'desc' }
  ): T[] => {
    return [...items].sort((a, b) => {
      let valA: number | string, valB: number | string
      switch (sort.col) {
        case 'actual': valA = a.viewActual; valB = b.viewActual; break
        case 'budget': valA = a.viewBudget; valB = b.viewBudget; break
        case 'variance': valA = a.viewDelta; valB = b.viewDelta; break
        case 'label': valA = a.label.toLowerCase(); valB = b.label.toLowerCase(); break
      }
      if (sort.col === 'label') {
        return sort.dir === 'asc' 
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string)
      }
      return sort.dir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
    })
  }

  // Group line items by kind for breakdown sections
  const revenueItemsRaw = lineItemsForView.filter((x) => x.kind === 'revenue')
  const expenseItemsRaw = lineItemsForView.filter((x) => x.kind === 'expense' || x.kind === 'other')

  // Calculate sums and add balancing "Other" row to reconcile with FS totals
  const sumRevenueRaw = revenueItemsRaw.reduce((acc, x) => acc + (x.viewActual || 0), 0)
  const sumRevenueBudgetRaw = revenueItemsRaw.reduce((acc, x) => acc + (x.viewBudget || 0), 0)
  const fsRevenueActual = incomeStatement?.totalRevenue?.actual ?? incomeStatement?.totalIncome ?? 0
  const fsRevenueBudget = incomeStatement?.totalRevenue?.budget ?? 0
  const revenueDiff = fsRevenueActual - sumRevenueRaw
  const revenueBudgetDiff = fsRevenueBudget - sumRevenueBudgetRaw

  const revenueItemsWithBalancing = Math.abs(revenueDiff) > 1 
    ? [...revenueItemsRaw, { 
        label: 'Other Revenue (Unclassified)', 
        kind: 'revenue' as const, 
        viewActual: revenueDiff, 
        viewBudget: revenueBudgetDiff, 
        viewDelta: revenueDiff - revenueBudgetDiff,
        viewIsYtd: false,
        actual: revenueDiff,
        budget: revenueBudgetDiff,
        delta: revenueDiff - revenueBudgetDiff
      }]
    : revenueItemsRaw
  const revenueItems = sortItems(revenueItemsWithBalancing, revenueSort)

  const sumExpensesRaw = expenseItemsRaw.reduce((acc, x) => acc + (x.viewActual || 0), 0)
  const sumExpensesBudgetRaw = expenseItemsRaw.reduce((acc, x) => acc + (x.viewBudget || 0), 0)
  const fsExpensesActual = incomeStatement?.totalOperatingExpenses?.actual ?? incomeStatement?.totalExpenses ?? 0
  const fsExpensesBudget = incomeStatement?.totalOperatingExpenses?.budget ?? 0
  const expensesDiff = fsExpensesActual - sumExpensesRaw
  const expensesBudgetDiff = fsExpensesBudget - sumExpensesBudgetRaw

  const expenseItemsWithBalancing = Math.abs(expensesDiff) > 1
    ? [...expenseItemsRaw, {
        label: 'Other Expenses (Unclassified)',
        kind: 'expense' as const,
        viewActual: expensesDiff,
        viewBudget: expensesBudgetDiff,
        viewDelta: expensesDiff - expensesBudgetDiff,
        viewIsYtd: false,
        actual: expensesDiff,
        budget: expensesBudgetDiff,
        delta: expensesDiff - expensesBudgetDiff
      }]
    : expenseItemsRaw
  const expenseItems = sortItems(expenseItemsWithBalancing, expenseSort)

  // Final sums (should now match FS totals)
  const sumRevenue = revenueItems.reduce((acc, x) => acc + (x.viewActual || 0), 0)
  const sumExpenses = expenseItems.reduce((acc, x) => acc + (x.viewActual || 0), 0)

  const expenseTotalActual =
    typeof incomeStatement?.totalOperatingExpenses?.actual === 'number'
      ? incomeStatement.totalOperatingExpenses.actual
      : typeof incomeStatement?.totalExpenses === 'number'
        ? incomeStatement.totalExpenses
        : sumExpenses

  const expensePalette = ['#2563eb', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#0f766e']

  // Month-over-month comparison (compare to previous month in trend data)
  const prevMonthData = trendSeries.length >= 2 ? trendSeries[trendSeries.length - 2] : null
  const currentMonthData = trendSeries.length >= 1 ? trendSeries[trendSeries.length - 1] : null
  
  const calcMoMChange = (current?: number | null, prev?: number | null) => {
    if (typeof current !== 'number' || typeof prev !== 'number' || prev === 0) return null
    return ((current - prev) / Math.abs(prev)) * 100
  }

  const momNOI = calcMoMChange(currentMonthData?.noi?.actual, prevMonthData?.noi?.actual)
  const momNetIncome = calcMoMChange(currentMonthData?.netIncome?.actual, prevMonthData?.netIncome?.actual)
  const momCash = calcMoMChange(currentMonthData?.cash?.total, prevMonthData?.cash?.total)
  const momAR = calcMoMChange(currentMonthData?.receivables?.total, prevMonthData?.receivables?.total)

  const getLineItemsForMonth = (data: MonthlyData | null) =>
    (data?.incomeStatement?.lineItems ?? [])
      .filter((x) => Number.isFinite(x.actual) && Number.isFinite(x.budget))
      .map(selectLineItemView)

  const prevLineItemsForView = getLineItemsForMonth(prevMonthData)
  const prevLineItemsMap = new Map(prevLineItemsForView.map((item) => [item.label.toLowerCase(), item]))

  const expenseBreakdownBase = expenseLineItems
    .filter((item) => Number.isFinite(item.viewActual))
    .map((item) => {
      const prev = prevLineItemsMap.get(item.label.toLowerCase())
      const prevActual = typeof prev?.viewActual === 'number' ? prev.viewActual : null
      const momDelta = typeof prevActual === 'number' ? item.viewActual - prevActual : null
      const mom = calcMoMChange(item.viewActual, prevActual)
      return { ...item, mom, momDelta }
    })

  const expenseChartEligible = expenseBreakdownBase.filter((item) => item.viewActual > 0)
  const excludedExpenseItems = expenseBreakdownBase.filter((item) => item.viewActual <= 0)
  const expenseTotalForPercent = expenseChartEligible.reduce((acc, item) => acc + item.viewActual, 0)

  const expenseChartItems = expenseChartEligible
    .map((item) => ({
      ...item,
      percent: expenseTotalForPercent !== 0 ? (item.viewActual / expenseTotalForPercent) * 100 : null,
    }))
    .sort((a, b) => b.viewActual - a.viewActual)

  const topExpenseDriver = expenseChartItems[0]
  const expenseBudgetTotal = typeof incomeStatement?.totalOperatingExpenses?.budget === 'number'
    ? incomeStatement.totalOperatingExpenses.budget
    : null
  const expenseVarianceTotal =
    typeof expenseBudgetTotal === 'number' && typeof expenseTotalActual === 'number'
      ? expenseTotalActual - expenseBudgetTotal
      : null
  const expenseVariancePct =
    typeof expenseBudgetTotal === 'number' && expenseBudgetTotal !== 0 && typeof expenseVarianceTotal === 'number'
      ? (expenseVarianceTotal / Math.abs(expenseBudgetTotal)) * 100
      : null

  const largestExpenseVariance = [...expenseBreakdownBase]
    .filter((item) => Number.isFinite(item.viewDelta))
    .sort((a, b) => Math.abs(b.viewDelta) - Math.abs(a.viewDelta))[0]

  const biggestMoMIncrease = [...expenseBreakdownBase]
    .filter((item) => typeof item.momDelta === 'number' && item.momDelta > 0)
    .sort((a, b) => (b.momDelta ?? 0) - (a.momDelta ?? 0))[0]

  const biggestMoMDecrease = [...expenseBreakdownBase]
    .filter((item) => typeof item.momDelta === 'number' && item.momDelta < 0)
    .sort((a, b) => (a.momDelta ?? 0) - (b.momDelta ?? 0))[0]

  const momHighlight = biggestMoMIncrease ?? biggestMoMDecrease
  const momHighlightLabel = biggestMoMIncrease
    ? 'Biggest MoM increase'
    : biggestMoMDecrease
      ? 'Biggest MoM decrease'
      : 'MoM change'

  const formatMoM = (pct: number | null, invertColor = false) => {
    if (pct === null) return null
    const isPositive = pct >= 0
    const colorClass = invertColor ? (isPositive ? 'danger' : 'success') : (isPositive ? 'success' : 'danger')
    const arrow = isPositive ? '↑' : '↓'
    return { pct: Math.abs(pct).toFixed(1), arrow, colorClass, isPositive }
  }

  const createMessageId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const makeLines = (title: string, lines: string[]) => {
    const cleaned = lines.filter((line) => line && line.trim())
    if (!cleaned.length) return title
    return `${title}\n${cleaned.map((line) => `• ${line}`).join('\n')}`
  }

  const buildMoMLine = (current?: number | null, prev?: number | null, pct?: number | null) => {
    if (typeof current !== 'number' || typeof prev !== 'number') return null
    const delta = current - prev
    const pctText = typeof pct === 'number' ? ` (${formatSignedPercent(pct)})` : ''
    return `vs prior month: ${formatSignedCurrency(delta)}${pctText}`
  }

  const buildTrendSummary = (label: string, extractor: (d: MonthlyData | null) => number | null | undefined) => {
    const points = trendSeries
      .map((d, idx) => {
        const value = extractor(d)
        if (typeof value !== 'number') return null
        return { label: trendLabels[idx], value }
      })
      .filter((x): x is { label: string; value: number } => Boolean(x))

    if (!points.length) {
      return `${label} trend data is not available for the last ${trendLabels.length} months.`
    }

    const lines = points.map((p) => `${p.label}: ${formatCurrencyFull(p.value)}`)
    if (points.length >= 2) {
      const delta = points[points.length - 1].value - points[0].value
      const pct = points[0].value !== 0 ? (delta / Math.abs(points[0].value)) * 100 : null
      const pctText = pct === null ? '' : ` (${formatSignedPercent(pct)})`
      lines.push(`Change since ${points[0].label}: ${formatSignedCurrency(delta)}${pctText}`)
    }

    return makeLines(`${label} trend (last ${points.length} months):`, lines)
  }

  const createIntroMessage = (): ChatMessage => ({
    id: createMessageId(),
    role: 'assistant',
    content: monthData
      ? `Ask me anything about ${selectedMonthLabel}. Try "What is NOI vs budget?"`
      : `Upload the Financial Statements (FS) PDF for ${selectedMonthLabel} to unlock data questions.`,
  })

  const buildChatResponse = (question: string): string => {
    const q = question.toLowerCase()
    const wantsHelp = /help|what can you do|examples|suggest/.test(q)
    const wantsSummary = /summary|overview|insight|highlights/.test(q)
    const wantsTrend = /trend|over time|last 6|past 6|history/.test(q)
    const wantsCompare = /compare|vs|versus|previous|prior|last month|month[- ]over[- ]month|mom/.test(q)
    const wantsBudget = /budget|variance|over budget|under budget/.test(q)
    const wantsVariance = /variance|over budget|under budget/.test(q)
    const wantsTop = /top|largest|biggest|highest|main/.test(q)
    const wantsBreakdown = /breakdown|detail|line item|category/.test(q)
    const wantsNOI = /noi|net operating income/.test(q)
    const wantsNetIncome = /net income|bottom line/.test(q)
    const wantsCash = /cash|liquidity|reserve|reserves|operating cash/.test(q)
    const wantsReceivables = /receivable|a\/r|aging|over 30|over 60|over 90/.test(q)
    const wantsBank = /bank|reconcil|deposit|outstanding check/.test(q)
    const wantsNotes = /notes?|comment/.test(q)
    const wantsOneTime = /one[- ]?time|non[- ]?recurring|unusual|exception/.test(q)
    const wantsVendorSummary = /vendor|payee|supplier/.test(q)
    const wantsVarianceExplain = /explain variance|why .*variance|what caused .*variance|what drove .*variance/.test(q)
    const wantsSources = /source|pdf|file/.test(q)
    const wantsRevenue =
      /revenue|rent|rental|top line|income statement/.test(q) || (q.includes('income') && !wantsNetIncome)
    const wantsExpenses = /expense|opex|operating expense|utilities|payroll/.test(q)
    const wantsBudgetOverview =
      wantsBudget && !wantsNOI && !wantsRevenue && !wantsExpenses && !wantsNetIncome

    const hasSpecificMetric =
      wantsSummary ||
      wantsTrend ||
      wantsCompare ||
      wantsNOI ||
      wantsNetIncome ||
      wantsCash ||
      wantsReceivables ||
      wantsRevenue ||
      wantsExpenses ||
      wantsBank ||
      wantsNotes ||
      wantsOneTime ||
      wantsVendorSummary ||
      wantsVarianceExplain ||
      wantsSources

    if (!monthData) {
      if (wantsHelp || wantsSources || /import|upload/.test(q)) {
        return `I don't have imported data for ${selectedMonthLabel} yet. Upload the Financial Statements (FS) PDF to answer questions about NOI, cash, receivables, expenses, and trends.`
      }
      return `I don't have imported data for ${selectedMonthLabel} yet. Upload the FS PDF to unlock data-driven answers.`
    }

    if (wantsHelp && !hasSpecificMetric) {
      return makeLines('You can ask me things like:', [
        'What is NOI vs budget this month?',
        'Show the cash and reserve breakdown.',
        'How did A/R change over the last 6 months?',
        'Are operating expenses over budget?',
        'What are the top expense line items?',
        'Show unusual one-time expenses from notes.',
        'Summarize notes by vendor.',
      ])
    }

    const responses: string[] = []

    if (wantsSummary) {
      const summaryLines: string[] = []
      if (aiSummary) summaryLines.push(aiSummary)
      if (insights.length) {
        summaryLines.push(
          ...insights.slice(0, 3).map((insight) => `${insight.title}: ${insight.description}`)
        )
      }
      responses.push(makeLines(`Summary for ${selectedMonthLabel}:`, summaryLines))
    }

    if (wantsNOI || wantsBudgetOverview) {
      const noi = monthData.noi
      if (typeof noi?.actual === 'number' || typeof noi?.budget === 'number' || typeof noi?.variance === 'number') {
        const lines: string[] = []
        if (typeof noi?.actual === 'number') lines.push(`Actual: ${formatCurrencyFull(noi.actual)}`)
        if (typeof noi?.budget === 'number') lines.push(`Budget: ${formatCurrencyFull(noi.budget)}`)
        if (typeof noi?.variance === 'number') lines.push(`Variance: ${formatSignedCurrency(noi.variance)}`)
        const momLine = buildMoMLine(noi?.actual, prevMonthData?.noi?.actual, momNOI)
        if (wantsCompare && momLine) lines.push(momLine)
        responses.push(makeLines(`NOI (${selectedMonthLabel}):`, lines))
        if (wantsTrend) responses.push(buildTrendSummary('NOI', (d) => d?.noi?.actual))
      } else if (wantsNOI) {
        responses.push(`NOI data is not available for ${selectedMonthLabel}.`)
      }
    }

    if (wantsNetIncome) {
      const netIncome = monthData.netIncome
      if (
        typeof netIncome?.actual === 'number' ||
        typeof netIncome?.budget === 'number' ||
        typeof netIncome?.variance === 'number'
      ) {
        const lines: string[] = []
        if (typeof netIncome?.actual === 'number') lines.push(`Actual: ${formatCurrencyFull(netIncome.actual)}`)
        if (typeof netIncome?.budget === 'number') lines.push(`Budget: ${formatCurrencyFull(netIncome.budget)}`)
        if (typeof netIncome?.variance === 'number') lines.push(`Variance: ${formatSignedCurrency(netIncome.variance)}`)
        const momLine = buildMoMLine(netIncome?.actual, prevMonthData?.netIncome?.actual, momNetIncome)
        if (wantsCompare && momLine) lines.push(momLine)
        responses.push(makeLines(`Net income (${selectedMonthLabel}):`, lines))
        if (wantsTrend) responses.push(buildTrendSummary('Net income', (d) => d?.netIncome?.actual))
      } else {
        responses.push(`Net income data is not available for ${selectedMonthLabel}.`)
      }
    }

    if (wantsCash) {
      const cash = monthData.cash
      if (typeof cash?.total === 'number') {
        const lines: string[] = [`Total: ${formatCurrencyFull(cash.total)}`]
        if (typeof cash?.operating === 'number') lines.push(`Operating: ${formatCurrencyFull(cash.operating)}`)
        if (typeof cash?.reserves === 'number') lines.push(`Reserves: ${formatCurrencyFull(cash.reserves)}`)
        if (cash?.breakdown) {
          if (typeof cash.breakdown.operating === 'number') lines.push(`Operating (breakdown): ${formatCurrencyFull(cash.breakdown.operating)}`)
          if (typeof cash.breakdown.reserve === 'number') lines.push(`Reserve: ${formatCurrencyFull(cash.breakdown.reserve)}`)
          if (typeof cash.breakdown.capital === 'number') lines.push(`Capital: ${formatCurrencyFull(cash.breakdown.capital)}`)
          if (typeof cash.breakdown.security === 'number') lines.push(`Escrow/Security: ${formatCurrencyFull(cash.breakdown.security)}`)
        }
        const momLine = buildMoMLine(cash?.total, prevMonthData?.cash?.total, momCash)
        if (wantsCompare && momLine) lines.push(momLine)
        responses.push(makeLines(`Cash position (${selectedMonthLabel}):`, lines))
        if (wantsTrend) responses.push(buildTrendSummary('Cash', (d) => d?.cash?.total))
      } else {
        responses.push(`Cash data is not available for ${selectedMonthLabel}.`)
      }
    }

    if (wantsReceivables) {
      const recv = monthData.receivables
      if (typeof recv?.total === 'number') {
        const lines: string[] = [`Total A/R: ${formatCurrencyFull(recv.total)}`]
        if (typeof recv.current === 'number') lines.push(`Current: ${formatCurrencyFull(recv.current)}`)
        if (typeof recv.over30 === 'number') lines.push(`Over 30: ${formatCurrencyFull(recv.over30)}`)
        if (typeof recv.over60 === 'number') lines.push(`Over 60: ${formatCurrencyFull(recv.over60)}`)
        if (typeof recv.over90 === 'number') lines.push(`Over 90: ${formatCurrencyFull(recv.over90)}`)
        const momLine = buildMoMLine(recv?.total, prevMonthData?.receivables?.total, momAR)
        if (wantsCompare && momLine) lines.push(momLine)
        responses.push(makeLines(`Receivables (${selectedMonthLabel}):`, lines))
        if (wantsTrend) responses.push(buildTrendSummary('Receivables', (d) => d?.receivables?.total))
      } else {
        responses.push(`Receivables data is not available for ${selectedMonthLabel}.`)
      }
    }

    if (wantsRevenue || wantsBudgetOverview) {
      const revenueActual = incomeStatement?.totalRevenue?.actual ?? incomeStatement?.totalIncome
      const revenueBudget = incomeStatement?.totalRevenue?.budget
      const revenueVariance =
        incomeStatement?.totalRevenue?.variance ??
        (typeof revenueActual === 'number' && typeof revenueBudget === 'number' ? revenueActual - revenueBudget : null)

      if (typeof revenueActual === 'number' || typeof revenueBudget === 'number' || typeof revenueVariance === 'number') {
        const lines: string[] = []
        if (typeof revenueActual === 'number') lines.push(`Actual: ${formatCurrencyFull(revenueActual)}`)
        if (typeof revenueBudget === 'number') lines.push(`Budget: ${formatCurrencyFull(revenueBudget)}`)
        if (typeof revenueVariance === 'number') lines.push(`Variance: ${formatSignedCurrency(revenueVariance)}`)
        responses.push(makeLines(`Total revenue (${lineItemScopeLabel}, ${selectedMonthLabel}):`, lines))
      } else if (wantsRevenue) {
        responses.push(`Revenue totals are not available for ${selectedMonthLabel}.`)
      }

      if ((wantsTop || wantsBreakdown) && topRevenueItems.length) {
        responses.push(
          makeLines(`Top revenue line items (${lineItemScopeLabel}):`, topRevenueItems.map((item) =>
            `${item.label}: ${formatCurrencyFull(item.viewActual)} (budget ${formatCurrencyFull(item.viewBudget)}, variance ${formatSignedCurrency(item.viewDelta)})`
          ))
        )
      }
    }

    if (wantsExpenses || wantsBudgetOverview) {
      const expensesActual = incomeStatement?.totalOperatingExpenses?.actual ?? incomeStatement?.totalExpenses
      const expensesBudget = incomeStatement?.totalOperatingExpenses?.budget
      const expensesVariance =
        incomeStatement?.totalOperatingExpenses?.variance ??
        (typeof expensesActual === 'number' && typeof expensesBudget === 'number' ? expensesActual - expensesBudget : null)

      if (typeof expensesActual === 'number' || typeof expensesBudget === 'number' || typeof expensesVariance === 'number') {
        const lines: string[] = []
        if (typeof expensesActual === 'number') lines.push(`Actual: ${formatCurrencyFull(expensesActual)}`)
        if (typeof expensesBudget === 'number') lines.push(`Budget: ${formatCurrencyFull(expensesBudget)}`)
        if (typeof expensesVariance === 'number') {
          const status = expensesVariance > 0 ? 'over budget' : expensesVariance < 0 ? 'under budget' : 'on budget'
          lines.push(`Variance: ${formatSignedCurrency(expensesVariance)} (${status})`)
        }
        responses.push(makeLines(`Operating expenses (${lineItemScopeLabel}, ${selectedMonthLabel}):`, lines))
      } else if (wantsExpenses) {
        responses.push(`Expense totals are not available for ${selectedMonthLabel}.`)
      }

      if ((wantsTop || wantsBreakdown) && topExpenseItems.length) {
        responses.push(
          makeLines(`Top expense line items (${lineItemScopeLabel}):`, topExpenseItems.map((item) =>
            `${item.label}: ${formatCurrencyFull(item.viewActual)} (budget ${formatCurrencyFull(item.viewBudget)}, variance ${formatSignedCurrency(item.viewDelta)})`
          ))
        )
      }
    }

    if (wantsVariance && !wantsRevenue && !wantsExpenses && topVarianceItems.length) {
      responses.push(
        makeLines(`Largest variances (${lineItemScopeLabel}):`, topVarianceItems.map((item) =>
          `${item.label}: ${formatSignedCurrency(item.viewDelta)} (actual ${formatCurrencyFull(item.viewActual)}, budget ${formatCurrencyFull(item.viewBudget)})`
        ))
      )
    }

    if (wantsBank) {
      const bank = monthData.bankReconciliation
      if (bank) {
        const lines: string[] = []
        if (bank.asOfDate) lines.push(`As of ${bank.asOfDate}`)
        if (typeof bank.balancePerBankStatement === 'number') lines.push(`Balance per bank statement: ${formatCurrencyFull(bank.balancePerBankStatement)}`)
        if (typeof bank.adjustedBankBalance === 'number') lines.push(`Adjusted bank balance: ${formatCurrencyFull(bank.adjustedBankBalance)}`)
        if (typeof bank.reconcilingItemsNet === 'number') lines.push(`Reconciling items net: ${formatSignedCurrency(bank.reconcilingItemsNet)}`)
        if (typeof bank.depositsInTransit === 'number') lines.push(`Deposits in transit: ${formatCurrencyFull(bank.depositsInTransit)}`)
        if (typeof bank.outstandingChecks === 'number') lines.push(`Outstanding checks: ${formatCurrencyFull(bank.outstandingChecks)}`)
        responses.push(makeLines(`Bank reconciliation (${selectedMonthLabel}):`, lines))
      } else {
        responses.push(`Bank reconciliation data is not available for ${selectedMonthLabel}.`)
      }
    }

    if (wantsNotes) {
      if (monthData.notes?.length) {
        responses.push(makeLines('Notes from the FS PDF:', monthData.notes))
      } else {
        responses.push('No notes were captured for this month.')
      }
    }

    if (wantsOneTime) {
      if (topOneTimeNotes.length) {
        responses.push(
          makeLines(
            `Top one-time expense notes (${selectedMonthLabel}):`,
            topOneTimeNotes.map((n) =>
              `${n.code ? `${n.code}. ` : ''}${n.category}: ${n.vendor || 'Vendor not parsed'} • ${formatCurrencyFull(n.amount)}${n.mmYyyy ? ` • ${n.mmYyyy}` : ''}`
            )
          )
        )
      } else if (structuredNotes.length) {
        responses.push(
          makeLines(
            `One-time expense notes (${selectedMonthLabel}):`,
            structuredNotes.slice(0, 8).map((n) => `${n.code ? `${n.code}. ` : ''}${n.category}: ${n.description}`)
          )
        )
      } else {
        responses.push('No parsed notes are available for one-time expense analysis this month.')
      }
    }

    if (wantsVendorSummary) {
      if (vendorNoteSummary.length) {
        responses.push(
          makeLines(
            `Vendor summary from notes (${selectedMonthLabel}):`,
            vendorNoteSummary.slice(0, 8).map((v) => `${v.vendor}: ${formatCurrencyFull(v.total)} across ${v.count} item${v.count === 1 ? '' : 's'}`)
          )
        )
      } else if (structuredNotes.length) {
        responses.push('Notes were found, but vendor/amount fields could not be parsed consistently.')
      } else {
        responses.push('No notes are available for vendor summary this month.')
      }
    }

    if (wantsVarianceExplain) {
      const topExpenseVarianceItems = topVarianceItems.filter((item) => item.kind !== 'revenue')
      const evidenceLines: string[] = []
      for (const item of topExpenseVarianceItems.slice(0, 3)) {
        const labelWords = item.label
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 4 && !['total', 'other', 'operating', 'expense', 'expenses', 'unclassified'].includes(w))
        const match = structuredNotes.find((n) => {
          const hay = `${n.category} ${n.description}`.toLowerCase()
          return labelWords.some((w) => hay.includes(w))
        })
        if (!match) continue
        evidenceLines.push(
          `${item.label} variance ${formatSignedCurrency(item.viewDelta)} likely relates to ${match.code ? `${match.code}. ` : ''}${match.category}${match.amount ? ` (${formatCurrencyFull(match.amount)})` : ''}${match.vendor ? ` from ${match.vendor}` : ''}.`
        )
      }

      if (evidenceLines.length) {
        responses.push(makeLines(`Variance explanation using notes (${selectedMonthLabel}):`, evidenceLines))
      } else if (topVarianceItems.length) {
        responses.push(
          makeLines(
            `Top variance drivers (${selectedMonthLabel}):`,
            topVarianceItems.slice(0, 3).map((item) => `${item.label}: ${formatSignedCurrency(item.viewDelta)}`)
          )
        )
      } else {
        responses.push('I could not find enough variance detail to explain this month.')
      }
    }

    if (wantsSources) {
      if (monthData.sources?.length) {
        responses.push(
          makeLines(
            'Source files:',
            monthData.sources.map((source) => `${source.fileName} (${source.kind})`)
          )
        )
      } else {
        responses.push('No source files were captured for this month.')
      }
    }

    if (wantsTrend && responses.length === 0) {
      const trendBlocks = [
        buildTrendSummary('NOI', (d) => d?.noi?.actual),
        buildTrendSummary('Cash', (d) => d?.cash?.total),
        buildTrendSummary('Receivables', (d) => d?.receivables?.total),
      ]
      responses.push(...trendBlocks)
    }

    if (wantsCompare && responses.length === 0) {
      const compareLines: string[] = []
      const noiLine = buildMoMLine(monthData.noi?.actual, prevMonthData?.noi?.actual, momNOI)
      const cashLine = buildMoMLine(monthData.cash?.total, prevMonthData?.cash?.total, momCash)
      const arLine = buildMoMLine(monthData.receivables?.total, prevMonthData?.receivables?.total, momAR)
      if (noiLine) compareLines.push(`NOI ${noiLine}`)
      if (cashLine) compareLines.push(`Cash ${cashLine}`)
      if (arLine) compareLines.push(`Receivables ${arLine}`)
      if (compareLines.length) {
        responses.push(makeLines(`Month-over-month changes (${selectedMonthLabel} vs prior month):`, compareLines))
      } else {
        responses.push('Month-over-month comparisons are not available for this period.')
      }
    }

    if (!responses.length) {
      return makeLines('I can help with:', [
        'NOI, net income, cash, receivables, revenue, expenses, and bank reconciliation',
        'Budget variances and top line items',
        '6-month trends and month-over-month changes',
        'Notes and source PDFs from the uploaded statements',
      ])
    }

    return responses.join('\n\n')
  }

  const handleSendMessage = (value?: string) => {
    const message = (value ?? chatInput).trim()
    if (!message || chatLoading) return
    setChatInput('')
    setChatMessages((prev) => [
      ...prev,
      { id: createMessageId(), role: 'user', content: message },
    ])
    setChatLoading(true)
    const response = buildChatResponse(message)
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: 'assistant', content: response },
      ])
      setChatLoading(false)
    }, 600)
  }

  const resetChat = () => {
    setChatMessages([createIntroMessage()])
  }

  const chatSuggestions = monthData
    ? [
        `What is NOI vs budget for ${selectedMonthLabel}?`,
        'Show cash and reserve breakdown.',
        'How do receivables look this month?',
        'Any risks or highlights in the expenses?',
        'Show the NOI trend for the last 6 months.',
        'Show unusual one-time expenses from notes.',
        'Summarize notes by vendor.',
      ]
    : [
        `What data is available for ${selectedMonthLabel}?`,
        'How do I import the FS PDF?',
        'What can I ask you about?',
      ]



  return (
    <div className="page">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">Park Terrace Gardens</h1>
          <p className="app-subtitle">Financial Dashboard • Real-time Analysis & AI Insights</p>
        </div>
        <div className="app-header-right">
          <div className="security-badge">
            <i className="fas fa-shield-alt"></i>
            Secure
          </div>
          
          <div className="month-selector">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <button
            className={`btn btn-primary btn-inline ${canImport ? '' : 'is-disabled'}`}
            onClick={() => {
              if (!canImport) return
              goToUpload()
            }}
            title={canImport ? 'Upload monthly FS PDF' : 'You do not have permission to upload the FS PDF'}
          >
            <i className="fas fa-upload"></i>
            Upload FS PDF
          </button>

          <div className="user-menu">
            <button 
              className="user-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-avatar">{getInitials(session?.user?.name || '')}</div>
              <span>{session?.user?.name}</span>
              <i className="fas fa-chevron-down" style={{ fontSize: 10, color: 'var(--text-muted)' }}></i>
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-item" onClick={() => { setShowPasswordModal(true); setShowUserMenu(false); }}>
                  <i className="fas fa-key"></i>
                  Change Password
                </div>
                <div className="user-dropdown-item" onClick={() => { setShowSecurityModal(true); setShowUserMenu(false); }}>
                  <i className="fas fa-shield-alt"></i>
                  Security Settings
                </div>
                <div className="user-dropdown-divider"></div>
                <div
                  className="user-dropdown-item"
                  onClick={() => {
                    const callbackUrl =
                      typeof window !== 'undefined'
                        ? new URL('/login', window.location.origin).toString()
                        : '/login'
                    signOut({ callbackUrl })
                  }}
                >
                  <i className="fas fa-sign-out-alt"></i>
                  Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button 
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-chart-pie" style={{ marginRight: 6 }}></i>
          Overview
        </button>
        <button 
          className={`tab-item ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          <i className="fas fa-brain" style={{ marginRight: 6 }}></i>
          AI Insights
        </button>
        <button 
          className={`tab-item ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          <i className="fas fa-chart-line" style={{ marginRight: 6 }}></i>
          Trends
        </button>
        <button 
          className={`tab-item ${activeTab === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          <i className="fas fa-clipboard-check" style={{ marginRight: 6 }}></i>
          QA Report
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {canImport && (
            <div className="card" id="pdf-import-quick" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title"><i className="fas fa-file-import"></i> Monthly FS Upload</div>
                <div className="card-tag">{selectedMonthLabel}</div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={importing}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).slice(0, 1)
                      setImportFiles(files)
                      setImportError(null)
                      setImportResult(null)
                    }}
                  />
                  <button className="btn btn-primary" style={{ width: 'auto' }} disabled={importing || !importFiles.length} onClick={handleImport}>
                    {importing ? (
                      <>
                        <span className="spinner" style={{ width: 16, height: 16 }}></span>
                        Importing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload"></i>
                        Import FS PDF
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ width: 'auto' }}
                    disabled={importing}
                    onClick={() => {
                      setImportFiles([])
                      setImportError(null)
                      setImportResult(null)
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                  Upload the <strong>Financial Statements (FS) PDF</strong>. All dashboard numbers are derived only from this document.
                </div>

                {importError && (
                  <div className="error-message" style={{ marginTop: 12 }}>
                    <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }}></i>
                    {importError}
                  </div>
                )}

                {importError && importDetected && importDetected.length > 0 && (
                  <div style={{ marginTop: 10, background: 'var(--bg)', padding: 10, borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Detected file types:</div>
                    {importDetected.map((d, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>{d.fileName}</span>
                        <span style={{ color: d.kind === 'unknown' ? 'var(--danger)' : 'var(--text-muted)' }}>{d.kind}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                      Detection is based on PDF contents. If needed, add &quot;financial statements&quot; or &quot;FS&quot; to the file name.
                    </div>
                  </div>
                )}

                {importResult?.warnings?.length ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      <i className="fas fa-triangle-exclamation" style={{ marginRight: 8, color: 'var(--warning)' }}></i>
                      Import Warnings
                    </div>
                    <ul className="notes" style={{ margin: 0 }}>
                      {importResult.warnings.map((w: string, idx: number) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {!monthData && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title"><i className="fas fa-circle-info"></i> No FS data for this month</div>
                <div className="card-tag">{selectedMonthLabel}</div>
              </div>
              <div className="card-body" style={{ color: 'var(--text-muted)' }}>
                Upload the monthly Financial Statements (FS) PDF in the <strong>QA Report</strong> tab to populate the dashboard. We do not seed or invent numbers.
              </div>
            </div>
          )}

          {/* Key Metrics Row */}
          <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="card">
              <div className="card-title"><i className="fas fa-calculator"></i> NOI</div>
              <div className="metric-main" style={{ color: typeof monthData?.noi?.actual === 'number' && monthData.noi.actual < 0 ? '#ef4444' : undefined }}>
                {formatCurrency(monthData?.noi?.actual)}
              </div>
              <div className="metric-sub">
                Budget {formatCurrency(monthData?.noi?.budget)}
                {(() => {
                  const mom = formatMoM(momNOI)
                  return mom ? (
                    <span className={`status-pill ${mom.colorClass}`} style={{ marginLeft: 8, fontSize: 10 }}>
                      {mom.arrow} {mom.pct}% MoM
                    </span>
                  ) : null
                })()}
              </div>
            </div>

            <div className="card">
              <div className="card-title"><i className="fas fa-coins"></i> Net Income</div>
              <div className="metric-main" style={{ color: typeof monthData?.netIncome?.actual === 'number' && monthData.netIncome.actual < 0 ? '#ef4444' : undefined }}>
                {formatCurrency(monthData?.netIncome?.actual)}
              </div>
              <div className="metric-sub">
                Budget {formatCurrency(monthData?.netIncome?.budget)}
                {(() => {
                  const mom = formatMoM(momNetIncome)
                  return mom ? (
                    <span className={`status-pill ${mom.colorClass}`} style={{ marginLeft: 8, fontSize: 10 }}>
                      {mom.arrow} {mom.pct}% MoM
                    </span>
                  ) : null
                })()}
              </div>
            </div>

            <div className="card">
              <div className="card-title"><i className="fas fa-wallet"></i> Cash Position</div>
              <div className="metric-main">{formatCurrency(monthData?.cash?.total)}</div>
              <div className="metric-sub">
                Operating {formatCurrency(monthData?.cash?.operating)}
                {(() => {
                  const mom = formatMoM(momCash)
                  return mom ? (
                    <span className={`status-pill ${mom.colorClass}`} style={{ marginLeft: 8, fontSize: 10 }}>
                      {mom.arrow} {mom.pct}% MoM
                    </span>
                  ) : null
                })()}
              </div>
            </div>

            <div className="card">
              <div className="card-title"><i className="fas fa-file-invoice-dollar"></i> A/R Total</div>
              <div className="metric-main">{formatCurrency(receivables?.total)}</div>
              <div className="metric-sub">
                60+ Days {formatCurrency((receivables?.over60 ?? 0) + (receivables?.over90 ?? 0))}
                {(() => {
                  const mom = formatMoM(momAR, true)
                  return mom ? (
                    <span className={`status-pill ${mom.colorClass}`} style={{ marginLeft: 8, fontSize: 10 }}>
                      {mom.arrow} {mom.pct}% MoM
                    </span>
                  ) : null
                })()}
              </div>
            </div>
          </div>

          {(typeof incomeStatement?.totalIncome === 'number' ||
            typeof incomeStatement?.totalExpenses === 'number' ||
            budgetLineItems.length > 0) && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title"><i className="fas fa-receipt"></i> Income Statement</div>
                <div className="card-tag">From PDFs</div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
                  <button
                    className={`btn ${incomeView === 'mtd' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: 'auto' }}
                    onClick={() => setIncomeView('mtd')}
                  >
                    MTD
                  </button>
                  <button
                    className={`btn ${incomeView === 'ytd' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: 'auto' }}
                    onClick={() => setIncomeView('ytd')}
                    title="Uses YTD values when available in the FS PDF"
                  >
                    YTD
                  </button>
                </div>
                {incomeView === 'ytd' && !hasYtdData && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                    YTD values were not detected in the FS PDF. Showing MTD values instead.
                  </div>
                )}

                {/* FS Summary Table - Key Metrics from Financial Statements */}
                <div style={{ 
                  background: 'var(--bg-card)', 
                  borderRadius: 10, 
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  marginBottom: 16
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>Description</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>Actual</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>Budget</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Total Revenue */}
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          <i className="fas fa-arrow-trend-up" style={{ marginRight: 8, color: '#22c55e' }}></i>
                          Total Revenue
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500 }}>
                          {formatCurrency(incomeStatement?.totalRevenue?.actual ?? incomeStatement?.totalIncome)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {formatCurrency(incomeStatement?.totalRevenue?.budget)}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          color: typeof incomeStatement?.totalRevenue?.variance === 'number' 
                            ? (incomeStatement.totalRevenue.variance >= 0 ? '#22c55e' : '#ef4444')
                            : 'var(--text-muted)'
                        }}>
                          {formatCurrency(incomeStatement?.totalRevenue?.variance)}
                        </td>
                      </tr>

                      {/* Total Operating Expenses */}
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          <i className="fas fa-arrow-trend-down" style={{ marginRight: 8, color: '#ef4444' }}></i>
                          Total Operating Expenses
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500 }}>
                          {formatCurrency(incomeStatement?.totalOperatingExpenses?.actual ?? incomeStatement?.totalExpenses)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {formatCurrency(incomeStatement?.totalOperatingExpenses?.budget)}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          // For expenses: negative variance (under budget) is good = green
                          color: typeof incomeStatement?.totalOperatingExpenses?.variance === 'number' 
                            ? (incomeStatement.totalOperatingExpenses.variance <= 0 ? '#22c55e' : '#ef4444')
                            : 'var(--text-muted)'
                        }}>
                          {formatCurrency(incomeStatement?.totalOperatingExpenses?.variance)}
                        </td>
                      </tr>

                      {/* NOI */}
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(37, 99, 235, 0.04)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                          <i className="fas fa-calculator" style={{ marginRight: 8, color: 'var(--accent)' }}></i>
                          Net Operating Income (NOI)
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px', 
                          fontWeight: 600,
                          color: typeof monthData?.noi?.actual === 'number' && monthData.noi.actual < 0 ? '#ef4444' : undefined
                        }}>
                          {formatCurrency(monthData?.noi?.actual)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {formatCurrency(monthData?.noi?.budget)}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          fontWeight: 500,
                          color: typeof monthData?.noi?.variance === 'number' 
                            ? (monthData.noi.variance >= 0 ? '#22c55e' : '#ef4444')
                            : 'var(--text-muted)'
                        }}>
                          {formatCurrency(monthData?.noi?.variance)}
                        </td>
                      </tr>

                      {/* Net Income */}
                      <tr style={{ background: 'rgba(124, 58, 237, 0.06)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                          <i className="fas fa-coins" style={{ marginRight: 8, color: '#a855f7' }}></i>
                          Net Income
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px', 
                          fontWeight: 600,
                          color: typeof monthData?.netIncome?.actual === 'number' && monthData.netIncome.actual < 0 ? '#ef4444' : undefined
                        }}>
                          {formatCurrency(monthData?.netIncome?.actual)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {formatCurrency(monthData?.netIncome?.budget)}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          fontWeight: 500,
                          color: typeof monthData?.netIncome?.variance === 'number' 
                            ? (monthData.netIncome.variance >= 0 ? '#22c55e' : '#ef4444')
                            : 'var(--text-muted)'
                        }}>
                          {formatCurrency(monthData?.netIncome?.variance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Collapsible Line Item Breakdowns */}
                {revenueItems.length > 0 && (
                  <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedSections(s => ({ ...s, revenue: !s.revenue }))}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'rgba(34, 197, 94, 0.08)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    >
                      <span>
                        <i className="fas fa-arrow-trend-up" style={{ marginRight: 8, color: '#22c55e' }}></i>
                        Revenue Breakdown ({revenueItems.length} items)
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>
                          {formatCurrency(sumRevenue)}
                        </span>
                        <i className={`fas fa-chevron-${expandedSections.revenue ? 'up' : 'down'}`} style={{ color: 'var(--text-muted)' }}></i>
                      </span>
                    </button>
                    {expandedSections.revenue && (
                      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(34, 197, 94, 0.04)' }}>
                              <th 
                                onClick={() => setRevenueSort(s => ({ col: 'label', dir: s.col === 'label' && s.dir === 'asc' ? 'desc' : 'asc' }))}
                                style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Item {revenueSort.col === 'label' && (revenueSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                onClick={() => setRevenueSort(s => ({ col: 'actual', dir: s.col === 'actual' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                                style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Actual {revenueSort.col === 'actual' && (revenueSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                onClick={() => setRevenueSort(s => ({ col: 'budget', dir: s.col === 'budget' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                                style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Budget {revenueSort.col === 'budget' && (revenueSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                onClick={() => setRevenueSort(s => ({ col: 'variance', dir: s.col === 'variance' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                                style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Variance {revenueSort.col === 'variance' && (revenueSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {revenueItems.map((item, idx) => (
                              <tr key={idx} style={{ 
                                borderBottom: '1px solid var(--border)',
                                background: item.label.includes('Unclassified') ? 'rgba(245, 158, 11, 0.08)' : undefined
                              }}>
                                <td style={{ 
                                  padding: '8px 16px', 
                                  fontSize: 13,
                                  fontStyle: item.label.includes('Unclassified') ? 'italic' : undefined,
                                  color: item.label.includes('Unclassified') ? 'var(--text-muted)' : undefined
                                }}>{item.label}</td>
                                <td style={{ textAlign: 'right', padding: '8px 16px', fontSize: 13 }}>{formatCurrency(item.viewActual)}</td>
                                <td style={{ textAlign: 'right', padding: '8px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{formatCurrency(item.viewBudget)}</td>
                                <td style={{ 
                                  textAlign: 'right', 
                                  padding: '8px 16px', 
                                  fontSize: 13,
                                  color: item.viewDelta >= 0 ? '#22c55e' : '#ef4444'
                                }}>{formatCurrency(item.viewDelta)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'rgba(34, 197, 94, 0.12)', fontWeight: 600 }}>
                              <td style={{ padding: '10px 16px', fontSize: 13 }}>Total Revenue</td>
                              <td style={{ textAlign: 'right', padding: '10px 16px', fontSize: 13 }}>{formatCurrency(sumRevenue)}</td>
                              <td style={{ textAlign: 'right', padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{formatCurrency(revenueItems.reduce((acc, x) => acc + (x.viewBudget || 0), 0))}</td>
                              <td style={{ textAlign: 'right', padding: '10px 16px', fontSize: 13 }}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {expenseItems.length > 0 && (
                  <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedSections(s => ({ ...s, expenses: !s.expenses }))}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    >
                      <span>
                        <i className="fas fa-arrow-trend-down" style={{ marginRight: 8, color: '#ef4444' }}></i>
                        Expense Breakdown ({expenseItems.length} items)
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>
                          {formatCurrency(sumExpenses)}
                        </span>
                        <i className={`fas fa-chevron-${expandedSections.expenses ? 'up' : 'down'}`} style={{ color: 'var(--text-muted)' }}></i>
                      </span>
                    </button>
                    {expandedSections.expenses && (
                      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(239, 68, 68, 0.04)' }}>
                              <th 
                                onClick={() => setExpenseSort(s => ({ col: 'label', dir: s.col === 'label' && s.dir === 'asc' ? 'desc' : 'asc' }))}
                                style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Item {expenseSort.col === 'label' && (expenseSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                onClick={() => setExpenseSort(s => ({ col: 'actual', dir: s.col === 'actual' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                                style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Actual {expenseSort.col === 'actual' && (expenseSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                onClick={() => setExpenseSort(s => ({ col: 'budget', dir: s.col === 'budget' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                                style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Budget {expenseSort.col === 'budget' && (expenseSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                onClick={() => setExpenseSort(s => ({ col: 'variance', dir: s.col === 'variance' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                                style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                              >
                                Variance {expenseSort.col === 'variance' && (expenseSort.dir === 'asc' ? '↑' : '↓')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {expenseItems.map((item, idx) => (
                              <tr key={idx} style={{ 
                                borderBottom: '1px solid var(--border)',
                                background: item.label.includes('Unclassified') ? 'rgba(245, 158, 11, 0.08)' : undefined
                              }}>
                                <td style={{ 
                                  padding: '8px 16px', 
                                  fontSize: 13,
                                  fontStyle: item.label.includes('Unclassified') ? 'italic' : undefined,
                                  color: item.label.includes('Unclassified') ? 'var(--text-muted)' : undefined
                                }}>{item.label}</td>
                                <td style={{ textAlign: 'right', padding: '8px 16px', fontSize: 13 }}>{formatCurrency(item.viewActual)}</td>
                                <td style={{ textAlign: 'right', padding: '8px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{formatCurrency(item.viewBudget)}</td>
                                <td style={{ 
                                  textAlign: 'right', 
                                  padding: '8px 16px', 
                                  fontSize: 13,
                                  color: item.viewDelta <= 0 ? '#22c55e' : '#ef4444'
                                }}>{formatCurrency(item.viewDelta)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'rgba(239, 68, 68, 0.12)', fontWeight: 600 }}>
                              <td style={{ padding: '10px 16px', fontSize: 13 }}>Total Expenses</td>
                              <td style={{ textAlign: 'right', padding: '10px 16px', fontSize: 13 }}>{formatCurrency(sumExpenses)}</td>
                              <td style={{ textAlign: 'right', padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{formatCurrency(expenseItems.reduce((acc, x) => acc + (x.viewBudget || 0), 0))}</td>
                              <td style={{ textAlign: 'right', padding: '10px 16px', fontSize: 13 }}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}


              </div>
            </div>
          )}

          {/* Receivables aging (if present) */}
          {receivables?.total ? (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title"><i className="fas fa-file-invoice-dollar"></i> Receivables Aging</div>
                <div className="card-tag">From PDFs</div>
              </div>
              <div className="card-body">
                <div className="progress-container">
                  <div className="progress-label">
                    <span>Current (0–30)</span>
                    <span>{formatCurrency(receivables.current)}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill success"
                      style={{ width: `${Math.min(100, ((receivables.current || 0) / receivables.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="progress-container">
                  <div className="progress-label">
                    <span>31–60</span>
                    <span>{formatCurrency(receivables.over30)}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill warning"
                      style={{ width: `${Math.min(100, ((receivables.over30 || 0) / receivables.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="progress-container">
                  <div className="progress-label">
                    <span>61–90</span>
                    <span>{formatCurrency(receivables.over60)}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill danger"
                      style={{ width: `${Math.min(100, ((receivables.over60 || 0) / receivables.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="progress-container">
                  <div className="progress-label">
                    <span>90+</span>
                    <span>{formatCurrency(receivables.over90)}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill danger"
                      style={{ width: `${Math.min(100, ((receivables.over90 || 0) / receivables.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Bank Reconciliation Detail */}
          {bankReconciliation ? (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title"><i className="fas fa-building-columns"></i> Bank Reconciliation</div>
                <div className="card-tag">From PDFs</div>
              </div>
              <div className="card-body">
                <div className="layout-2col" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="stat-row">
                    <span className="stat-label">Balance per statement</span>
                    <span className="stat-value">{formatCurrency(bankReconciliation.balancePerBankStatement)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Adjusted bank balance</span>
                    <span className="stat-value">{formatCurrency(bankReconciliation.adjustedBankBalance)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Deposits in transit</span>
                    <span className="stat-value">{formatCurrency(bankReconciliation.depositsInTransit)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Outstanding checks</span>
                    <span className="stat-value">{formatCurrency(bankReconciliation.outstandingChecks)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Reconciling items net</span>
                    <span className={`stat-value ${bankReconciliation.reconcilingItemsNet && bankReconciliation.reconcilingItemsNet < 0 ? 'negative' : 'positive'}`}>
                      {formatCurrency(bankReconciliation.reconcilingItemsNet)}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">As of</span>
                    <span className="stat-value">{bankReconciliation.asOfDate || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Cash breakdown (only if we have enough data to compute segments) */}
          {cashBreakdown && typeof totalCash === 'number' && totalCash > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title"><i className="fas fa-layer-group"></i> Cash Breakdown</div>
                <div className="card-tag">From PDFs</div>
              </div>
              <div className="card-body">
                <div className="cash-breakdown">
                  {typeof cashBreakdown.operating === 'number' && (
                    <div className="cash-segment" style={{ flex: (cashBreakdown.operating / totalCash) * 100, background: '#2563eb' }}>
                      {Math.round((cashBreakdown.operating / totalCash) * 100)}%
                    </div>
                  )}
                  {typeof cashBreakdown.reserve === 'number' && (
                    <div className="cash-segment" style={{ flex: (cashBreakdown.reserve / totalCash) * 100, background: '#059669' }}>
                      {Math.round((cashBreakdown.reserve / totalCash) * 100)}%
                    </div>
                  )}
                  {typeof cashBreakdown.capital === 'number' && (
                    <div className="cash-segment" style={{ flex: (cashBreakdown.capital / totalCash) * 100, background: '#7c3aed' }}>
                      {Math.round((cashBreakdown.capital / totalCash) * 100)}%
                    </div>
                  )}
                  {typeof cashBreakdown.security === 'number' && (
                    <div className="cash-segment" style={{ flex: (cashBreakdown.security / totalCash) * 100, background: '#d97706' }}>
                      {Math.round((cashBreakdown.security / totalCash) * 100)}%
                    </div>
                  )}
                </div>
                <div className="cash-legend">
                  <div className="cash-legend-item"><span className="cash-legend-dot" style={{ background: '#2563eb' }}></span>Operating {formatCurrency(cashBreakdown.operating)}</div>
                  <div className="cash-legend-item"><span className="cash-legend-dot" style={{ background: '#059669' }}></span>Reserve {formatCurrency(cashBreakdown.reserve)}</div>
                  <div className="cash-legend-item"><span className="cash-legend-dot" style={{ background: '#7c3aed' }}></span>Capital {formatCurrency(cashBreakdown.capital)}</div>
                  <div className="cash-legend-item"><span className="cash-legend-dot" style={{ background: '#d97706' }}></span>Escrow/Security {formatCurrency(cashBreakdown.security)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Expense breakdown */}
          {expenseChartItems.length > 0 && expenseTotalForPercent !== 0 && (
            <div className="card expense-breakdown-card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title"><i className="fas fa-chart-pie"></i> Expense Breakdown</div>
                <div className="card-tag">{lineItemScopeLabel}</div>
              </div>
              <div className="card-body">
                <div className="expense-insights">
                  <div className="expense-insight">
                    <div className="expense-insight-label">Total expenses</div>
                    <div className="expense-insight-value">{formatCurrencyFull(expenseTotalActual)}</div>
                    <div className="expense-insight-sub">
                      {expenseBudgetTotal !== null
                        ? `Budget ${formatCurrencyFull(expenseBudgetTotal)} • Var ${formatSignedCurrency(expenseVarianceTotal)} (${expenseVariancePct === null ? '—' : formatSignedPercent(expenseVariancePct)})`
                        : 'Budget not available'}
                    </div>
                  </div>
                  <div className="expense-insight">
                    <div className="expense-insight-label">Largest driver</div>
                    <div className="expense-insight-value">{topExpenseDriver?.label ?? '—'}</div>
                    <div className="expense-insight-sub">
                      {topExpenseDriver
                        ? `${formatCurrencyFull(topExpenseDriver.viewActual)} • ${topExpenseDriver.percent ? `${topExpenseDriver.percent.toFixed(1)}%` : '—'}`
                        : '—'}
                    </div>
                  </div>
                  <div className="expense-insight">
                    <div className="expense-insight-label">Largest variance</div>
                    <div className="expense-insight-value">{largestExpenseVariance?.label ?? '—'}</div>
                    <div className="expense-insight-sub">
                      {largestExpenseVariance
                        ? `${formatSignedCurrency(largestExpenseVariance.viewDelta)} vs budget`
                        : '—'}
                    </div>
                  </div>
                  <div className="expense-insight">
                    <div className="expense-insight-label">{momHighlightLabel}</div>
                    <div className="expense-insight-value">{momHighlight?.label ?? '—'}</div>
                    <div className="expense-insight-sub">
                      {momHighlight
                        ? `${formatSignedCurrency(momHighlight.momDelta)} • ${momHighlight.mom === null ? '—' : formatSignedPercent(momHighlight.mom)}`
                        : '—'}
                    </div>
                  </div>
                </div>

                <div className="expense-pie-layout">
                  <div className="expense-pie-chart">
                    <Pie
                      data={{
                        labels: expenseChartItems.map((item) => item.label),
                        datasets: [
                          {
                            data: expenseChartItems.map((item) => item.viewActual),
                            backgroundColor: expenseChartItems.map((_, idx) => expensePalette[idx % expensePalette.length]),
                            borderWidth: 0,
                            hoverOffset: 6,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const item = expenseChartItems[context.dataIndex]
                                if (!item) return ''
                                const percentText =
                                  typeof item.percent === 'number' ? `${Math.abs(item.percent).toFixed(1)}% of total` : 'Percent: —'
                                const budgetText =
                                  typeof item.viewBudget === 'number'
                                    ? `Budget: ${formatCurrencyFull(item.viewBudget)}`
                                    : 'Budget: —'
                                const varianceText =
                                  typeof item.viewDelta === 'number' ? `Variance: ${formatSignedCurrency(item.viewDelta)}` : 'Variance: —'
                                const momText =
                                  typeof item.mom === 'number'
                                    ? `MoM: ${formatSignedPercent(item.mom)}`
                                    : 'MoM: —'
                                return [
                                  `${item.label}: ${formatCurrencyFull(item.viewActual)}`,
                                  percentText,
                                  budgetText,
                                  varianceText,
                                  momText,
                                ]
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="expense-pie-legend">
                    {expenseChartItems.map((item, idx) => (
                      <div key={`${item.label}-${idx}`} className="expense-pie-legend-row">
                        <span className="expense-pie-dot" style={{ background: expensePalette[idx % expensePalette.length] }}></span>
                        <div>
                          <div className="expense-pie-label">{item.label}</div>
                          <div className="expense-pie-meta">
                            <span>{formatCurrencyFull(item.viewActual)}</span>
                            <span>•</span>
                            <span>{typeof item.percent === 'number' ? `${Math.abs(item.percent).toFixed(1)}%` : '—'}</span>
                            <span>•</span>
                            <span>MoM {typeof item.mom === 'number' ? formatSignedPercent(item.mom) : '—'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="expense-breakdown-summary">
                  <div>
                    <div className="expense-breakdown-label">Total operating expenses ({lineItemScopeLabel})</div>
                    <div className="expense-breakdown-total">{formatCurrencyFull(expenseTotalForPercent)}</div>
                  </div>
                  <div className="expense-breakdown-note">
                    Coverage: 100% of expense line items
                    {topExpenseDriver && typeof topExpenseDriver.percent === 'number'
                      ? ` • Top driver: ${topExpenseDriver.label} (${Math.abs(topExpenseDriver.percent).toFixed(1)}%)`
                      : ''}
                    {excludedExpenseItems.length > 0
                      ? ` • Excluded ${excludedExpenseItems.length} credit/zero item${excludedExpenseItems.length === 1 ? '' : 's'} from the pie`
                      : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid" style={{ gridTemplateColumns: '1fr', marginBottom: 20 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-chart-line"></i>
                  NOI Trend
                </div>
                <div className="card-tag">Last 6 Months</div>
              </div>
              <div className="card-body" style={{ height: 280 }}>
                <Line 
                  data={noiChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                      y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } }
                    }
                  }}
                />
              </div>
            </div>
          </div>
          {/* Notes / Sources */}
          {monthData && (
            <div className="layout-2col">
              <div className="card">
                <div className="card-header">
                  <div className="card-title"><i className="fas fa-file-lines"></i> Notes</div>
                  <div className="card-tag">From imports</div>
                </div>
                <div className="card-body">
                  <ul className="notes">
                    {(monthData.notes || []).map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title"><i className="fas fa-paperclip"></i> Source FS PDF</div>
                  <div className="card-tag">
                    {(() => {
                      const count = monthData.sources.length
                      return `${count} file${count === 1 ? '' : 's'}`
                    })()}
                  </div>
                </div>
                <div className="card-body">
                  {(monthData.sources || []).map((s, idx) => (
                    <div className="stat-row" key={idx}>
                      <span className="stat-label">{s.fileName}</span>
                      <span className="stat-value" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.kind}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'insights' && (
        <div className="layout-2col" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card ai-panel">
            <div className="ai-header">
              <div className="ai-icon">
                <i className="fas fa-robot"></i>
              </div>
              <div>
                <div className="ai-title">AI Financial Analysis</div>
                <div className="ai-subtitle">Powered by machine learning • {displayMonth}{displayYear ? ` ${displayYear}` : ''}</div>
              </div>
            </div>

            {loadingInsights ? (
              <div className="ai-loading">
                <div className="spinner"></div>
                Analyzing financial data...
              </div>
            ) : (
              <>
                <div style={{ 
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 20
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>
                    <i className="fas fa-lightbulb" style={{ marginRight: 8 }}></i>
                    Executive Summary
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-main)', fontSize: 14 }}>
                    {aiSummary}
                  </p>
                </div>

                {monthData && insights.length > 0 && (
                  <h4 style={{ marginBottom: 16, color: 'var(--text-main)' }}>
                    <i className="fas fa-list-check" style={{ marginRight: 8, color: 'var(--accent)' }}></i>
                    Key Insights ({insights.length})
                  </h4>
                )}

                {!monthData && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Import the FS PDF for this month to generate insights.
                  </div>
                )}

                {insights.map((insight) => (
                  <div key={insight.id} className="ai-insight" style={{
                    borderLeftColor: 
                      insight.type === 'positive' ? 'var(--success)' :
                      insight.type === 'negative' ? 'var(--danger)' :
                      insight.type === 'warning' ? 'var(--warning)' : 'var(--accent)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div className="ai-insight-title">
                        <i className={`fas fa-${
                          insight.type === 'positive' ? 'check-circle' :
                          insight.type === 'negative' ? 'exclamation-circle' :
                          insight.type === 'warning' ? 'exclamation-triangle' : 'info-circle'
                        }`} style={{ 
                          marginRight: 8,
                          color: 
                            insight.type === 'positive' ? 'var(--success)' :
                            insight.type === 'negative' ? 'var(--danger)' :
                            insight.type === 'warning' ? 'var(--warning)' : 'var(--accent)'
                        }}></i>
                        {insight.title}
                      </div>
                      {insight.metric && (
                        <span style={{
                          background: 'var(--bg)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          color: 
                            insight.type === 'positive' ? 'var(--success)' :
                            insight.type === 'negative' ? 'var(--danger)' : 'var(--text-main)'
                        }}>
                          {insight.metric}
                        </span>
                      )}
                    </div>
                    <div className="ai-insight-text">{insight.description}</div>
                    {insight.recommendation && (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        background: 'var(--accent-soft)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: 'var(--accent)'
                      }}>
                        <strong>Recommendation:</strong> {insight.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="card ai-chat-panel">
            <div className="ai-chat-header">
              <div>
                <div className="ai-chat-title">AI Q&A Assistant</div>
                <div className="ai-chat-subtitle">Ask questions about the selected month and recent trends.</div>
              </div>
              <button type="button" className="ai-chat-clear" onClick={resetChat}>
                Clear
              </button>
            </div>

            <div className="ai-chat-context">
              <span><i className="fas fa-calendar"></i> {selectedMonthLabel}</span>
              <span><i className="fas fa-database"></i> {monthData ? 'PDF data loaded' : 'No PDF data loaded'}</span>
              <span>
                <i className="fas fa-layer-group"></i>{' '}
                {monthData?.sources?.length ?? 0} source file{(monthData?.sources?.length ?? 0) === 1 ? '' : 's'}
              </span>
            </div>

            <div className="ai-chat-messages">
              {chatMessages.map((message) => (
                <div key={message.id} className={`ai-chat-message ${message.role}`}>
                  <div className="ai-chat-bubble">{message.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="ai-chat-message assistant">
                  <div className="ai-chat-bubble ai-chat-typing">
                    <span className="ai-chat-dot"></span>
                    <span className="ai-chat-dot"></span>
                    <span className="ai-chat-dot"></span>
                    <span>Analyzing...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="ai-chat-suggestions">
              {chatSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="ai-chat-chip"
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={chatLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form
              className="ai-chat-input"
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
            >
              <input
                className="ai-chat-input-field"
                type="text"
                placeholder="Ask a question about NOI, cash, receivables, expenses, or trends..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
                aria-label="Ask a question about the financial data"
              />
              <button
                type="submit"
                className="btn btn-primary btn-inline btn-sm"
                disabled={chatLoading || !chatInput.trim()}
              >
                <i className="fas fa-paper-plane"></i>
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <i className="fas fa-chart-area"></i>
                6-Month NOI Performance
              </div>
            </div>
            <div className="card-body" style={{ height: 350 }}>
              <Line 
                data={noiChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top' } },
                  scales: {
                    y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } }
                  }
                }}
              />
            </div>
          </div>

          {(hasCashTrend || hasReceivablesTrend) && (
            <div className="layout-2col">
              {hasCashTrend && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title"><i className="fas fa-wallet"></i> Cash Trend</div>
                    <div className="card-tag">Total Cash</div>
                  </div>
                  <div className="card-body" style={{ height: 280 }}>
                    <Line
                      data={cashTrendChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                          y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } },
                        },
                      }}
                    />
                  </div>
                </div>
              )}

              {hasReceivablesTrend && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title"><i className="fas fa-file-invoice-dollar"></i> Receivables Trend</div>
                    <div className="card-tag">A/R Total</div>
                  </div>
                  <div className="card-body" style={{ height: 280 }}>
                    <Line
                      data={receivablesTrendChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                          y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } },
                        },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {hasBankTrend && (
            <div className="card">
              <div className="card-header">
                <div className="card-title"><i className="fas fa-building-columns"></i> Bank Balance Trend</div>
                <div className="card-tag">Balance per Statement</div>
              </div>
              <div className="card-body" style={{ height: 280 }}>
                <Line
                  data={bankBalanceTrendChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                      y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {!hasCashTrend && !hasReceivablesTrend && !hasBankTrend && (
            <div className="card">
              <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Additional trend lines appear when cash, receivables, or bank data is present in the FS PDF.
              </div>
            </div>
          )}

          <div className="layout-3col">
            {trendKeys
              .map((k, i) => ({ monthKey: k, label: monthKeyToPeriod(k).label, data: trendSeries[i] }))
	              .filter((p) => Boolean(p.data))
	              .slice(-3)
	              .map((p) => (
	              <div className="card" key={p.monthKey}>
	                <div className="card-header">
	                  <div className="card-title">{p.label}</div>
	                  <div
                      className={`card-tag ${
                        typeof p.data?.noi?.actual === 'number' ? (p.data.noi.actual >= 0 ? 'success' : 'danger') : ''
                      }`}
                    >
	                    {formatCurrency(p.data?.noi?.actual)}
	                  </div>
	                </div>
                <div className="stat-row">
                  <span className="stat-label">NOI</span>
                  <span className="stat-value">{formatCurrency(p.data?.noi?.actual)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Net Income</span>
                  <span className="stat-value">{formatCurrency(p.data?.netIncome?.actual)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Total Revenue</span>
                  <span className="stat-value">
                    {formatCurrency(p.data?.incomeStatement?.totalRevenue?.actual ?? p.data?.incomeStatement?.totalIncome)}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Total Expenses</span>
                  <span className="stat-value">
                    {formatCurrency(p.data?.incomeStatement?.totalOperatingExpenses?.actual ?? p.data?.incomeStatement?.totalExpenses)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QA Tab */}
      {activeTab === 'qa' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {canImport && (
            <div className="card" id="pdf-import-panel" style={{ gridColumn: 'span 2' }}>
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-file-import"></i>
                  Import FS PDF (stores data)
                </div>
                <div className="card-tag">{selectedMonthLabel}</div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={importing}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).slice(0, 1)
                      setImportFiles(files)
                      setImportError(null)
                      setImportResult(null)
                    }}
                  />
                  <button className="btn btn-primary" style={{ width: 'auto' }} disabled={importing || !importFiles.length} onClick={handleImport}>
                    {importing ? (
                      <>
                        <span className="spinner" style={{ width: 16, height: 16 }}></span>
                        Importing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload"></i>
                        Import FS PDF
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ width: 'auto' }}
                    disabled={importing}
                    onClick={() => {
                      setImportFiles([])
                      setImportError(null)
                      setImportResult(null)
                    }}
                  >
                    Clear
                  </button>

                </div>

                {importFiles.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                    Selected files: {importFiles.map((f) => f.name).join(', ')}
                  </div>
                )}

                {importError && (
                  <div className="error-message" style={{ marginTop: 12 }}>
                    <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }}></i>
                    {importError}
                  </div>
                )}

                {importError && importDetected && importDetected.length > 0 && (
                  <div style={{ marginTop: 10, background: 'var(--bg)', padding: 10, borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Detected file types:</div>
                    {importDetected.map((d, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>{d.fileName}</span>
                        <span style={{ color: d.kind === 'unknown' ? 'var(--danger)' : 'var(--text-muted)' }}>{d.kind}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                      Rename your file to include keywords like &quot;financial statements&quot; or &quot;FS&quot; for better detection.
                    </div>
                  </div>
                )}

                {importResult?.warnings?.length ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      <i className="fas fa-triangle-exclamation" style={{ marginRight: 8, color: 'var(--warning)' }}></i>
                      Import Warnings
                    </div>
                    <ul className="notes" style={{ margin: 0 }}>
                      {importResult.warnings.map((w: string, idx: number) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {importLog.length ? (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                      <i className="fas fa-clock-rotate-left" style={{ marginRight: 8, color: 'var(--text-muted)' }}></i>
                      Upload History (this month)
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {importLog.slice(0, 5).map((entry, idx) => (
                        <div key={idx} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {new Date(entry.importedAt).toLocaleString()}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {(() => {
                                const count = entry.sources?.length ?? 0
                                return `${count} file${count === 1 ? '' : 's'}`
                              })()}
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: 4 }}>
                            {(entry.sources || []).map((s, sIdx) => (
                              <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.fileName}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{s.kind}</span>
                              </div>
                            ))}
                          </div>
                          {entry.warnings?.length ? (
                            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--warning)' }}>
                              {entry.warnings.length} warning{entry.warnings.length === 1 ? '' : 's'}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {importResult?.extracted ? (
                  <div style={{ marginTop: 12, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                      <i className="fas fa-check-circle" style={{ marginRight: 8, color: 'var(--success)' }}></i>
                      Extracted (preview)
                    </div>
                    <div className="layout-3col" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                      <div className="card" style={{ margin: 0 }}>
                        <div className="card-header"><div className="card-title">P&L Totals</div></div>
                        <div className="card-body">
                          {importResult.extracted.incomeStatement ? (
                            <>
                              {typeof importResult.extracted.incomeStatement.totalIncome === 'number' && (
                                <div className="stat-row"><span className="stat-label">Total Income</span><span className="stat-value">{formatCurrency(importResult.extracted.incomeStatement.totalIncome)}</span></div>
                              )}
                              {typeof importResult.extracted.incomeStatement.totalExpenses === 'number' && (
                                <div className="stat-row"><span className="stat-label">Total Expenses</span><span className="stat-value">{formatCurrency(importResult.extracted.incomeStatement.totalExpenses)}</span></div>
                              )}
                              {typeof importResult.extracted.incomeStatement.totalIncome === 'number' &&
                                typeof importResult.extracted.incomeStatement.totalExpenses === 'number' && (
                                  <div className="stat-row"><span className="stat-label">Net</span><span className="stat-value">{formatCurrency(importResult.extracted.incomeStatement.totalIncome - importResult.extracted.incomeStatement.totalExpenses)}</span></div>
                                )}
                            </>
                          ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not found</div>
                          )}
                        </div>
                      </div>
                      <div className="card" style={{ margin: 0 }}>
	                      <div className="card-header"><div className="card-title">NOI</div></div>
	                      <div className="card-body">
	                        {importResult.extracted.noi ? (
	                          <>
	                            <div className="stat-row"><span className="stat-label">Actual</span><span className="stat-value">{formatCurrency(importResult.extracted.noi.actual)}</span></div>
	                            <div className="stat-row"><span className="stat-label">Budget</span><span className="stat-value">{formatCurrency(importResult.extracted.noi.budget)}</span></div>
	                          </>
	                        ) : (
	                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not found</div>
	                        )}
	                      </div>
	                    </div>
                      <div className="card" style={{ margin: 0 }}>
	                      <div className="card-header"><div className="card-title">Net Income</div></div>
	                      <div className="card-body">
	                        {importResult.extracted.netIncome ? (
	                          <>
	                            <div className="stat-row"><span className="stat-label">Actual</span><span className="stat-value">{formatCurrency(importResult.extracted.netIncome.actual)}</span></div>
	                            <div className="stat-row"><span className="stat-label">Budget</span><span className="stat-value">{formatCurrency(importResult.extracted.netIncome.budget)}</span></div>
	                          </>
	                        ) : (
	                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not found</div>
	                        )}
	                      </div>
	                    </div>
                    </div>

                    {importResult.extracted.cash && (
                      <div className="layout-3col" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
                        <div className="card" style={{ margin: 0 }}>
                          <div className="card-header"><div className="card-title">Cash</div></div>
                          <div className="card-body">
                            {typeof importResult.extracted.cash.total === 'number' && (
                              <div className="stat-row"><span className="stat-label">Total</span><span className="stat-value">{formatCurrency(importResult.extracted.cash.total)}</span></div>
                            )}
                            {typeof importResult.extracted.cash.operating === 'number' && (
                              <div className="stat-row"><span className="stat-label">Operating</span><span className="stat-value">{formatCurrency(importResult.extracted.cash.operating)}</span></div>
                            )}
                            {typeof importResult.extracted.cash.reserveFunds === 'number' && (
                              <div className="stat-row"><span className="stat-label">Reserve Funds</span><span className="stat-value">{formatCurrency(importResult.extracted.cash.reserveFunds)}</span></div>
                            )}
                            {typeof importResult.extracted.cash.escrow === 'number' && (
                              <div className="stat-row"><span className="stat-label">Escrow</span><span className="stat-value">{formatCurrency(importResult.extracted.cash.escrow)}</span></div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="layout-3col" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
                      {importResult.extracted.receivables && (
                        <div className="card" style={{ margin: 0 }}>
                          <div className="card-header"><div className="card-title">A/R Totals</div></div>
                          <div className="card-body">
                            {typeof importResult.extracted.receivables.total === 'number' && (
                              <div className="stat-row"><span className="stat-label">Total</span><span className="stat-value">{formatCurrency(importResult.extracted.receivables.total)}</span></div>
                            )}
                            {typeof importResult.extracted.receivables.current === 'number' && (
                              <div className="stat-row"><span className="stat-label">Current</span><span className="stat-value">{formatCurrency(importResult.extracted.receivables.current)}</span></div>
                            )}
                            {typeof importResult.extracted.receivables.over30 === 'number' && (
                              <div className="stat-row"><span className="stat-label">Over 30</span><span className="stat-value">{formatCurrency(importResult.extracted.receivables.over30)}</span></div>
                            )}
                            {typeof importResult.extracted.receivables.over60 === 'number' && (
                              <div className="stat-row"><span className="stat-label">Over 60</span><span className="stat-value">{formatCurrency(importResult.extracted.receivables.over60)}</span></div>
                            )}
                            {typeof importResult.extracted.receivables.over90 === 'number' && (
                              <div className="stat-row"><span className="stat-label">Over 90</span><span className="stat-value">{formatCurrency(importResult.extracted.receivables.over90)}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                      {importResult.extracted.bankReconciliation && (
                        <div className="card" style={{ margin: 0 }}>
                          <div className="card-header"><div className="card-title">Bank</div></div>
                          <div className="card-body">
                            {typeof importResult.extracted.bankReconciliation.balancePerBankStatement === 'number' && (
                              <div className="stat-row"><span className="stat-label">Statement</span><span className="stat-value">{formatCurrency(importResult.extracted.bankReconciliation.balancePerBankStatement)}</span></div>
                            )}
                            {typeof importResult.extracted.bankReconciliation.adjustedBankBalance === 'number' && (
                              <div className="stat-row"><span className="stat-label">Adjusted</span><span className="stat-value">{formatCurrency(importResult.extracted.bankReconciliation.adjustedBankBalance)}</span></div>
                            )}
                            {typeof importResult.extracted.bankReconciliation.depositsInTransit === 'number' && (
                              <div className="stat-row"><span className="stat-label">Deposits in transit</span><span className="stat-value">{formatCurrency(importResult.extracted.bankReconciliation.depositsInTransit)}</span></div>
                            )}
                            {typeof importResult.extracted.bankReconciliation.outstandingChecks === 'number' && (
                              <div className="stat-row"><span className="stat-label">Outstanding checks</span><span className="stat-value">{formatCurrency(importResult.extracted.bankReconciliation.outstandingChecks)}</span></div>
                            )}
                            {typeof importResult.extracted.bankReconciliation.reconcilingItemsNet === 'number' && (
                              <div className="stat-row"><span className="stat-label">Recon Net</span><span className="stat-value">{formatCurrency(importResult.extracted.bankReconciliation.reconcilingItemsNet)}</span></div>
                            )}
                            <div className="stat-row"><span className="stat-label">As of</span><span className="stat-value">{importResult.extracted.bankReconciliation.asOfDate || '—'}</span></div>
                          </div>
                        </div>
                      )}
                      <div className="card" style={{ margin: 0 }}>
                        <div className="card-header"><div className="card-title">Month</div></div>
                        <div className="card-body">
                          <div className="stat-row"><span className="stat-label">Requested</span><span className="stat-value">{importResult.requestedMonthKey || selectedMonth}</span></div>
                          <div className="stat-row"><span className="stat-label">Detected</span><span className="stat-value">{importResult.detectedMonthKey || '—'}</span></div>
                          <div className="stat-row"><span className="stat-label">Imported to</span><span className="stat-value">{importResult.monthKey}</span></div>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                      The dashboard updates immediately after import. We only display values extracted from the uploaded FS PDF.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="card-title"><i className="fas fa-circle-check"></i> Current Month Status</div>
              <div className="card-tag">Stored</div>
            </div>
            <div className="card-body">
              <div className="stat-row">
                <span className="stat-label">Month</span>
                <span className="stat-value">{selectedMonthLabel}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Last Updated</span>
                <span className="stat-value">{monthData?.updatedAt ? new Date(monthData.updatedAt).toLocaleString() : '—'}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">FS PDF Recorded</span>
                <span className="stat-value">{monthData?.sources?.length ?? 0}</span>
              </div>

              <div className="stat-row">
                <span className="stat-label">Required PDF</span>
                <span className={`stat-value ${missingKinds.length ? 'negative' : 'positive'}`}>
                  {missingKinds.length ? 'Missing: Financial Statements (FS)' : 'FS uploaded'}
                </span>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Extraction completeness</div>
                <div className="stat-row"><span className="stat-label">Income/expenses totals</span><span className="stat-value">{monthData?.incomeStatement?.totalIncome != null || monthData?.incomeStatement?.totalExpenses != null || monthData?.incomeStatement?.totalRevenue != null || monthData?.incomeStatement?.totalOperatingExpenses != null ? 'Found' : '—'}</span></div>
                <div className="stat-row"><span className="stat-label">NOI</span><span className="stat-value">{monthData?.noi?.actual != null ? 'Found' : '—'}</span></div>
                <div className="stat-row"><span className="stat-label">Net income</span><span className="stat-value">{monthData?.netIncome?.actual != null ? 'Found' : '—'}</span></div>
                <div className="stat-row"><span className="stat-label">Line items</span><span className="stat-value">{monthData?.incomeStatement?.lineItems?.length ? 'Found' : '—'}</span></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><i className="fas fa-list"></i> Recorded FS PDF</div>
              <div className="card-tag">Sources</div>
            </div>
            <div className="card-body">
              {monthData?.sources?.length ? (
                monthData.sources.map((s, idx) => (
                  <div className="stat-row" key={idx}>
                    <span className="stat-label">{s.fileName}</span>
                    <span className="stat-value" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.kind}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No FS PDF stored for this month yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div>
          <i className="fas fa-lock" style={{ marginRight: 6 }}></i>
          Data secured with 256-bit encryption • Last sync: {new Date().toLocaleString()}
        </div>
        <div className="footer-links">
          <a onClick={() => setShowSecurityModal(true)}>Security</a>
          <a>Help</a>
          <a>Support</a>
        </div>
      </footer>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Change Password</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" placeholder="Enter current password" />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" placeholder="Enter new password" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" placeholder="Confirm new password" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                <i className="fas fa-info-circle" style={{ marginRight: 6 }}></i>
                Password must be at least 8 characters with uppercase, lowercase, and numbers
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ width: 'auto' }}>Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showSecurityModal && (
        <div className="modal-overlay" onClick={() => setShowSecurityModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Security Settings</h3>
              <button className="modal-close" onClick={() => setShowSecurityModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Two-Factor Authentication</h4>
                  <p>Add an extra layer of security to your account</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Session Timeout</h4>
                  <p>Automatically log out after 30 minutes of inactivity</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Login Notifications</h4>
                  <p>Get notified when someone logs into your account</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Data Export Approval</h4>
                  <p>Require approval before exporting sensitive data</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSecurityModal(false)}>Close</button>
              <button className="btn btn-primary" style={{ width: 'auto' }}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
