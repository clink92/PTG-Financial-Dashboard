import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { monthData } = await req.json()

    // Return intelligent mock insights based on the data
    const insights = []

    const noi = monthData?.noi
    const cash = monthData?.cash
    const receivables = monthData?.receivables

    // NOI Analysis (only if variance exists)
    if (typeof noi?.variance === 'number' && noi.variance > 0) {
      insights.push({
        title: 'Strong NOI Performance',
        text: `This month's NOI exceeded budget by $${noi.variance.toLocaleString()}.`,
        type: 'positive'
      })
    } else if (typeof noi?.variance === 'number') {
      insights.push({
        title: 'NOI Below Target',
        text: `This month's NOI came in $${Math.abs(noi.variance).toLocaleString()} below budget.`,
        type: 'warning'
      })
    } else {
      insights.push({
        title: 'NOI Not Available',
        text: 'NOI could not be extracted from the uploaded PDFs for this month.',
        type: 'neutral'
      })
    }

    // Cash Position
    if (typeof cash?.total === 'number') {
      insights.push({
        title: 'Cash Position',
        text: `Total cash and cash equivalents: $${cash.total.toLocaleString()}.`,
        type: 'neutral'
      })
    }

    if (typeof receivables?.total === 'number') {
      insights.push({
        title: 'Accounts Receivable (A/R)',
        text: `Total A/R: $${receivables.total.toLocaleString()} (from aging summary).`,
        type: receivables.total > 100000 ? 'warning' : 'neutral'
      })
    }

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
