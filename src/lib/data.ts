// Financial data for multiple months
export interface MonthlyData {
  month: string;
  year: number;
  label: string;
  importedAt?: string;
  noi: {
    actual: number;
    budget: number;
    variance: number;
  };
  cash: {
    total: number;
    operating: number;
    reserves: number;
    breakdown?: {
      operating: number;
      reserve: number;
      capital: number;
      security: number;
    };
  };
  occupancy?: {
    rate: number;
    occupied: number;
    totalUnits: number;
    note?: string;
  };
  collections?: {
    rate: number;
    trendPct: number;
    aging: {
      current0to30: number;
      days31to60: number;
      days60plus: number;
    };
  };
  arrears: {
    amount: number;
    trend: 'up' | 'down' | 'stable';
    note: string;
  };
  ratios?: {
    operatingRatioPct: number;
    dscr: number;
    monthsReserve: number;
    collectionRatePct: number;
  };
  reservesStatus?: {
    buildingReserve: { current: number; target: number };
    capitalImprovement: { current: number; target: number };
    monthlyContribution: number;
  };
  alerts?: Array<{
    type: 'danger' | 'warning' | 'info' | 'success';
    icon: string;
    title: string;
    description: string;
  }>;
  highlights?: Array<{
    type: 'danger' | 'warning' | 'info' | 'success';
    icon: string;
    title: string;
    description: string;
  }>;
  expenses: {
    payroll: number;
    utilities: number;
    repairsMaint: number;
    legal: number;
    adminGeneral: number;
    propertyTaxes: number;
    debtService: number;
    insurance: number;
  };
  budgets: {
    utilities: number;
    repairsMaint: number;
    legal: number;
    adminGeneral: number;
  };
  notes: string[];
}

type RawActualMonth = {
  month: string;
  year: number;
  label: string;
  importedAt: string;
  noi: MonthlyData['noi'];
  cash: Required<MonthlyData['cash']>;
  receivables: {
    current: number;
    over30: number;
    over60: number;
    over90: number;
    total: number;
  };
  revenue: {
    actual: number;
    budget: number;
    variance: number;
  };
  operatingExpenses: {
    actual: number;
    budget: number;
    variance: number;
  };
  expenses: MonthlyData['expenses'];
  budgets: MonthlyData['budgets'];
  callouts: string[];
};

const trendMonthKeys = ['dec-2025', 'jan-2026', 'feb-2026', 'mar-2026'] as const;

