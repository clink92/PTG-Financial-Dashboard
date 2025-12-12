import { MonthlyData } from './data';

export interface AIInsight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  metric?: string;
  recommendation?: string;
}

export function generateInsights(data: MonthlyData): AIInsight[] {
  const insights: AIInsight[] = [];
  
  // NOI Analysis
  if (data.noi.variance > 0) {
    insights.push({
      id: 'noi-positive',
      type: 'positive',
      title: 'Strong NOI Performance',
      description: `Net Operating Income exceeded budget by $${data.noi.variance.toLocaleString()}. This represents a ${Math.round((data.noi.variance / Math.abs(data.noi.budget)) * 100)}% favorable variance.`,
      metric: `+$${data.noi.variance.toLocaleString()}`,
      recommendation: 'Consider allocating excess funds to reserve accounts or capital improvement projects.'
    });
  } else if (data.noi.variance < -10000) {
    insights.push({
      id: 'noi-negative',
      type: 'negative',
      title: 'NOI Below Budget',
      description: `Net Operating Income is $${Math.abs(data.noi.variance).toLocaleString()} below budget. Review expense categories for cost reduction opportunities.`,
      metric: `-$${Math.abs(data.noi.variance).toLocaleString()}`,
      recommendation: 'Analyze top expense variances and implement corrective measures before year end.'
    });
  }

  // Cash Position Analysis
  const cashRatio = data.cash.operating / (data.expenses.payroll + data.expenses.utilities + data.expenses.repairsMaint);
  if (cashRatio > 3) {
    insights.push({
      id: 'cash-strong',
      type: 'positive',
      title: 'Excellent Liquidity Position',
      description: `Operating cash of $${(data.cash.operating / 1000000).toFixed(2)}M provides ${cashRatio.toFixed(1)} months of operating expense coverage.`,
      metric: `${cashRatio.toFixed(1)}x coverage`,
      recommendation: 'Strong position allows for planned capital projects or investment in yield-bearing accounts.'
    });
  }

  // Arrears Analysis
  if (data.arrears.trend === 'down') {
    insights.push({
      id: 'arrears-improving',
      type: 'positive',
      title: 'Collections Improving',
      description: `Arrears trending down to $${data.arrears.amount.toLocaleString()}. ${data.arrears.note}`,
      metric: 'Trending ↓',
      recommendation: 'Continue current collection strategies and maintain tenant communication.'
    });
  } else if (data.arrears.amount > 100000) {
    insights.push({
      id: 'arrears-high',
      type: 'warning',
      title: 'Elevated Arrears Level',
      description: `Current arrears of $${data.arrears.amount.toLocaleString()} require attention.`,
      metric: `$${data.arrears.amount.toLocaleString()}`,
      recommendation: 'Review aging report and consider accelerated collection procedures for accounts over 60 days.'
    });
  }

  // Expense Analysis
  const legalVariance = data.expenses.legal - data.budgets.legal;
  if (legalVariance > 10000) {
    insights.push({
      id: 'legal-over',
      type: 'negative',
      title: 'Legal Expenses Over Budget',
      description: `Legal costs of $${data.expenses.legal.toLocaleString()} exceed budget by $${legalVariance.toLocaleString()} (${Math.round((legalVariance / data.budgets.legal) * 100)}% over).`,
      metric: `+$${legalVariance.toLocaleString()}`,
      recommendation: 'Review active cases and consider alternative dispute resolution methods where appropriate.'
    });
  }

  const utilitiesVariance = data.expenses.utilities - data.budgets.utilities;
  if (utilitiesVariance < -20000) {
    insights.push({
      id: 'utilities-under',
      type: 'positive',
      title: 'Utilities Under Budget',
      description: `Utility costs of $${data.expenses.utilities.toLocaleString()} are $${Math.abs(utilitiesVariance).toLocaleString()} below budget.`,
      metric: `-$${Math.abs(utilitiesVariance).toLocaleString()}`,
      recommendation: 'Verify all bills have been posted. If savings are real, document energy efficiency initiatives.'
    });
  }

  // R&M Analysis
  const rmVariance = data.expenses.repairsMaint - data.budgets.repairsMaint;
  if (rmVariance < -20000) {
    insights.push({
      id: 'rm-under',
      type: 'neutral',
      title: 'R&M Spending Below Budget',
      description: `Repairs & Maintenance of $${data.expenses.repairsMaint.toLocaleString()} is $${Math.abs(rmVariance).toLocaleString()} under budget.`,
      metric: `-$${Math.abs(rmVariance).toLocaleString()}`,
      recommendation: 'Ensure preventive maintenance is not being deferred. Review capital plan for upcoming needs.'
    });
  }

  // Admin & General Analysis
  const adminVariance = data.expenses.adminGeneral - data.budgets.adminGeneral;
  if (adminVariance < -30000) {
    insights.push({
      id: 'admin-under',
      type: 'positive',
      title: 'Administrative Costs Well Controlled',
      description: `Admin & General expenses are $${Math.abs(adminVariance).toLocaleString()} below budget.`,
      metric: `-$${Math.abs(adminVariance).toLocaleString()}`,
      recommendation: 'Good cost control. Continue monitoring for any deferred expenses.'
    });
  }

  // Reserve Analysis
  const reserveRatio = data.cash.reserves / data.cash.total;
  if (reserveRatio > 0.6) {
    insights.push({
      id: 'reserves-healthy',
      type: 'positive',
      title: 'Healthy Reserve Position',
      description: `Reserves of $${(data.cash.reserves / 1000000).toFixed(2)}M represent ${Math.round(reserveRatio * 100)}% of total cash.`,
      metric: `${Math.round(reserveRatio * 100)}%`,
      recommendation: 'Well positioned for planned capital expenditures and unexpected repairs.'
    });
  }

  return insights;
}

// Mock AI analysis for when OpenAI is not configured
export function generateAISummary(data: MonthlyData): string {
  const variance = data.noi.variance;
  const month = data.month;
  
  if (variance > 50000) {
    return `${month} shows exceptional financial performance with NOI exceeding budget by over $${(variance / 1000).toFixed(0)}K. The favorable variance is driven primarily by controlled operating expenses. Key areas to monitor include legal costs which remain elevated, while utilities show significant savings. Overall liquidity remains strong with adequate reserves for planned capital projects.`;
  } else if (variance > 0) {
    return `${month} delivered positive results with NOI slightly above budget. Operating expenses are generally in line with expectations. Cash position remains healthy with sufficient operating funds and reserve balances. Continue monitoring collection efforts as arrears management shows improvement.`;
  } else {
    return `${month} shows NOI below budget by $${Math.abs(variance / 1000).toFixed(0)}K. Review expense categories for optimization opportunities. Focus areas include utilities and repairs & maintenance. Recommend monthly variance analysis meetings to address emerging trends before year-end close.`;
  }
}
