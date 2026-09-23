import { NextResponse } from 'next/server'
import { latestSettledSpin } from '@/lib/spin/latest'

export const dynamic = 'force-dynamic'

/** The most recent settled spin, so the verifier has something to demonstrate on. */
export async function GET() {
  const spin = await latestSettledSpin()
  if (!spin) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json({ mode: spin.mode, spin })
}
