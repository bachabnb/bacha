import { NextResponse } from 'next/server'
import { publicClient, gameAddress } from '@/lib/onchain/client'
import { bachaGameAbi } from '@/lib/contracts/abis'
import { spinMode } from '@/lib/env'

/**
 * One published prize table, exactly as the contract stores it.
 *
 * Versions are append-only onchain, so a response never goes stale and is
 * cached hard. The verifier re-derives a spin against the version it was
 * stamped with — which may no longer be the one any tier sells.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (spinMode !== 'onchain' || !gameAddress) return NextResponse.json({ error: 'demo' }, { status: 404 })
  if (!/^\d{1,19}$/.test(id)) return NextResponse.json({ error: 'not-found' }, { status: 400 })

  try {
    const [version, prizes] = await publicClient.readContract({
      address: gameAddress,
      abi: bachaGameAbi,
      functionName: 'getVersion',
      args: [BigInt(id)],
    })
    return NextResponse.json(
      {
        versionId: id,
        totalWeight: version.totalWeight,
        prizeTableHash: version.prizeTableHash,
        publishedAt: Number(version.publishedAt) * 1000,
        prizes: prizes.map((p) => ({
          token: p.token.toLowerCase(),
          amountUnits: p.amount.toString(),
          weight: p.weight,
          rarity: p.rarity,
        })),
      },
      { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    )
  } catch {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
}
