import { NextResponse } from 'next/server'
import { settleDemoSpin } from '@/lib/demo/store'
import { spinMode } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (spinMode !== 'demo') {
    return NextResponse.json({ error: 'Demo settlement is disabled on this deployment.' }, { status: 409 })
  }

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const spin = typeof body.id === 'string' ? settleDemoSpin(body.id) : undefined
  if (!spin) return NextResponse.json({ error: 'Unknown spin.' }, { status: 404 })
  return NextResponse.json({ spin })
}
