import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getImportLog } from '@/lib/importLogStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const monthKey = url.searchParams.get('monthKey')
  if (!monthKey) {
    return NextResponse.json({ error: 'monthKey is required' }, { status: 400 })
  }

  const log = await getImportLog(monthKey)
  return NextResponse.json({ monthKey, log })
}

