import { NextResponse } from 'next/server'
import { getDemoSpin } from '@/lib/demo/store'
import { getOnchainSpin } from '@/lib/onchain/spins'
import { spinMode } from '@/lib/env'

export const dynamic = 'force-dynamic'

/** Single-spin lookup, used by the fairness verifier. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,20}$/.test(id)) {
    return NextResponse.json({ error: 'A spin id is a number.' }, { status: 400 })
  }

  if (spinMode === 'onchain') {
    try {
      const spin = await getOnchainSpin(id)
      if (!spin) return NextResponse.json({ error: 'No spin with that id was found onchain.' }, { status: 404 })
      return NextResponse.json({ mode: 'onchain', spin })
    } catch {
      return NextResponse.json({ error: 'Could not reach the chain to look that spin up.' }, { status: 502 })
    }
  }

  const spin = getDemoSpin(id)
  if (!spin) return NextResponse.json({ error: 'No demo spin with that id.' }, { status: 404 })
  return NextResponse.json({ mode: 'demo', spin })
}
