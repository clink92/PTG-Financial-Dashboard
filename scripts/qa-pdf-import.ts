import { extractMonthDataFromPdfTexts, type PdfTextInput } from '../src/lib/pdfImport'
import { getStoredMonthData, listStoredMonthKeys, setStoredMonthData } from '../src/lib/monthStore'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function pretty(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

async function main() {
  const monthKey = 'nov-2025'

  // Synthetic PDF texts that match the regex extraction patterns.
  // These mimic the consistent monthly PDF format you described.
  const financialStatementsText = `
    MONTHLY MANAGEMENT REPORT

    NET OPERATING INCOME 77,438 (26,983) 104,421

    REVENUES
    MAINTENANCE CHARGES 110,000 108,000 2,000
    LAUNDRY INCOME 1,800 1,500 300
    LEGAL FEES 1,600 0 1,600
    MAINTENANCE 574,918 574,918 574,918 574,918 574,918 574,325 574,918 574,918 574,918 574,918 574,918 574,918 6,900,000 6,900,000 0
    OTHER TENANT/MISC INCOME 7,698 2,778 16,484 15,409 19,959 11,564 24,756 12,208 1,580 8,445 7,047 22,396 150,000 150,000 0
    TOTAL REVENUES 695,365 691,465 3,900

    OPERATING EXPENSES 122,030 122,000 30
    PAYROLL & RELATED COSTS
    PAYROLL 56,249 64,037 (7,788)
    PAYROLL - ONSITE MANAGEMENT 13,750 15,500 1,750
    BONUS 22,000 19,600 2,400
    PAYROLL TAXES 5,987 4,162 1,825
    TOTAL PAYROLL & RELATED COSTS 98,500 103,000 (4,500)
    REPAIRS AND MAINTENANCE 12,000 10,000 2,000
    UTILITIES 8,500 9,000 (500)
    LEGAL FEES 2,140 0 2,140
    PLUMBING REPAIRS 890 0 890
    TOTAL OPERATING EXPENSES 122,030 122,000 30

    NET OPERATING INCOME (4,793) (67,709) 62,916
    INTEREST INCOME - CAPITAL 3,120 12,500 (9,380)
    CAPITAL EXPENDITURES (36,743) (255,287) 218,544
    NET INCOME (38,417) 312,917 (351,334)

    TOTAL OPERATING ACCOUNTS 1,234,567$
    TOTAL ESCROW ACCOUNTS 234,567$
    TOTAL RESERVE FUNDS 345,678$
    TOTAL CASH AND CASH EQUIVALENTS 1,814,812$

    A/R CURRENT 20,835$
    A/R OVER 30 DAYS 12,396
    A/R OVER 60 DAYS 8,184
    A/R OVER 90 DAYS 33,532
    ------TOTAL------ 74,948$
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
  assert(Boolean(result.data.incomeStatement?.sections?.length), 'QA FAIL: income statement sections not extracted')

  const lineItems = result.data.incomeStatement?.lineItems ?? []
  const sections = result.data.incomeStatement?.sections ?? []
  const maintenanceRevenue = lineItems.find((item) => item.label.toUpperCase().includes('MAINTENANCE CHARGES'))
  const maintenanceNoisy = lineItems.find((item) => item.label === 'MAINTENANCE')
  const otherTenantIncome = lineItems.find((item) => item.label.toUpperCase().includes('OTHER TENANT/MISC INCOME'))
  const repairsExpense = lineItems.find((item) => item.label.toUpperCase().includes('REPAIRS AND MAINTENANCE'))
  const revenueLegalFees = lineItems.find((item) => item.kind === 'revenue' && item.label.toUpperCase() === 'LEGAL FEES')
  const expenseLegalFees = lineItems.find((item) => item.kind === 'expense' && item.label.toUpperCase() === 'LEGAL FEES')
  const payrollOnsite = lineItems.find((item) => item.label.toUpperCase() === 'PAYROLL - ONSITE MANAGEMENT')
  const payrollSection = sections.find((section) => section.label.toUpperCase() === 'PAYROLL & RELATED COSTS')
  const payrollBalancingLine = lineItems.find((item) => item.label.toUpperCase() === 'UNCLASSIFIED IN PAYROLL & RELATED COSTS')
  const plumbingRepairs = lineItems.find((item) => item.label.toUpperCase() === 'PLUMBING REPAIRS')
  const interestIncome = lineItems.find((item) => item.label.toUpperCase().includes('INTEREST INCOME'))
  const capitalExpenditures = lineItems.find((item) => item.label.toUpperCase().includes('CAPITAL EXPENDITURES'))
  assert(maintenanceRevenue?.kind === 'revenue', 'QA FAIL: maintenance charges should be classified as revenue')
  assert(maintenanceNoisy?.kind === 'revenue', 'QA FAIL: maintenance should remain in revenue section')
  assert(otherTenantIncome?.kind === 'revenue', 'QA FAIL: other tenant/misc income should be revenue')
  assert(Boolean(maintenanceNoisy) && !/[0-9]/.test(maintenanceNoisy.label), 'QA FAIL: maintenance label should not include numeric columns')
  assert(maintenanceNoisy?.actual === 574918, 'QA FAIL: maintenance should use month column, not annual total')
  assert(otherTenantIncome?.actual === 7047, 'QA FAIL: other tenant/misc income should use month column, not annual total')
  assert(repairsExpense?.kind === 'expense', 'QA FAIL: repairs and maintenance should be classified as expense')
  assert(revenueLegalFees?.kind === 'revenue', 'QA FAIL: legal fees revenue row should be retained')
  assert(expenseLegalFees?.kind === 'expense', 'QA FAIL: legal fees expense row should be retained')
  assert(payrollOnsite?.kind === 'expense', 'QA FAIL: payroll onsite management should be classified as expense')
  assert(Boolean(payrollSection), 'QA FAIL: payroll section not extracted')
  assert(payrollSection?.source === 'fs-subtotal', 'QA FAIL: payroll section should come from FS subtotal')
  assert(payrollOnsite?.sectionKey === payrollSection?.sectionKey, 'QA FAIL: payroll item should map to payroll section')
  assert(Boolean(payrollBalancingLine), 'QA FAIL: payroll section balancing row should be added for subtotal mismatch')
  assert(payrollBalancingLine?.sectionKey === payrollSection?.sectionKey, 'QA FAIL: payroll balancing row should stay in payroll section')
  assert(payrollOnsite?.actual === 13750, 'QA FAIL: payroll onsite management actual should be parsed correctly')
  assert(plumbingRepairs?.kind === 'expense', 'QA FAIL: plumbing repairs should be classified as expense')
  assert(!interestIncome, 'QA FAIL: interest income should not be included in operating line items')
  assert(!capitalExpenditures, 'QA FAIL: capital expenditures should not be included in operating line items')

  const sectionTieOutFailures = sections.filter((section) => {
    const sectionItems = lineItems.filter((item) => item.sectionKey === section.sectionKey)
    const sectionActual = sectionItems.reduce((acc, item) => acc + item.actual, 0)
    const sectionBudget = sectionItems.reduce((acc, item) => acc + item.budget, 0)
    return Math.abs(sectionActual - section.actual) > 1 || Math.abs(sectionBudget - section.budget) > 1
  })
  assert(sectionTieOutFailures.length === 0, `QA FAIL: section tie-out mismatch ${pretty(sectionTieOutFailures)}`)

  const revenueItems = lineItems.filter((item) => item.kind === 'revenue')
  const expenseItems = lineItems.filter((item) => item.kind === 'expense')
  const revenueActual = revenueItems.reduce((acc, item) => acc + item.actual, 0)
  const expenseActual = expenseItems.reduce((acc, item) => acc + item.actual, 0)
  const fsRevenueActual = result.data.incomeStatement?.totalRevenue?.actual ?? result.data.incomeStatement?.totalIncome ?? 0
  const fsExpenseActual = result.data.incomeStatement?.totalOperatingExpenses?.actual ?? result.data.incomeStatement?.totalExpenses ?? 0
  assert(Math.abs(revenueActual - fsRevenueActual) <= 1, 'QA FAIL: revenue line-item total does not tie to FS total')
  assert(Math.abs(expenseActual - fsExpenseActual) <= 1, 'QA FAIL: expense line-item total does not tie to FS total')

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