const rawActualMonths: Record<(typeof trendMonthKeys)[number], RawActualMonth> = {
  'dec-2025': {
    month: 'December',
    year: 2025,
    label: 'December 2025',
    importedAt: 'February 28, 2026 12:15 PM',
    noi: {
      actual: -4793,
      budget: -67709,
      variance: 62916,
    },
    cash: {
      total: 7253930,
      operating: 2227015,
      reserves: 5026915,
      breakdown: {
        operating: 2227015,
        reserve: 4735211,
        capital: 0,
        security: 291704,
      },
    },
    receivables: {
      current: 28590,
      over30: 11274,
      over60: 0,
      over90: 45925,
      total: 85790,
    },
    revenue: {
      actual: 597314,
      budget: 600933,
      variance: -3619,
    },
    operatingExpenses: {
      actual: 602108,
      budget: 668642,
      variance: 66534,
    },
    expenses: {
      payroll: 101012,
      utilities: 152288,
      repairsMaint: 33180,
      legal: 0,
      adminGeneral: 113127,
      propertyTaxes: 164543,
      debtService: 62110,
      insurance: 83790,
    },
    budgets: {
      utilities: 121580,
      repairsMaint: 42170,
      legal: 1,
      adminGeneral: 101243,
    },
    callouts: [
      'Operating expenses finished well below budget despite a slight revenue shortfall.',
      'Detector replacement, environmental work, and compactor repairs were the biggest December one-time cost drivers.',
    ],
  },
  'jan-2026': {
    month: 'January',
    year: 2026,
    label: 'January 2026',
    importedAt: 'March 20, 2026 10:58 PM',
    noi: {
      actual: 30895,
      budget: -34248,
      variance: 65143,
    },
    cash: {
      total: 7092739,
      operating: 2136452,
      reserves: 4956287,
      breakdown: {
        operating: 2136452,
        reserve: 4758735,
        capital: 0,
        security: 197552,
      },
    },
    receivables: {
      current: 30886,
      over30: 387,
      over60: 8926,
      over90: 32790,
      total: 72989,
    },
    revenue: {
      actual: 614857,
      budget: 605288,
      variance: 9569,
    },
    operatingExpenses: {
      actual: 583962,
      budget: 639536,
      variance: 55574,
    },
    expenses: {
      payroll: 96091,
      utilities: 180667,
      repairsMaint: 17188,
      legal: 0,
      adminGeneral: 56686,
      propertyTaxes: 161646,
      debtService: 85125,
      insurance: 45186,
    },
    budgets: {
      utilities: 193605,
      repairsMaint: 25081,
      legal: 5417,
      adminGeneral: 77794,
    },
    callouts: [
      'January opened the year with revenue above budget and operating expenses below plan.',
      'Elevator repair work was the most significant January repair variance.',
    ],
  },
  'feb-2026': {
    month: 'February',
    year: 2026,
    label: 'February 2026',
    importedAt: 'March 20, 2026 10:55 PM',
    noi: {
      actual: -21431,
      budget: 32136,
      variance: -53566,
    },
    cash: {
      total: 6807367,
      operating: 1718951,
      reserves: 5088416,
      breakdown: {
        operating: 1718951,
        reserve: 4770491,
        capital: 0,
        security: 317926,
      },
    },
    receivables: {
      current: 15429,
      over30: 4908,
      over60: 4825,
      over90: 29693,
      total: 54855,
    },
    revenue: {
      actual: 606033,
      budget: 605288,
      variance: 745,
    },
    operatingExpenses: {
      actual: 627464,
      budget: 573153,
      variance: -54311,
    },
    expenses: {
      payroll: 102278,
      utilities: 134818,
      repairsMaint: 60547,
      legal: 2610,
      adminGeneral: 71844,
      propertyTaxes: 161646,
      debtService: 72685,
      insurance: 53640,
    },
    budgets: {
      utilities: 128765,
      repairsMaint: 25081,
      legal: 5417,
      adminGeneral: 77794,
    },
    callouts: [
      'February revenue landed essentially on budget, but operating expenses ran ahead of plan and pushed NOI negative.',
      'Elevator repairs, painting and building supplies were the main February expense drivers.',
    ],
  },
  'mar-2026': {
    month: 'March',
    year: 2026,
    label: 'March 2026',
    importedAt: 'April 18, 2026 6:45 PM',
    noi: {
      actual: 41620,
      budget: 24555,
      variance: 17066,
    },
    cash: {
      total: 6776846,
      operating: 1766622,
      reserves: 5010224,
      breakdown: {
        operating: 1766622,
        reserve: 4571723,
        capital: 0,
        security: 438501,
      },
    },
    receivables: {
      current: 29182,
      over30: 6847,
      over60: 2947,
      over90: 32875,
      total: 71852,
    },
    revenue: {
      actual: 610258,
      budget: 605288,
      variance: 4970,
    },
    operatingExpenses: {
      actual: 568637,
      budget: 580733,
      variance: 12096,
    },
    expenses: {
      payroll: 95225,
      utilities: 142333,
      repairsMaint: 20059,
      legal: 4419,
      adminGeneral: 86642,
      propertyTaxes: 163658,
      debtService: 57415,
      insurance: 42733,
    },
    budgets: {
      utilities: 122671,
      repairsMaint: 26581,
      legal: 5417,
      adminGeneral: 92877,
    },
    callouts: [
      'March rebounded with NOI and net cash flow both ahead of budget.',
      'Heating oil and filing fees were the largest March cost drivers, partially offset by lower insurance expense.',
    ],
  },
};

