import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { monthData } = await req.json()

    // Return intelligent mock insights based on the data
    const insights = []

    // NOI Analysis
    if (monthData.noi.variance > 0) {
      insights.push({
        title: 'Strong NOI Performance',
        text: `This month's NOI of $${monthData.noi.actual.toLocaleString()} exceeded budget by $${monthData.noi.variance.toLocaleString()}. This represents a ${Math.round((monthData.noi.variance / Math.abs(monthData.noi.budget || 1)) * 100)}% favorable variance and solid financial management.`,
        type: 'positive'
      })
    } else {
      insights.push({
        title: 'NOI Below Target',
        text: `This month's NOI of $${monthData.noi.actual.toLocaleString()} came in $${Math.abs(monthData.noi.variance).toLocaleString()} below budget. Review expense categories for optimization opportunities.`,
        type: 'warning'
      })
    }

    // Cash Position
    insights.push({
      title: 'Cash Position Analysis',
      text: `Total cash reserves of $${(monthData.cash.total / 1000000).toFixed(2)}M provide approximately ${Math.round(monthData.cash.total / 500000)} months of operating runway. Operating cash of $${(monthData.cash.operating / 1000000).toFixed(2)}M covers near-term obligations.`,
      type: 'neutral'
    })

    // Legal expenses
    const legalOverBudget = monthData.expenses.legal - monthData.budgets.legal
    if (legalOverBudget > 0) {
      insights.push({
        title: 'Legal Expense Alert',
        text: `Legal expenses at $${monthData.expenses.legal.toLocaleString()} exceed budget by $${legalOverBudget.toLocaleString()} (${Math.round((legalOverBudget / monthData.budgets.legal) * 100)}% over). Consider reviewing active cases and alternative dispute resolution options.`,
        type: 'warning'
      })
    } else {
      insights.push({
        title: 'Legal Costs Controlled',
        text: `Legal expenses of $${monthData.expenses.legal.toLocaleString()} are within budget parameters. Continue monitoring active cases to maintain this favorable position.`,
        type: 'positive'
      })
    }

    // Collections recommendation
    insights.push({
      title: 'Collections Recommendation',
      text: `With arrears at $${monthData.arrears.amount.toLocaleString()} and trending ${monthData.arrears.trend}, ${monthData.arrears.trend === 'down' ? 'current collection strategies are working well. Maintain focus on accounts over 60 days.' : 'consider implementing automated payment reminders and early intervention protocols to improve collection rates.'}`,
      type: monthData.arrears.trend === 'down' ? 'positive' : 'recommendation'
    })

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('AI Insights error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate insights',
        insights: [
          {
            title: 'Analysis Unavailable',
            text: 'AI insights are currently unavailable. Please try again later.',
            type: 'neutral'
          }
        ]
      },
      { status: 200 }
    )
  }
}
