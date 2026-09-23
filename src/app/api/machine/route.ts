import { NextResponse } from 'next/server'
import { machines } from '@/lib/machine'
import { spinMode, publicEnv } from '@/lib/env'

export const revalidate = 300

/**
 * The machine roster the client renders: tiers, prices, prize tables and the
 * odds derived from them. Serialised so odds shown in the UI always come from
 * the same table a spin resolves against.
 */
export async function GET() {
  return NextResponse.json({
    mode: spinMode,
    chainId: publicEnv.chainId,
    machines: machines.map((m) => ({
      id: m.id,
      tierId: m.tierId,
      label: m.label,
      tagline: m.tagline,
      priceBnb: m.priceBnb,
      priceWei: m.priceWei.toString(),
      referencePriceUsd: m.referencePriceUsd,
      totalWeight: m.totalWeight,
      prizeTableHash: m.localTableHash,
      rarityShare: m.rarityShare,
      prizes: m.prizes.map((p) => ({
        token: p.token,
        symbol: p.symbol,
        decimals: p.decimals,
        amount: p.amount,
        amountUnits: p.amountUnits,
        weight: p.weight,
        rarity: p.rarity,
      })),
    })),
  })
}
