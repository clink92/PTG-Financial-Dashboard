import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getMonthData, getTrendData } from '@/lib/monthDataService'
import { deleteStoredMonthData, listStoredMonthKeys } from '@/lib/monthStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isImportRole(role?: string | null) {
  return role === 'admin' || role === 'manager'
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const monthKey = url.searchParams.get('monthKey')
  const months = url.searchParams.get('months')

  if (monthKey) {
    const data = await getMonthData(monthKey)
    // Treat missing data as an empty state instead of an error to avoid noisy 404s in the UI.
    return NextResponse.json({ data: data ?? null })
  }

  if (months) {
    const keys = months
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const data = await getTrendData(keys)
    return NextResponse.json({ data })
  }

  const keys = await listStoredMonthKeys()
  return NextResponse.json({ keys })
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isImportRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const monthKey = url.searchParams.get('monthKey')
  if (!monthKey) {
    return NextResponse.json({ error: 'monthKey is required' }, { status: 400 })
  }

  await deleteStoredMonthData(monthKey)
  return NextResponse.json({ ok: true, monthKey })
}
