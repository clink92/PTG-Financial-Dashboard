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
  };
  arrears: {
    amount: number;
    trend: 'up' | 'down' | 'stable';
    note: string;
  };
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
      operating: 2093777,
      reserves: 4730000
    },
    arrears: {
      amount: 75192,
      trend: 'down',
      note: 'Collections improving'
    },
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
      reserves: 4700000
    },
    arrears: {
      amount: 82500,
      trend: 'up',
      note: 'Slight increase in outstanding balances'
    },
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
      reserves: 4680000
    },
    arrears: {
      amount: 79000,
      trend: 'stable',
      note: 'Consistent collection rates'
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
      reserves: 4650000
    },
    arrears: {
      amount: 78500,
      trend: 'down',
      note: 'Summer collection push successful'
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
      reserves: 4620000
    },
    arrears: {
      amount: 85000,
      trend: 'up',
      note: 'Vacation season impact on collections'
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
      reserves: 4580000
    },
    arrears: {
      amount: 72000,
      trend: 'down',
      note: 'End of quarter collection efforts'
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
