// Financial data for multiple months
export interface MonthlyData {
  month: string;
  year: number;
  label: string;
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

export const financialData: Record<string, MonthlyData> = {
  'nov-2025': {
    month: 'November',
    year: 2025,
    label: 'Nov 2025',
    noi: {
      actual: 77438,
      budget: -26983,
      variance: 104421
    },
    cash: {
      total: 7117572,
      operating: 2090000,
      reserves: 5020000,
      breakdown: {
        operating: 2090000,
        reserve: 3200000,
        capital: 1530000,
        security: 290000
      }
    },
    occupancy: {
      rate: 96.8,
      occupied: 211,
      totalUnits: 218,
      note: '7 vacant units in renovation'
    },
    collections: {
      rate: 98.2,
      trendPct: 1.4,
      aging: {
        current0to30: 42108,
        days31to60: 18234,
        days60plus: 14850
      }
    },
    arrears: {
      amount: 75192,
      trend: 'down',
      note: 'Collections improving'
    },
    ratios: {
      operatingRatioPct: 62.4,
      dscr: 1.85,
      monthsReserve: 14.2,
      collectionRatePct: 98.2
    },
    reservesStatus: {
      buildingReserve: { current: 3200000, target: 3500000 },
      capitalImprovement: { current: 1530000, target: 2000000 },
      monthlyContribution: 45000
    },
    alerts: [
      {
        type: 'danger',
        icon: 'gavel',
        title: 'Legal Expenses Over Budget',
        description: '$23,715 actual vs $4,167 budget (+469%). Review ongoing litigation status.'
      },
      {
        type: 'warning',
        icon: 'file-invoice',
        title: 'Missing Utility Bill',
        description: 'Water/sewer bill not posted this month. Expect catch-up next month.'
      },
      {
        type: 'warning',
        icon: 'money-bill-wave',
        title: 'Deferred Income',
        description: 'Sublet and laundry income delayed due to timing. Will post next month.'
      },
      {
        type: 'info',
        icon: 'info-circle',
        title: 'Insurance Adjustment',
        description: '$10,000 claim reversal is a one-time adjustment.'
      }
    ],
    highlights: [
      {
        type: 'success',
        icon: 'check-circle',
        title: 'Strong NOI Performance',
        description: 'Beat budget by $104K driven by favorable utilities and R&M.'
      },
      {
        type: 'success',
        icon: 'chart-line',
        title: 'Collections Improving',
        description: 'Arrears down from prior month; collection rate at 98.2%.'
      },
      {
        type: 'success',
        icon: 'piggy-bank',
        title: 'Reserve Funding On Track',
        description: 'Building reserve at 91.4% of target with consistent contributions.'
      },
      {
        type: 'info',
        icon: 'calendar-check',
        title: 'YTD Performance',
        description: 'YTD performance remains ahead of budget.'
      }
    ],
    expenses: {
      payroll: 90036,
      utilities: 46576,
      repairsMaint: 46157,
      legal: 23715,
      adminGeneral: 37502,
      propertyTaxes: 163668,
      debtService: 61153,
      insurance: 28500
    },
    budgets: {
      utilities: 86387,
      repairsMaint: 73673,
      legal: 4167,
      adminGeneral: 84999
    },
    notes: [
      'No water and sewer bill posted this month, which makes utilities look unusually favorable.',
      '$10,000 insurance claim reversal reduced other income but is a one time adjustment.',
      'Sublet and laundry income did not post in November due to timing.',
      'Legal remains above budget and is the main negative variance despite a strong overall month.'
    ]
  },
  'oct-2025': {
    month: 'October',
    year: 2025,
    label: 'Oct 2025',
    noi: {
      actual: 10000,
      budget: 15000,
      variance: -5000
    },
    cash: {
      total: 7050000,
      operating: 2010000,
      reserves: 4700000,
      breakdown: {
        operating: 2010000,
        reserve: 3000000,
        capital: 1400000,
        security: 300000
      }
    },
    occupancy: {
      rate: 96.3,
      occupied: 210,
      totalUnits: 218,
      note: 'Renovations continuing'
    },
    collections: {
      rate: 96.8,
      trendPct: 0.5,
      aging: {
        current0to30: 45000,
        days31to60: 22000,
        days60plus: 15500
      }
    },
    arrears: {
      amount: 82500,
      trend: 'up',
      note: 'Slight increase in outstanding balances'
    },
    ratios: {
      operatingRatioPct: 64.2,
      dscr: 1.72,
      monthsReserve: 13.8,
      collectionRatePct: 96.8
    },
    reservesStatus: {
      buildingReserve: { current: 3150000, target: 3500000 },
      capitalImprovement: { current: 1500000, target: 2000000 },
      monthlyContribution: 45000
    },
    alerts: [
      {
        type: 'warning',
        icon: 'gavel',
        title: 'Legal Expenses Elevated',
        description: 'Legal fees remain above budget; continue monitoring cases.'
      },
      {
        type: 'info',
        icon: 'wrench',
        title: 'Preventive Maintenance',
        description: 'HVAC preventative maintenance completed ahead of heating season.'
      }
    ],
    highlights: [
      {
        type: 'info',
        icon: 'chart-line',
        title: 'Cash Stable',
        description: 'Cash balances remain stable with planned reserve contributions.'
      }
    ],
    expenses: {
      payroll: 88500,
      utilities: 78000,
      repairsMaint: 52000,
      legal: 18500,
      adminGeneral: 42000,
      propertyTaxes: 163668,
      debtService: 61153,
      insurance: 28500
    },
    budgets: {
      utilities: 86387,
      repairsMaint: 73673,
      legal: 4167,
      adminGeneral: 84999
    },
    notes: [
      'Water and sewer costs higher than expected due to summer carryover.',
      'Legal fees related to ongoing tenant dispute resolution.',
      'Repairs focused on HVAC preventive maintenance.',
      'Reserve fund contribution on track.'
    ]
  },
  'sep-2025': {
    month: 'September',
    year: 2025,
    label: 'Sep 2025',
    noi: {
      actual: 15000,
      budget: 20000,
      variance: -5000
    },
    cash: {
      total: 6980000,
      operating: 1950000,
      reserves: 4680000,
      breakdown: {
        operating: 1950000,
        reserve: 2980000,
        capital: 1400000,
        security: 300000
      }
    },
    occupancy: {
      rate: 95.9,
      occupied: 209,
      totalUnits: 218
    },
    collections: {
      rate: 96.3,
      trendPct: -0.2,
      aging: {
        current0to30: 43000,
        days31to60: 21000,
        days60plus: 15000
      }
    },
    arrears: {
      amount: 79000,
      trend: 'stable',
      note: 'Consistent collection rates'
    },
    ratios: {
      operatingRatioPct: 65.8,
      dscr: 1.65,
      monthsReserve: 13.4,
      collectionRatePct: 96.3
    },
    reservesStatus: {
      buildingReserve: { current: 3100000, target: 3500000 },
      capitalImprovement: { current: 1480000, target: 2000000 },
      monthlyContribution: 45000
    },
    expenses: {
      payroll: 87000,
      utilities: 82000,
      repairsMaint: 65000,
      legal: 12000,
      adminGeneral: 38000,
      propertyTaxes: 163668,
      debtService: 61153,
      insurance: 28500
    },
    budgets: {
      utilities: 86387,
      repairsMaint: 73673,
      legal: 4167,
      adminGeneral: 84999
    },
    notes: [
      'End of summer cooling costs reflected in utilities.',
      'Major lobby renovation completed within budget.',
      'Insurance renewal processed.',
      'Staff overtime for summer projects winding down.'
    ]
  },
  'aug-2025': {
    month: 'August',
    year: 2025,
    label: 'Aug 2025',
    noi: {
      actual: 32000,
      budget: 40000,
      variance: -8000
    },
    cash: {
      total: 6920000,
      operating: 1900000,
      reserves: 4650000,
      breakdown: {
        operating: 1900000,
        reserve: 2950000,
        capital: 1400000,
        security: 270000
      }
    },
    occupancy: {
      rate: 95.4,
      occupied: 208,
      totalUnits: 218
    },
    collections: {
      rate: 96.5,
      trendPct: 0.3,
      aging: {
        current0to30: 45000,
        days31to60: 22000,
        days60plus: 11500
      }
    },
    arrears: {
      amount: 78500,
      trend: 'down',
      note: 'Summer collection push successful'
    },
    ratios: {
      operatingRatioPct: 66.5,
      dscr: 1.58,
      monthsReserve: 13.0,
      collectionRatePct: 96.5
    },
    reservesStatus: {
      buildingReserve: { current: 3050000, target: 3500000 },
      capitalImprovement: { current: 1460000, target: 2000000 },
      monthlyContribution: 45000
    },
    expenses: {
      payroll: 92000,
      utilities: 95000,
      repairsMaint: 48000,
      legal: 8500,
      adminGeneral: 35000,
      propertyTaxes: 163668,
      debtService: 61153,
      insurance: 28500
    },
    budgets: {
      utilities: 86387,
      repairsMaint: 73673,
      legal: 4167,
      adminGeneral: 84999
    },
    notes: [
      'Peak summer cooling costs drove utilities over budget.',
      'Additional staffing for summer maintenance.',
      'Playground equipment replacement completed.',
      'Strong rental income from summer move-ins.'
    ]
  },
  'jul-2025': {
    month: 'July',
    year: 2025,
    label: 'Jul 2025',
    noi: {
      actual: 50000,
      budget: 45000,
      variance: 5000
    },
    cash: {
      total: 6850000,
      operating: 1850000,
      reserves: 4620000,
      breakdown: {
        operating: 1850000,
        reserve: 2920000,
        capital: 1400000,
        security: 280000
      }
    },
    occupancy: {
      rate: 95.9,
      occupied: 209,
      totalUnits: 218
    },
    collections: {
      rate: 96.2,
      trendPct: 0.1,
      aging: {
        current0to30: 44000,
        days31to60: 23000,
        days60plus: 18000
      }
    },
    arrears: {
      amount: 85000,
      trend: 'up',
      note: 'Vacation season impact on collections'
    },
    ratios: {
      operatingRatioPct: 64.8,
      dscr: 1.68,
      monthsReserve: 12.8,
      collectionRatePct: 96.2
    },
    reservesStatus: {
      buildingReserve: { current: 3000000, target: 3500000 },
      capitalImprovement: { current: 1420000, target: 2000000 },
      monthlyContribution: 45000
    },
    expenses: {
      payroll: 85000,
      utilities: 88000,
      repairsMaint: 42000,
      legal: 5500,
      adminGeneral: 33000,
      propertyTaxes: 163668,
      debtService: 61153,
      insurance: 28500
    },
    budgets: {
      utilities: 86387,
      repairsMaint: 73673,
      legal: 4167,
      adminGeneral: 84999
    },
    notes: [
      'Strong NOI despite summer season.',
      'Several units turned over with minimal vacancy loss.',
      'Landscaping contract renegotiated for savings.',
      'Fire safety inspection passed with no issues.'
    ]
  },
  'jun-2025': {
    month: 'June',
    year: 2025,
    label: 'Jun 2025',
    noi: {
      actual: 45000,
      budget: 42000,
      variance: 3000
    },
    cash: {
      total: 6780000,
      operating: 1800000,
      reserves: 4580000,
      breakdown: {
        operating: 1800000,
        reserve: 2880000,
        capital: 1400000,
        security: 300000
      }
    },
    occupancy: {
      rate: 96.3,
      occupied: 210,
      totalUnits: 218
    },
    collections: {
      rate: 96.1,
      trendPct: -0.2,
      aging: {
        current0to30: 46000,
        days31to60: 24000,
        days60plus: 2500
      }
    },
    arrears: {
      amount: 72000,
      trend: 'down',
      note: 'End of quarter collection efforts'
    },
    ratios: {
      operatingRatioPct: 63.5,
      dscr: 1.72,
      monthsReserve: 12.5,
      collectionRatePct: 96.1
    },
    reservesStatus: {
      buildingReserve: { current: 2950000, target: 3500000 },
      capitalImprovement: { current: 1360000, target: 2000000 },
      monthlyContribution: 45000
    },
    expenses: {
      payroll: 84000,
      utilities: 75000,
      repairsMaint: 55000,
      legal: 9000,
      adminGeneral: 36000,
      propertyTaxes: 163668,
      debtService: 61153,
      insurance: 28500
    },
    budgets: {
      utilities: 86387,
      repairsMaint: 73673,
      legal: 4167,
      adminGeneral: 84999
    },
    notes: [
      'Q2 closed strong with favorable variance.',
      'Elevator modernization project kicked off.',
      'Annual meeting expenses included.',
      'Insurance claim for water damage processed.'
    ]
  }
};

export const availableMonths = [
  { value: 'nov-2025', label: 'November 2025' },
  { value: 'oct-2025', label: 'October 2025' },
  { value: 'sep-2025', label: 'September 2025' },
  { value: 'aug-2025', label: 'August 2025' },
  { value: 'jul-2025', label: 'July 2025' },
  { value: 'jun-2025', label: 'June 2025' }
];

export function getMonthData(monthKey: string): MonthlyData | null {
  return financialData[monthKey] || null;
}

export function getTrendData(months: string[] = ['jul-2025', 'aug-2025', 'sep-2025', 'oct-2025', 'nov-2025']) {
  return months.map(m => financialData[m]).filter(Boolean);
}