function formatCurrencyShort(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function buildCollections(seed: RawActualMonth, previous?: RawActualMonth): NonNullable<MonthlyData['collections']> {
  const overdue = seed.receivables.over30 + seed.receivables.over60 + seed.receivables.over90;
  const currentRate = seed.revenue.actual ? clamp(((seed.revenue.actual - overdue) / seed.revenue.actual) * 100, 0, 100) : 0;
  const previousOverdue = previous ? previous.receivables.over30 + previous.receivables.over60 + previous.receivables.over90 : overdue;
  const previousRate = previous ? (previous.revenue.actual ? clamp(((previous.revenue.actual - previousOverdue) / previous.revenue.actual) * 100, 0, 100) : currentRate) : currentRate;

  return {
    rate: round1(currentRate),
    trendPct: round1(currentRate - previousRate),
    aging: {
      current0to30: seed.receivables.current,
      days31to60: seed.receivables.over30,
      days60plus: seed.receivables.over60 + seed.receivables.over90,
    },
  };
}

function buildArrears(seed: RawActualMonth, previous?: RawActualMonth): MonthlyData['arrears'] {
  const previousTotal = previous?.receivables.total ?? seed.receivables.total;
  const delta = seed.receivables.total - previousTotal;
  const overdue = seed.receivables.over30 + seed.receivables.over60 + seed.receivables.over90;

  return {
    amount: seed.receivables.total,
    trend: Math.abs(delta) < 1000 ? 'stable' : delta > 0 ? 'up' : 'down',
    note: `${formatCurrency(overdue)} aged over 30 days`,
  };
}

function buildRatios(seed: RawActualMonth, collections: NonNullable<MonthlyData['collections']>): NonNullable<MonthlyData['ratios']> {
  return {
    operatingRatioPct: seed.revenue.actual ? round1((seed.operatingExpenses.actual / seed.revenue.actual) * 100) : 0,
    dscr: seed.expenses.debtService ? round1(seed.noi.actual / seed.expenses.debtService) : 0,
    monthsReserve: seed.operatingExpenses.actual ? round1(seed.cash.reserves / (seed.operatingExpenses.actual / 12)) : 0,
    collectionRatePct: collections.rate,
  };
}

function buildAlerts(seed: RawActualMonth, collections: NonNullable<MonthlyData['collections']>, arrears: MonthlyData['arrears']): NonNullable<MonthlyData['alerts']> {
  const alerts: NonNullable<MonthlyData['alerts']> = [];

  if (seed.operatingExpenses.variance < 0) {
    alerts.push({
      type: 'danger',
      icon: 'triangle-exclamation',
      title: 'Operating Expenses Above Plan',
      description: `${seed.month} operating expenses ran ${formatCurrency(Math.abs(seed.operatingExpenses.variance))} above budget.`,
    });
  } else {
    alerts.push({
      type: 'success',
      icon: 'check-circle',
      title: 'Expense Control Held',
      description: `${seed.month} operating expenses finished ${formatCurrency(seed.operatingExpenses.variance)} below budget.`,
    });
  }

  if (arrears.trend === 'up') {
    alerts.push({
      type: 'warning',
      icon: 'file-invoice-dollar',
      title: 'A/R Needs Attention',
      description: `Receivables closed at ${formatCurrency(seed.receivables.total)} with collection rate near ${collections.rate.toFixed(1)}%.`,
    });
  } else {
    alerts.push({
      type: 'success',
      icon: 'hand-holding-dollar',
      title: 'Collections Improved',
      description: `Receivables moved to ${formatCurrency(seed.receivables.total)} and trended better month over month.`,
    });
  }

  const utilityDelta = seed.expenses.utilities - seed.budgets.utilities;
  alerts.push({
    type: utilityDelta > 0 ? 'warning' : 'info',
    icon: 'bolt',
    title: utilityDelta > 0 ? 'Utilities Over Budget' : 'Utilities Below Budget',
    description: `${seed.month} utility spend was ${utilityDelta >= 0 ? '' : 'under '}${formatCurrency(Math.abs(utilityDelta))} versus budget.`,
  });

  return alerts;
}

function buildHighlights(seed: RawActualMonth, collections: NonNullable<MonthlyData['collections']>): NonNullable<MonthlyData['highlights']> {
  const highlights: NonNullable<MonthlyData['highlights']> = [
    {
      type: seed.noi.variance >= 0 ? 'success' : 'warning',
      icon: seed.noi.variance >= 0 ? 'chart-line' : 'chart-area',
      title: seed.noi.variance >= 0 ? 'NOI Ahead of Budget' : 'NOI Below Plan',
      description: `${seed.month} NOI was ${formatCurrencyShort(seed.noi.actual)} against a budget of ${formatCurrencyShort(seed.noi.budget)}.`,
    },
    {
      type: 'info',
      icon: 'wallet',
      title: 'Cash Position',
      description: `Operating cash ended at ${formatCurrencyShort(seed.cash.operating)} with ${formatCurrencyShort(seed.cash.reserves)} held in reserves.`,
    },
    {
      type: collections.rate >= 92 ? 'success' : 'info',
      icon: 'percent',
      title: 'Collection Performance',
      description: `Approximate collection rate was ${collections.rate.toFixed(1)}% with total A/R at ${formatCurrencyShort(seed.receivables.total)}.`,
    },
  ];

  if (seed.callouts[1]) {
    highlights.push({
      type: 'info',
      icon: 'lightbulb',
      title: 'Month Driver',
      description: seed.callouts[1],
    });
  }

  return highlights;
}

function buildNotes(seed: RawActualMonth, collections: NonNullable<MonthlyData['collections']>, arrears: MonthlyData['arrears']) {
  const notes = [
    `${seed.month} revenue was ${formatCurrency(seed.revenue.actual)} versus ${formatCurrency(seed.revenue.budget)} budget; operating expenses were ${formatCurrency(seed.operatingExpenses.actual)} versus ${formatCurrency(seed.operatingExpenses.budget)} budget.`,
    `Imported from the FS package on ${seed.importedAt}.`,
    `Receivables totaled ${formatCurrency(seed.receivables.total)} with ${arrears.note.toLowerCase()} and an approximate collection rate of ${collections.rate.toFixed(1)}%.`,
    ...seed.callouts,
  ];

  return notes.slice(0, 4);
}

function buildMonthData(monthKey: (typeof trendMonthKeys)[number], index: number): MonthlyData {
  const seed = rawActualMonths[monthKey];
  const previous = index > 0 ? rawActualMonths[trendMonthKeys[index - 1]] : undefined;
  const collections = buildCollections(seed, previous);
  const arrears = buildArrears(seed, previous);

  return {
    month: seed.month,
    year: seed.year,
    label: seed.label,
    importedAt: seed.importedAt,
    noi: seed.noi,
    cash: seed.cash,
    collections,
    arrears,
    ratios: buildRatios(seed, collections),
    alerts: buildAlerts(seed, collections, arrears),
    highlights: buildHighlights(seed, collections),
    expenses: seed.expenses,
    budgets: seed.budgets,
    notes: buildNotes(seed, collections, arrears),
  };
}

export const financialData: Record<string, MonthlyData> = Object.fromEntries(
  trendMonthKeys.map((monthKey, index) => [monthKey, buildMonthData(monthKey, index)])
);

export const availableMonths = [...trendMonthKeys]
  .reverse()
  .map((value) => ({ value, label: financialData[value].label }));

export function getMonthData(monthKey: string): MonthlyData | null {
  return financialData[monthKey] || null;
}

export function getTrendData(months: string[] = [...trendMonthKeys]) {
  return months.map((m) => financialData[m]).filter(Boolean);
}
