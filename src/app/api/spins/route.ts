import { NextResponse } from 'next/server'
import { listDemoSpins } from '@/lib/demo/store'
import { listOnchainSpins } from '@/lib/onchain/spins'
import { spinMode } from '@/lib/env'
import type { SpinFeedResponse } from '@/lib/spin/types'

export const dynamic = 'force-dynamic'

/**
 * The activity feed. Reads settled spins from chain when contracts are
 * configured, and from the demo store otherwise. The response always states
 * which, and the UI always shows it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '40') || 40, 200)
  const playerParam = url.searchParams.get('player')
  const player = playerParam && /^0x[0-9a-fA-F]{40}$/.test(playerParam) ? playerParam : undefined

  if (spinMode === 'onchain') {
    try {
      const { spins, total } = await listOnchainSpins({ limit, player })
      const payload: SpinFeedResponse = { mode: 'onchain', spins, total }
      return NextResponse.json(payload)
    } catch {
      // A failing RPC should show an empty feed with an honest mode, not a
      // silent fallback to simulated data.
      const payload: SpinFeedResponse = { mode: 'onchain', spins: [], total: 0 }
      return NextResponse.json(payload, { status: 200 })
    }
  }

  const { spins, total } = listDemoSpins({ limit, player })
  const payload: SpinFeedResponse = { mode: 'demo', spins, total }
  return NextResponse.json(payload)
}
