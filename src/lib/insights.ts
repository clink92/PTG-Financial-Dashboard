import type { MonthlyData } from './data'

export interface AIInsight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  metric?: string;
  recommendation?: string;
}

export function generateInsights(data: MonthlyData): AIInsight[] {
  const insights: AIInsight[] = []

  const noi = data.noi
  const cash = data.cash
  const recv = data.receivables
  const income = data.incomeStatement
  const bank = data.bankReconciliation
  const notesStructured = data.notesStructured ?? []

  // NOI Analysis (only if we have a budget comparison)
  if (typeof noi?.variance === 'number' && typeof noi?.budget === 'number') {
    if (noi.variance > 0) {
      insights.push({
        id: 'noi-positive',
        type: 'positive',
        title: 'Strong NOI Performance',
        description: `Net Operating Income exceeded budget by $${noi.variance.toLocaleString()}.`,
        metric: `+$${noi.variance.toLocaleString()}`,
        recommendation: 'Consider allocating excess funds to reserve accounts or planned capital items.'
      })
    } else if (noi.variance < 0) {
      insights.push({
        id: 'noi-negative',
        type: 'warning',
        title: 'NOI Below Budget',
        description: `Net Operating Income is $${Math.abs(noi.variance).toLocaleString()} below budget.`,
        metric: `-$${Math.abs(noi.variance).toLocaleString()}`,
        recommendation: 'Review the financial statements for the largest differences from budget and confirm timing items.'
      })
    }
  }

  // Expense ratio (if totals exist)
  if (typeof income?.totalIncome === 'number' && typeof income?.totalExpenses === 'number' && income.totalIncome !== 0) {
    const expenseRatio = income.totalExpenses / income.totalIncome
    insights.push({
      id: 'expense-ratio',
      type: expenseRatio > 0.95 ? 'warning' : 'neutral',
      title: 'Expense Ratio',
      description: `Total expenses are ${(expenseRatio * 100).toFixed(1)}% of total income.`,
      metric: `${(expenseRatio * 100).toFixed(1)}%`,
      recommendation: expenseRatio > 0.95 ? 'Review large operating expense categories and confirm any one-time items.' : undefined,
    })
  }

  // Cash Position (only if we have operating + total)
  if (typeof cash?.total === 'number') {
    insights.push({
      id: 'cash-position',
      type: 'neutral',
      title: 'Cash Position',
      description: `Total cash and cash equivalents are $${cash.total.toLocaleString()}.`,
      metric: `$${(cash.total / 1_000_000).toFixed(2)}M`,
    })
  }

  // Cash composition
  if (typeof cash?.total === 'number' && typeof cash?.operating === 'number' && cash.total > 0) {
    const operatingPct = cash.operating / cash.total
    insights.push({
      id: 'cash-composition',
      type: operatingPct < 0.25 ? 'warning' : 'neutral',
      title: 'Cash Composition',
      description: `Operating cash represents ${(operatingPct * 100).toFixed(0)}% of total cash.`,
      metric: `${(operatingPct * 100).toFixed(0)}%`,
      recommendation: operatingPct < 0.25 ? 'Confirm reserve restrictions and ensure operating liquidity is sufficient for upcoming payables.' : undefined,
    })
  }

  if (typeof recv?.total === 'number') {
    const over60plus = (recv.over60 ?? 0) + (recv.over90 ?? 0)
    const pctOver60 = recv.total > 0 ? over60plus / recv.total : 0
    insights.push({
      id: 'receivables-total',
      type: recv.total > 100_000 || pctOver60 > 0.2 ? 'warning' : 'neutral',
      title: 'Accounts Receivable (A/R)',
      description: `Total A/R is $${recv.total.toLocaleString()} based on the aging summary in the financial statements PDF.`,
      metric: `$${recv.total.toLocaleString()}`,
      recommendation: recv.total > 100_000 || pctOver60 > 0.2 ? 'Review accounts over 60/90 days and verify collections status.' : undefined,
    })

    if (recv.total > 0 && over60plus > 0) {
      insights.push({
        id: 'receivables-aging',
        type: pctOver60 > 0.2 ? 'warning' : 'neutral',
        title: 'Past-Due Concentration',
        description: `$${over60plus.toLocaleString()} of A/R is over 60 days past due (${(pctOver60 * 100).toFixed(0)}%).`,
        metric: `${(pctOver60 * 100).toFixed(0)}%`,
        recommendation: pctOver60 > 0.2 ? 'Prioritize follow-ups on the largest over-60 balances and confirm payment plans.' : undefined,
      })
    }
  }

  // Bank reconciliation signals
  if (typeof bank?.reconcilingItemsNet === 'number') {
    const magnitude = Math.abs(bank.reconcilingItemsNet)
    insights.push({
      id: 'bank-recon-items',
      type: magnitude > 50_000 ? 'warning' : 'neutral',
      title: 'Bank Reconciliation Items',
      description: `Reconciling items net to $${bank.reconcilingItemsNet.toLocaleString()}.`,
      metric: `$${bank.reconcilingItemsNet.toLocaleString()}`,
      recommendation: magnitude > 50_000 ? 'Review outstanding checks and deposits in transit to ensure timely clearing.' : undefined,
    })
  }

  if (notesStructured.length) {
    const notedSpend = notesStructured.reduce((sum, n) => sum + (typeof n.amount === 'number' ? n.amount : 0), 0)
    const unmapped = notesStructured.filter((n) => !n.mapping || n.mapping.targetKind === 'unmapped').length
    insights.push({
      id: 'notes-intelligence',
      type: unmapped > 0 ? 'warning' : 'neutral',
      title: 'Notes Intelligence Coverage',
      description: `${notesStructured.length} structured note entries captured with $${notedSpend.toLocaleString()} total noted spend.`,
      metric: `${notesStructured.length} notes`,
      recommendation: unmapped > 0 ? `${unmapped} notes remain unmapped to line items; review categories to improve variance explanations.` : undefined,
    })
  }

  if (!insights.length) {
    insights.push({
      id: 'insufficient-data',
      type: 'neutral',
      title: 'Insufficient Data for Insights',
      description: 'Upload the monthly Financial Statements (FS) PDF to generate AI insights grounded in the document.',
    })
  }

  return insights
}

// Mock AI analysis for when OpenAI is not configured
export function generateAISummary(data: MonthlyData): string {
  const label = data.month && data.year ? `${data.month} ${data.year}` : data.label
  const noiDelta = data.noi?.variance
  const cashTotal = data.cash?.total

  if (typeof noiDelta === 'number') {
    if (noiDelta > 0) {
      return (
        `${label} shows NOI above budget by $${noiDelta.toLocaleString()}.` +
        (typeof cashTotal === 'number' ? ` Total cash is $${cashTotal.toLocaleString()}.` : '')
      )
    }
    if (noiDelta < 0) {
      return (
        `${label} shows NOI below budget by $${Math.abs(noiDelta).toLocaleString()}.` +
        (typeof cashTotal === 'number' ? ` Total cash is $${cashTotal.toLocaleString()}.` : '')
      )
    }
    return (
      `${label} shows NOI on budget.` +
      (typeof cashTotal === 'number' ? ` Total cash is $${cashTotal.toLocaleString()}.` : '')
    )
  }

  if (typeof cashTotal === 'number') {
    return `${label} cash position: $${cashTotal.toLocaleString()} total cash and cash equivalents.`
  }

  return `${label} has no imported PDF data yet. Upload the monthly Financial Statements (FS) PDF to populate the dashboard.`
}
