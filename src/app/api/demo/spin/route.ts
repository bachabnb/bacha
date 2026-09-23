import { NextResponse } from 'next/server'
import { createDemoSpin } from '@/lib/demo/store'
import { spinMode } from '@/lib/env'
import { machineById } from '@/lib/machine'

export const dynamic = 'force-dynamic'

/**
 * Starts a simulated spin. Refuses outright when real contracts are configured
 * so the demo path can never be reached in a live deployment.
 */
export async function POST(request: Request) {
  if (spinMode !== 'demo') {
    return NextResponse.json({ error: 'Demo spins are disabled — this deployment uses live contracts.' }, { status: 409 })
  }

  let body: { machineId?: string; player?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const machineId = typeof body.machineId === 'string' ? body.machineId : ''
  if (!machineById(machineId)) {
    return NextResponse.json({ error: 'Unknown machine.' }, { status: 400 })
  }

  const player = typeof body.player === 'string' && /^0x[0-9a-fA-F]{40}$/.test(body.player)
    ? (body.player.toLowerCase() as `0x${string}`)
    : null
  if (!player) {
    return NextResponse.json({ error: 'A connected wallet address is required.' }, { status: 400 })
  }

  const spin = createDemoSpin(machineId, player)
  return NextResponse.json({ spin })
}
