import { extractMonthDataFromPdfTexts, type PdfTextInput } from '../src/lib/pdfImport'
import { getStoredMonthData, listStoredMonthKeys, setStoredMonthData } from '../src/lib/monthStore'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function pretty(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

async function main() {
  // Use a dedicated QA month key so this script never overwrites real imported months.
  const monthKey = 'nov-2099'

  // Synthetic FS text with realistic section headers + known noise patterns.
  const financialStatementsText = `
    MONTHLY MANAGEMENT REPORT

    INCOME
    MAINTENANCE INCOME 500,000 490,000 10,000
    LAUNDRY INCOME 12,500 10,000 2,500
    OTHER TENANT INCOME 2,500 5,000 (2,500)
    INTEREST INCOME - CAPITAL 24,000 20,000 4,000
    CORPORATE TAX REFUNDS 10,000 - 10,000
    TOTAL REVENUES 515,000 505,000 10,000

    OPERATING EXPENSES
    PAYROLL 120,000 115,000 5,000
    REPAIRS AND MAINTENANCE 12,000 10,000 2,000
    UTILITIES 8,500 9,000 (500)
    CAP IMP/LOBBY 50,000 45,000 5,000
    ESCROW DEPOSITS 20,000 20,000 -
    A/P OVER 30 DAYS 123,456 100,000 23,456
    METROPOLITAN / 45,000 40,000 5,000
    2104 B12 JOHN DOE 4,000 3,000 1,000

    DEBT SERVICE
    MORTGAGE PRINCIPAL 30,000 28,000 2,000
    CAPITAL RESERVE TRANSFER 10,000 10,000 -
    DEPRECIATION 15,000 15,000 -

    TOTAL OPERATING EXPENSES 140,500 134,000 6,500
    NET OPERATING INCOME 374,500 371,000 3,500
    NET INCOME 283,500 276,000 7,500

    TOTAL OPERATING ACCOUNTS 1,234,567$
    TOTAL ESCROW ACCOUNTS 234,567$
    TOTAL RESERVE FUNDS 345,678$
    TOTAL CASH AND CASH EQUIVALENTS 1,814,812$

    A/R CURRENT 20,835$
    A/R OVER 30 DAYS 12,396
    A/R OVER 60 DAYS 8,184
    A/R OVER 90 DAYS 33,532
    ------TOTAL------ 74,948$

    NOTES
    A FIRE PROTECTION
    PAYMENT TO AMERICAN FIRE RESTORATION IN 8/2025 OF $4,852 FOR RENDERING OF SERVICES.
    B FLOORING REPAIRS
    PAYMENT TO CMP CONTRACTING IN 07/2025 OF $849 FOR A-72 FLOOR REPAIRING.
  `

  const bankReconciliationText = `
    Bank Reconciliation
    Balance Per Bank Statement as of 11/30/2025 2,089,030.39
    Deposits in Transit 12,345.67
    Outstanding Checks (7,890.12)
    Adjusted Bank Balance 2,012,345.67
  `

  const cashSummaryText = `
    Cash Summary
    OPERATING ACCOUNTS
    ESCROW ACCOUNTS
    RESERVE

    TOTAL OPERATING ACCOUNTS 1,234,567$
    TOTAL ESCROW ACCOUNTS 234,567$
    TOTAL RESERVE FUNDS 345,678$
    TOTAL CASH AND CASH EQUIVALENTS 1,814,812$
  `

  const inputs: PdfTextInput[] = [
    { fileName: 'PTG November 2025 Financial Statements.pdf', text: financialStatementsText },
    { fileName: 'PTG November 2025 Bank Reconciliation.pdf', text: bankReconciliationText },
    { fileName: 'PTG November 2025 Cash Summary.pdf', text: cashSummaryText },
  ]

  const result = extractMonthDataFromPdfTexts(monthKey, inputs)

  // QA: ensure we detected the 3 kinds
  const kinds = new Set(result.extracted.sources.map((s) => s.kind))
  assert(kinds.has('financial-statements'), 'QA FAIL: did not detect financial-statements PDF')
  assert(kinds.has('bank-reconciliation'), 'QA FAIL: did not detect bank-reconciliation PDF')
  assert(kinds.has('cash-summary'), 'QA FAIL: did not detect cash-summary PDF')

  // QA: cash payment variant (common naming in the real monthly workflow)
  const cashPaymentsText = `
    CASH\nPAYMENTS\n
    TOTAL OPERATING ACCOUNTS 1,234,567$
    TOTAL ESCROW ACCOUNTS 234,567$
    TOTAL RESERVE FUNDS 345,678$
    TOTAL CASH AND CASH EQUIVALENTS 1,814,812$
  `
  const inputsPayments: PdfTextInput[] = [
    { fileName: 'PTG November 2025 Financial Statements.pdf', text: financialStatementsText },
    { fileName: 'PTG November 2025 BankReconciliation.pdf', text: bankReconciliationText },
    // Note the concatenated filename "CashPayments" (no space/underscore).
    { fileName: 'PTG-Nov2025-CashPayments.pdf', text: cashPaymentsText },
  ]

  const resultPayments = extractMonthDataFromPdfTexts(monthKey, inputsPayments)
  const kindsPayments = new Set(resultPayments.extracted.sources.map((s) => s.kind))
  assert(kindsPayments.has('cash-summary'), 'QA FAIL: did not detect cash-summary for CashPayments variant')

  // QA: ensure core fields extracted
  assert(typeof result.data.noi?.actual === 'number', 'QA FAIL: NOI actual not extracted')
  assert(typeof result.data.cash?.total === 'number', 'QA FAIL: Cash total not extracted')
  assert(typeof result.data.receivables?.total === 'number', 'QA FAIL: Receivables total not extracted')
  assert(typeof result.data.bankReconciliation?.balancePerBankStatement === 'number', 'QA FAIL: Bank balance not extracted')
  assert(typeof result.data.bankReconciliation?.depositsInTransit === 'number', 'QA FAIL: Deposits in transit not extracted')
  assert(typeof result.data.bankReconciliation?.outstandingChecks === 'number', 'QA FAIL: Outstanding checks not extracted')
  assert(Boolean(result.data.incomeStatement?.lineItems?.length), 'QA FAIL: Budget line items not extracted')
  assert(Boolean(result.data.notes?.some((n) => n.includes('A. FIRE PROTECTION'))), 'QA FAIL: FS notes not extracted')

  const lineItems = result.data.incomeStatement?.lineItems ?? []
  assert(lineItems.length > 0, 'QA FAIL: line items missing after extraction')

  // QA: ensure known bad labels are rejected from the P&L breakdown.
  const suspiciousPatterns = [
    /METROPOLITAN\s*\/?/i,
    /\bIDB\s*\/?/i,
    /A\/P\s+OVER\s+\d+\s+DAYS/i,
    /\b\d{3,}\s+[A-Z]\d{1,3}\b/i,
  ]
  for (const item of lineItems) {
    const isSuspicious = suspiciousPatterns.some((re) => re.test(item.label))
    assert(!isSuspicious, `QA FAIL: suspicious line item leaked into extracted breakdown: "${item.label}"`)
  }

  // QA: ensure "other" section rows are classified correctly.
  const otherItems = lineItems.filter((x) => x.kind === 'other')
  assert(otherItems.length > 0, 'QA FAIL: expected at least one "other" line item')
  assert(
    otherItems.some((x) => /MORTGAGE PRINCIPAL|CAPITAL RESERVE TRANSFER|DEPRECIATION/i.test(x.label)),
    'QA FAIL: debt-service / below-NOI rows were not classified as "other"'
  )
  assert(
    otherItems.some((x) => /CAP IMP\/LOBBY|ESCROW DEPOSITS|INTEREST INCOME - CAPITAL|CORPORATE TAX REFUNDS/i.test(x.label)),
    'QA FAIL: expected non-operating capital/escrow/tax-refund rows to classify as "other"'
  )

  // QA: parsed revenue/expense sums should stay within a small tolerance of extracted totals.
  const revenueTotal = result.data.incomeStatement?.totalRevenue?.actual
  const expensesTotal = result.data.incomeStatement?.totalOperatingExpenses?.actual
  const revenueSum = lineItems.filter((x) => x.kind === 'revenue').reduce((acc, x) => acc + x.actual, 0)
  const expenseSum = lineItems.filter((x) => x.kind === 'expense').reduce((acc, x) => acc + x.actual, 0)

  if (typeof revenueTotal === 'number') {
    const tol = Math.max(1, Math.abs(revenueTotal) * 0.02)
    assert(
      Math.abs(revenueSum - revenueTotal) <= tol,
      `QA FAIL: revenue line-item sum (${revenueSum}) is outside tolerance vs totalRevenue.actual (${revenueTotal})`
    )
  }
  if (typeof expensesTotal === 'number') {
    const tol = Math.max(1, Math.abs(expensesTotal) * 0.02)
    assert(
      Math.abs(expenseSum - expensesTotal) <= tol,
      `QA FAIL: expense line-item sum (${expenseSum}) is outside tolerance vs totalOperatingExpenses.actual (${expensesTotal})`
    )
  }

  // Persist + reload
  await setStoredMonthData(monthKey, result.data)
  const stored = await getStoredMonthData(monthKey)
  assert(stored !== null, 'QA FAIL: Stored month data not found after save')

  const keys = await listStoredMonthKeys()

  // Print summary
  // eslint-disable-next-line no-console
  console.log('QA PASS: PDF ingestion self-test succeeded')
  // eslint-disable-next-line no-console
  console.log('Detected kinds:', Array.from(kinds).sort().join(', '))
  // eslint-disable-next-line no-console
  console.log('Warnings:', result.warnings.length ? result.warnings : '(none)')
  // eslint-disable-next-line no-console
  console.log('Stored keys (local mode only):', keys.length ? keys.join(', ') : '(kv mode or empty)')

  // eslint-disable-next-line no-console
  console.log('\nExtracted preview:\n', pretty(result.extracted))
  // eslint-disable-next-line no-console
  console.log('\nStored month data preview:\n', pretty(stored))
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack || err))
  process.exitCode = 1
})
