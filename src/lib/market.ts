import 'server-only'
import { rewardTokens, tokenByAddress, type RewardToken } from './tokens'
import { serverEnv } from './env'

/**
 * Server-side market data.
 *
 * Two hard rules:
 *   1. Nothing here ever influences an outcome. Prices are decoration on top
 *      of a reward whose token and amount were fixed onchain.
 *   2. A failure here must never stop the machine. Every path degrades to
 *      `null` prices and the game keeps running on verified local config.
 */

export interface MarketQuote {
  address: `0x${string}`
  symbol: string
  priceUsd: number | null
  change24h: number | null
  volume24hUsd: number | null
  updatedAt: number
}

export interface MarketSnapshot {
  quotes: Record<string, MarketQuote>
  /** null when every upstream failed and we're running on local config alone. */
  source: 'coingecko' | 'coingecko-partial' | null
  fetchedAt: number
  stale: boolean
}

const TTL_MS = 60_000
const STALE_SERVE_MS = 15 * 60_000

let cache: MarketSnapshot | null = null
let inflight: Promise<MarketSnapshot> | null = null

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < TTL_MS) return cache
  if (inflight) return inflight

  inflight = fetchSnapshot()
    .then((fresh) => {
      cache = fresh
      return fresh
    })
    .catch(() => {
      // Serve the last good snapshot rather than nothing, up to a point.
      if (cache && now - cache.fetchedAt < STALE_SERVE_MS) {
        return { ...cache, stale: true }
      }
      return emptySnapshot()
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

function emptySnapshot(): MarketSnapshot {
  return { quotes: {}, source: null, fetchedAt: Date.now(), stale: false }
}

async function fetchSnapshot(): Promise<MarketSnapshot> {
  const tokens = rewardTokens()
  const ids = tokens.map((t) => t.coingeckoId).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return emptySnapshot()

  const { coingeckoApiKey } = serverEnv()
  const base = coingeckoApiKey ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3'
  const url =
    `${base}/simple/price?ids=${ids.join(',')}` +
    `&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(coingeckoApiKey ? { 'x-cg-pro-api-key': coingeckoApiKey } : {}),
      },
      signal: controller.signal,
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`coingecko ${res.status}`)

    const body = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number; usd_24h_vol?: number }
    >

    const quotes: Record<string, MarketQuote> = {}
    let matched = 0
    for (const token of tokens) {
      const row = token.coingeckoId ? body[token.coingeckoId] : undefined
      if (row?.usd !== undefined) matched++
      quotes[token.address.toLowerCase()] = {
        address: token.address,
        symbol: token.symbol,
        priceUsd: row?.usd ?? null,
        change24h: row?.usd_24h_change ?? null,
        volume24hUsd: row?.usd_24h_vol ?? null,
        updatedAt: Date.now(),
      }
    }

    return {
      quotes,
      source: matched === tokens.length ? 'coingecko' : 'coingecko-partial',
      fetchedAt: Date.now(),
      stale: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/** Approximate USD value of a reward. Display only — never a settlement input. */
export function valueOf(
  snapshot: MarketSnapshot,
  address: string,
  amount: number,
): number | null {
  const quote = snapshot.quotes[address.toLowerCase()]
  if (!quote || quote.priceUsd === null) return null
  return quote.priceUsd * amount
}

export function quoteFor(snapshot: MarketSnapshot, address: string): MarketQuote | null {
  return snapshot.quotes[address.toLowerCase()] ?? null
}

/** Merges live quotes onto the verified registry for the rewards page. */
export function withMarket(
  snapshot: MarketSnapshot,
): (RewardToken & { quote: MarketQuote | null })[] {
  return rewardTokens().map((token) => ({
    ...token,
    quote: quoteFor(snapshot, token.address),
  }))
}

export { tokenByAddress }
