import { NextResponse } from 'next/server'
import { getDemoSpin, listDemoSpins } from '@/lib/demo/store'
import { getOnchainSpin, listOnchainSpins } from '@/lib/onchain/spins'
import { spinMode } from '@/lib/env'
import type { SpinRecord } from '@/lib/spin/types'

export const dynamic = 'force-dynamic'

/**
 * Single-spin lookup for the fairness verifier.
 *
 * Accepts either a spin id or a transaction hash, because those are the two
 * things a person actually has to hand — an id from the result card, or a
 * hash from their wallet history.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const query = decodeURIComponent(id).trim()

  const isId = /^\d{1,20}$/.test(query)
  const isHash = /^0x[0-9a-fA-F]{64}$/.test(query)

  if (!isId && !isHash) {
    return NextResponse.json({ error: 'not-found' }, { status: 400 })
  }

  try {
    const spin = spinMode === 'onchain' ? await findOnchain(query, isId) : findDemo(query, isId)
    if (!spin) return NextResponse.json({ error: 'not-found' }, { status: 404 })
    return NextResponse.json({ mode: spin.mode, spin })
  } catch {
    return NextResponse.json({ error: 'unreachable' }, { status: 502 })
  }
}

async function findOnchain(query: string, isId: boolean): Promise<SpinRecord | null> {
  if (isId) return getOnchainSpin(query)
  const { spins } = await listOnchainSpins({ limit: 200 })
  return matchByHash(spins, query)
}

function findDemo(query: string, isId: boolean): SpinRecord | null {
  if (isId) return getDemoSpin(query) ?? null
  const { spins } = listDemoSpins({ limit: 200 })
  return matchByHash(spins, query)
}

function matchByHash(spins: SpinRecord[], hash: string): SpinRecord | null {
  const needle = hash.toLowerCase()
  return (
    spins.find(
      (s) => s.txHash?.toLowerCase() === needle || s.claimTxHash?.toLowerCase() === needle,
    ) ?? null
  )
}
