import { NextResponse } from 'next/server'
import { getMarketSnapshot } from '@/lib/market'

export const revalidate = 60

/** Cached market quotes for the reward roster. Decorative data only. */
export async function GET() {
  const snapshot = await getMarketSnapshot()
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
