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

    REPAIRS AND MAINTENANCE 12,000 10,000 2,000
    LEGAL FEES 44,016 10,000 34,016
    UTILITIES 8,500 9,000 (500)

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
    C GLASS DOORS WINDOWS
    PAYMENT TO MARION GLASS COMPANY IN 8/2025 OF $1,682.12 FOR FURNISHED & DELIVER 21" SPIRAL ALUMINUM SASH.
    PAYMENT TO MARION GLASS COMPANY IN 8/2025 OF $816.56 FOR INSTALL A NEW INSULATED UNIT.
    K LEGAL FEES
    PAYMENT TO PHILLIPS NIZER LLP IN 10/2025 OF $44,016 FOR PROVIDING GAS DRYER LITIGATION SERVICES.
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
  assert(Boolean(result.data.notesRaw?.some((n) => n.includes('A. FIRE PROTECTION'))), 'QA FAIL: FS notes raw not extracted')
  assert(Boolean(result.data.notesStructured?.length), 'QA FAIL: FS notes structured not extracted')
  assert(
    Boolean(result.data.notesStructured?.some((n) => n.mapping?.targetLabel === 'LEGAL FEES')),
    'QA FAIL: FS notes were not mapped to any line item'
  )
  assert(
    Boolean(result.data.notesStructured?.some((n) => n.amount === 1682.12 || n.amount === 816.56)),
    'QA FAIL: Decimal note amounts not parsed'
  )

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
