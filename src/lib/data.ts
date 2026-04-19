// Financial data for multiple months
export interface BreakdownItem {
  label: string;
  actual: number;
  budget: number;
  variance: number;
}

export interface BreakdownCategory {
  label: string;
  actual: number;
  budget: number;
  variance: number;
  items: BreakdownItem[];
}

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
  revenueBreakdown?: BreakdownCategory[];
  expenseBreakdown?: BreakdownCategory[];
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

const breakdownPresets: Record<(typeof trendMonthKeys)[number], { revenue: BreakdownCategory[]; expense: BreakdownCategory[] }> = {
  'dec-2025': {
    revenue: [
      {
        label: 'Revenues',
        actual: 593018,
        budget: 597086,
        variance: -4068,
        items: [
          { label: 'MAINTENANCE', actual: 574918, budget: 574918, variance: 0 },
          { label: 'SUBLET FEE', actual: 18100, budget: 22168, variance: -4068 },
        ],
      },
      {
        label: 'Other Tenant/Misc Income',
        actual: 4297,
        budget: 3847,
        variance: 450,
        items: [
          { label: 'LAUNDRY', actual: 0, budget: 2592, variance: -2592 },
          { label: 'LEGAL FEES', actual: 1600, budget: 0, variance: 1600 },
          { label: 'CARRIAGE/BIKE ROOM INCOME', actual: 1280, budget: 1255, variance: 25 },
          { label: 'PLUMBING REPAIRS', actual: 890, budget: 0, variance: 890 },
          { label: 'Other items in category', actual: 527, budget: 0, variance: 527 },
        ],
      },
    ],
    expense: [
      {
        label: 'Property & Other Taxes',
        actual: 161529.97,
        budget: 325360.64,
        variance: -163830.67,
        items: [
          { label: 'REAL ESTATE TAXES', actual: 163668, budget: 161312, variance: 2356 },
          { label: 'PREPAID REAL ESTATE TAXES', actual: 0, budget: 163667.64, variance: -163667.64 },
          { label: 'R/E ABATEMENT', actual: -1869.28, budget: 0, variance: -1869.28 },
          { label: 'NYS FRANCHISE TAX', actual: 0, budget: 381, variance: -381 },
          { label: 'Other items in category', actual: -268.75, budget: 0, variance: -268.75 },
        ],
      },
      {
        label: 'Utilities',
        actual: 152288.24,
        budget: 121561.17,
        variance: 30727.07,
        items: [
          { label: 'OIL', actual: 96131, budget: 69822, variance: 26309 },
          { label: 'CARBON MONOXIDE / SMOKE / NATURAL GAS DETECTOR', actual: 30208.58, budget: 0, variance: 30208.58 },
          { label: 'WATER and SEWER CHARGES', actual: 0, budget: 19000, variance: -19000 },
          { label: 'BOILER BURNER REPAIR', actual: 10191, budget: 8337, variance: 1854 },
          { label: 'Other items in category', actual: 15757.66, budget: 24402.17, variance: -8644.51 },
        ],
      },
      {
        label: 'Payroll & Related Costs',
        actual: 126888.24,
        budget: 140336,
        variance: -13447.76,
        items: [
          { label: 'PAYROLL', actual: 56249, budget: 64037, variance: -7788 },
          { label: 'PENSION & HOSPITALIZATION', actual: 25528, budget: 33456, variance: -7928 },
          { label: 'BONUS', actual: 22000, budget: 19600, variance: 2400 },
          { label: 'PAYROLL - ONSITE MANAGEMENT', actual: 13750, budget: 15500, variance: -1750 },
          { label: 'Other items in category', actual: 9361.24, budget: 7743, variance: 1618.24 },
        ],
      },
      {
        label: 'Administrative & General',
        actual: 91224.02,
        budget: 84293,
        variance: 6931.02,
        items: [
          { label: 'INSURANCE', actual: 80275, budget: 60694, variance: 19581 },
          { label: 'LICENSES-FEES-PERMITS-SUBSCRIPTIONS', actual: 7509, budget: 13721, variance: -6212 },
          { label: 'PUMP EXPENSES', actual: -9026, budget: 0, variance: -9026 },
          { label: 'MISC ADMINISTRATIVE EXPENSE', actual: 8503, budget: 4287, variance: 4216 },
          { label: 'Other items in category', actual: 3963.02, budget: 5591, variance: -1627.98 },
        ],
      },
      {
        label: 'Repairs & Maintenance',
        actual: 22216.87,
        budget: 38249.5,
        variance: -16032.63,
        items: [
          { label: 'SUPPLIES-CLEANING/BUILDING/OTHER', actual: 2223, budget: 16337, variance: -14114 },
          { label: 'INTERCOM EXPENSE', actual: 10671, budget: 3322, variance: 7349 },
          { label: 'PAINTING and PLASTERING', actual: 655, budget: 8445, variance: -7790 },
          { label: 'OTHER MISCELLANEOUS REPAIRS', actual: 6757.17, budget: 0, variance: 6757.17 },
          { label: 'Other items in category', actual: 1910.7, budget: 10145.5, variance: -8234.8 },
        ],
      },
      {
        label: 'Professional Fees',
        actual: 9689,
        budget: 17240,
        variance: -7551,
        items: [
          { label: 'MANAGEMENT FEES', actual: 6250, budget: 6250, variance: 0 },
          { label: 'ARCHITECT-ENGINEER FEES', actual: 0, budget: 6000, variance: -6000 },
          { label: 'AUDIT FEES', actual: 2674, budget: 3600, variance: -926 },
          { label: 'CONSULTANT FEES', actual: 765, budget: 1390, variance: -625 },
        ],
      },
      {
        label: 'Service Contracts',
        actual: 7050,
        budget: 33330,
        variance: -26280,
        items: [
          { label: 'LANDSCAPE/GROUNDS/FLORIST', actual: 394, budget: 22000, variance: -21606 },
          { label: 'EXTERMINATING', actual: 2286, budget: 6913, variance: -4627 },
          { label: 'ELEVATOR CONTRACT', actual: 4370, budget: 4167, variance: 203 },
          { label: 'FIRE PROTECTION', actual: 0, budget: 250, variance: -250 },
        ],
      },
    ],
  },
  'jan-2026': {
    revenue: [
      {
        label: 'Revenues',
        actual: 596478,
        budget: 596478,
        variance: 0,
        items: [{ label: 'MAINTENANCE', actual: 596478, budget: 596478, variance: 0 }],
      },
      {
        label: 'Other Tenant/Misc Income',
        actual: 18379,
        budget: 8810,
        variance: 9569,
        items: [
          { label: 'SUBLET FEE', actual: 12973, budget: 4583, variance: 8390 },
          { label: 'LAUNDRY', actual: 3631, budget: 2917, variance: 714 },
          { label: 'CARRIAGE/BIKE ROOM INCOME', actual: 1245, budget: 1310, variance: -65 },
          { label: 'PLUMBING REPAIRS', actual: 336, budget: 0, variance: 336 },
          { label: 'Other items in category', actual: 194, budget: 0, variance: 194 },
        ],
      },
    ],
    expense: [
      {
        label: 'Utilities',
        actual: 180667,
        budget: 183189,
        variance: -2522,
        items: [
          { label: 'OIL', actual: 92922, budget: 92545, variance: 377 },
          { label: 'WATER and SEWER CHARGES', actual: 73533, budget: 74124, variance: -591 },
          { label: 'ELECTRIC', actual: 7968, budget: 9845, variance: -1877 },
          { label: 'CABLE/INTERNET', actual: 3815, budget: 4000, variance: -185 },
          { label: 'Other items in category', actual: 2429, budget: 2675, variance: -246 },
        ],
      },
      {
        label: 'Property & Other Taxes',
        actual: 161646,
        budget: 159633,
        variance: 2013,
        items: [{ label: 'REAL ESTATE TAXES', actual: 161646, budget: 159633, variance: 2013 }],
      },
      {
        label: 'Payroll & Related Costs',
        actual: 96091,
        budget: 104753,
        variance: -8662,
        items: [
          { label: 'PAYROLL', actual: 46383, budget: 52388, variance: -6005 },
          { label: 'PENSION & HOSPITALIZATION', actual: 24173, budget: 25416, variance: -1243 },
          { label: 'PAYROLL - ONSITE MANAGEMENT', actual: 13750, budget: 15500, variance: -1750 },
          { label: 'PAYROLL TAXES', actual: 6011, budget: 6488, variance: -477 },
          { label: 'Other items in category', actual: 5774, budget: 4961, variance: 813 },
        ],
      },
      {
        label: 'Administrative & General',
        actual: 50708,
        budget: 59438,
        variance: -8730,
        items: [
          { label: 'INSURANCE', actual: 45186, budget: 54223, variance: -9037 },
          { label: 'LICENSES-FEES-PERMITS-SUBSCRIPTIONS', actual: 3925, budget: 417, variance: 3508 },
          { label: 'MISC ADMINISTRATIVE EXPENSE', actual: 1007, budget: 3291, variance: -2284 },
          { label: 'DUES', actual: 0, budget: 840, variance: -840 },
          { label: 'Other items in category', actual: 590, budget: 667, variance: -77 },
        ],
      },
      {
        label: 'Repairs & Maintenance',
        actual: 17188,
        budget: 32581,
        variance: -15393,
        items: [
          { label: 'ELEVATOR REPAIR', actual: 11475, budget: 833, variance: 10642 },
          { label: 'BOILER BURNER REPAIR', actual: 0, budget: 8333, variance: -8333 },
          { label: 'SUPPLIES-CLEANING/BUILDING/OTHER', actual: 4456, budget: 8333, variance: -3877 },
          { label: 'PAINTING and PLASTERING', actual: 0, budget: 6667, variance: -6667 },
          { label: 'Other items in category', actual: 1257, budget: 8415, variance: -7158 },
        ],
      },
      {
        label: 'Professional Fees',
        actual: 5978,
        budget: 18356,
        variance: -12378,
        items: [
          { label: 'MANAGEMENT FEES', actual: 6813, budget: 6438, variance: 375 },
          { label: 'LEGAL FEES', actual: -1600, budget: 5417, variance: -7017 },
          { label: 'ARCHITECT-ENGINEER FEES', actual: 0, budget: 1667, variance: -1667 },
          { label: 'CONSULTANT FEES', actual: 765, budget: 1667, variance: -902 },
          { label: 'Other items in category', actual: 0, budget: 3167, variance: -3167 },
        ],
      },
      {
        label: 'Service Contracts',
        actual: 4676,
        budget: 12500,
        variance: -7824,
        items: [
          { label: 'ELEVATOR CONTRACT', actual: 4676, budget: 5000, variance: -324 },
          { label: 'LANDSCAPE/GROUNDS/FLORIST', actual: 0, budget: 5000, variance: -5000 },
          { label: 'EXTERMINATING', actual: 0, budget: 2500, variance: -2500 },
        ],
      },
    ],
  },
  'feb-2026': {
    revenue: [
      {
        label: 'Revenues',
        actual: 596478,
        budget: 596478,
        variance: 0,
        items: [{ label: 'MAINTENANCE', actual: 596478, budget: 596478, variance: 0 }],
      },
      {
        label: 'Other Tenant/Misc Income',
        actual: 9555,
        budget: 8810,
        variance: 745,
        items: [
          { label: 'SUBLET FEE', actual: 7755, budget: 4583, variance: 3172 },
          { label: 'LAUNDRY', actual: 0, budget: 2917, variance: -2917 },
          { label: 'CARRIAGE/BIKE ROOM INCOME', actual: 1300, budget: 1310, variance: -10 },
          { label: 'FINES', actual: 500, budget: 0, variance: 500 },
        ],
      },
    ],
    expense: [
      {
        label: 'Property & Other Taxes',
        actual: 161646,
        budget: 159633,
        variance: 2013,
        items: [{ label: 'REAL ESTATE TAXES', actual: 161646, budget: 159633, variance: 2013 }],
      },
      {
        label: 'Utilities',
        actual: 120358,
        budget: 118349,
        variance: 2009,
        items: [
          { label: 'OIL', actual: 105965, budget: 101900, variance: 4065 },
          { label: 'ELECTRIC', actual: 8215, budget: 9809, variance: -1594 },
          { label: 'CABLE/INTERNET', actual: 3815, budget: 4000, variance: -185 },
          { label: 'GAS - COOKING', actual: 1352, budget: 1390, variance: -38 },
          { label: 'Other items in category', actual: 1011, budget: 1250, variance: -239 },
        ],
      },
      {
        label: 'Payroll & Related Costs',
        actual: 103066,
        budget: 103407,
        variance: -341,
        items: [
          { label: 'PAYROLL', actual: 53982, budget: 52388, variance: 1594 },
          { label: 'PENSION & HOSPITALIZATION', actual: 24684, budget: 25416, variance: -732 },
          { label: 'PAYROLL - ONSITE MANAGEMENT', actual: 13750, budget: 15500, variance: -1750 },
          { label: 'PAYROLL TAXES', actual: 6662, budget: 5142, variance: 1520 },
          { label: 'Other items in category', actual: 3988, budget: 4961, variance: -973 },
        ],
      },
      {
        label: 'Repairs & Maintenance',
        actual: 72692,
        budget: 32581,
        variance: 40111,
        items: [
          { label: 'SUPPLIES-CLEANING/BUILDING/OTHER', actual: 15572, budget: 8333, variance: 7239 },
          { label: 'ELEVATOR REPAIR', actual: 14534, budget: 833, variance: 13701 },
          { label: 'BOILER BURNER REPAIR', actual: 13611, budget: 8333, variance: 5278 },
          { label: 'PAINTING and PLASTERING', actual: 12145, budget: 6667, variance: 5478 },
          { label: 'Other items in category', actual: 16830, budget: 8415, variance: 8415 },
        ],
      },
      {
        label: 'Administrative & General',
        actual: 59357,
        budget: 59438,
        variance: -81,
        items: [
          { label: 'INSURANCE', actual: 53640, budget: 54223, variance: -583 },
          { label: 'MISC ADMINISTRATIVE EXPENSE', actual: 1972, budget: 3291, variance: -1319 },
          { label: 'LICENSES-FEES-PERMITS-SUBSCRIPTIONS', actual: 1800, budget: 417, variance: 1383 },
          { label: 'ENVIRONMENTAL COSTS', actual: 1240, budget: 0, variance: 1240 },
          { label: 'Other items in category', actual: 705, budget: 1507, variance: -802 },
        ],
      },
      {
        label: 'Service Contracts',
        actual: 19840,
        budget: 12500,
        variance: 7340,
        items: [
          { label: 'LANDSCAPE/GROUNDS/FLORIST', actual: 10099, budget: 5000, variance: 5099 },
          { label: 'ELEVATOR CONTRACT', actual: 4676, budget: 5000, variance: -324 },
          { label: 'EXTERMINATING', actual: 3920, budget: 2500, variance: 1420 },
          { label: 'BUILDING LINK', actual: 1145, budget: 0, variance: 1145 },
        ],
      },
      {
        label: 'Professional Fees',
        actual: 12487,
        budget: 18356,
        variance: -5869,
        items: [
          { label: 'MANAGEMENT FEES', actual: 6438, budget: 6438, variance: 0 },
          { label: 'LEGAL FEES', actual: 2610, budget: 5417, variance: -2807 },
          { label: 'AUDIT FEES', actual: 2674, budget: 1500, variance: 1174 },
          { label: 'ARCHITECT-ENGINEER FEES', actual: 0, budget: 1667, variance: -1667 },
          { label: 'Other items in category', actual: 765, budget: 3334, variance: -2569 },
        ],
      },
    ],
  },
  'mar-2026': {
    revenue: [
      {
        label: 'Revenues',
        actual: 596478,
        budget: 596478,
        variance: 0,
        items: [{ label: 'MAINTENANCE', actual: 596478, budget: 596478, variance: 0 }],
      },
      {
        label: 'Other Tenant/Misc Income',
        actual: 13780,
        budget: 8810,
        variance: 4970,
        items: [
          { label: 'SUBLET FEE', actual: 10200, budget: 4583, variance: 5617 },
          { label: 'LAUNDRY', actual: 0, budget: 2917, variance: -2917 },
          { label: 'CARRIAGE/BIKE ROOM INCOME', actual: 1465, budget: 1310, variance: 155 },
          { label: 'PLUMBING REPAIRS', actual: 780, budget: 0, variance: 780 },
          { label: 'Other items in category', actual: 1335, budget: 0, variance: 1335 },
        ],
      },
    ],
    expense: [
      {
        label: 'Property & Other Taxes',
        actual: 163658,
        budget: 161447,
        variance: 2211,
        items: [
          { label: 'REAL ESTATE TAXES', actual: 161646, budget: 159633, variance: 2013 },
          { label: 'NYS FRANCHISE TAX', actual: 1137, budget: 896, variance: 241 },
          { label: 'NYC FRANCHISE / CORP TAX', actual: 875, budget: 918, variance: -43 },
        ],
      },
      {
        label: 'Utilities',
        actual: 137070,
        budget: 110755,
        variance: 26315,
        items: [
          { label: 'OIL', actual: 95027, budget: 66000, variance: 29027 },
          { label: 'WATER and SEWER CHARGES', actual: 28166, budget: 28200, variance: -34 },
          { label: 'ELECTRIC', actual: 8620, budget: 9888, variance: -1268 },
          { label: 'CABLE/INTERNET', actual: 3815, budget: 4000, variance: -185 },
          { label: 'Other items in category', actual: 1442, budget: 2667, variance: -1225 },
        ],
      },
      {
        label: 'Payroll & Related Costs',
        actual: 95225,
        budget: 102835,
        variance: -7610,
        items: [
          { label: 'PAYROLL', actual: 48367, budget: 52388, variance: -4021 },
          { label: 'PENSION & HOSPITALIZATION', actual: 24684, budget: 25416, variance: -732 },
          { label: 'PAYROLL - ONSITE MANAGEMENT', actual: 13750, budget: 15500, variance: -1750 },
          { label: 'PAYROLL TAXES', actual: 4634, budget: 4570, variance: 64 },
          { label: 'Other items in category', actual: 3790, budget: 4961, variance: -1171 },
        ],
      },
      {
        label: 'Administrative & General',
        actual: 64445,
        budget: 67688,
        variance: -3243,
        items: [
          { label: 'INSURANCE', actual: 42733, budget: 54223, variance: -11490 },
          { label: 'FILING FEES', actual: 13169, budget: 0, variance: 13169 },
          { label: 'ENVIRONMENTAL COSTS', actual: 1240, budget: 7500, variance: -6260 },
          { label: 'MISC ADMINISTRATIVE EXPENSE', actual: 4644, budget: 3291, variance: 1353 },
          { label: 'Other items in category', actual: 2659, budget: 2674, variance: -15 },
        ],
      },
      {
        label: 'Professional Fees',
        actual: 22197,
        budget: 25189,
        variance: -2992,
        items: [
          { label: 'OTHER PROFESSIONAL FEES', actual: 10575, budget: 10000, variance: 575 },
          { label: 'MANAGEMENT FEES', actual: 6438, budget: 6438, variance: 0 },
          { label: 'LEGAL FEES', actual: 4419, budget: 5417, variance: -998 },
          { label: 'ARCHITECT-ENGINEER FEES', actual: 0, budget: 1667, variance: -1667 },
          { label: 'Other items in category', actual: 765, budget: 1667, variance: -902 },
        ],
      },
      {
        label: 'Repairs & Maintenance',
        actual: 20059,
        budget: 34081,
        variance: -14022,
        items: [
          { label: 'SUPPLIES-CLEANING/BUILDING/OTHER', actual: 8422, budget: 8333, variance: 89 },
          { label: 'BOILER BURNER REPAIR', actual: 3871, budget: 8333, variance: -4462 },
          { label: 'PAINTING and PLASTERING', actual: 0, budget: 6667, variance: -6667 },
          { label: 'ELEVATOR REPAIR', actual: 3626, budget: 833, variance: 2793 },
          { label: 'Other items in category', actual: 4140, budget: 9915, variance: -5775 },
        ],
      },
      {
        label: 'Service Contracts',
        actual: 8077,
        budget: 15875,
        variance: -7798,
        items: [
          { label: 'ELEVATOR CONTRACT', actual: 4676, budget: 5000, variance: -324 },
          { label: 'LANDSCAPE/GROUNDS/FLORIST', actual: 296, budget: 5000, variance: -4704 },
          { label: 'BUILDING LINK', actual: 1145, budget: 3375, variance: -2230 },
          { label: 'EXTERMINATING', actual: 1960, budget: 2500, variance: -540 },
        ],
      },
    ],
  },
};

function buildBreakdowns(monthKey: (typeof trendMonthKeys)[number]) {
  return breakdownPresets[monthKey];
}

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
  const breakdowns = buildBreakdowns(monthKey);

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
    revenueBreakdown: breakdowns.revenue,
    expenseBreakdown: breakdowns.expense,
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
