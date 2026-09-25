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
  source: 'coingecko' | 'dexscreener' | 'mixed' | 'partial' | null
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

/**
 * Two upstreams, in order of preference.
 *
 * CoinGecko covers listed assets. Most of the roster is not listed there —
 * they were selected from DexScreener pairs in the first place — so anything
 * CoinGecko cannot price is looked up by contract address on DexScreener.
 * Either can fail independently; a token no upstream prices stays `null` and
 * the interface shows a dash rather than inventing a number.
 */
async function fetchSnapshot(): Promise<MarketSnapshot> {
  const tokens = rewardTokens()
  if (tokens.length === 0) return emptySnapshot()

  const quotes: Record<string, MarketQuote> = {}
  for (const token of tokens) {
    quotes[token.address.toLowerCase()] = {
      address: token.address,
      symbol: token.symbol,
      priceUsd: null,
      change24h: null,
      volume24hUsd: null,
      updatedAt: Date.now(),
    }
  }

  const fromGecko = await fromCoinGecko(tokens, quotes)

  const unpriced = tokens.filter((t) => quotes[t.address.toLowerCase()].priceUsd === null)
  const fromDex = unpriced.length > 0 ? await fromDexScreener(unpriced, quotes) : 0

  const priced = Object.values(quotes).filter((q) => q.priceUsd !== null).length
  const source =
    priced === 0
      ? null
      : priced < tokens.length
        ? 'partial'
        : fromGecko > 0 && fromDex > 0
          ? 'mixed'
          : fromDex > 0
            ? 'dexscreener'
            : 'coingecko'

  return { quotes, source, fetchedAt: Date.now(), stale: false }
}

/** @returns how many tokens this upstream priced. */
async function fromCoinGecko(
  tokens: RewardToken[],
  quotes: Record<string, MarketQuote>,
): Promise<number> {
  const ids = tokens.map((t) => t.coingeckoId).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return 0

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

    let matched = 0
    for (const token of tokens) {
      const row = token.coingeckoId ? body[token.coingeckoId] : undefined
      if (row?.usd === undefined) continue
      matched++
      quotes[token.address.toLowerCase()] = {
        address: token.address,
        symbol: token.symbol,
        priceUsd: row.usd,
        change24h: row.usd_24h_change ?? null,
        volume24hUsd: row.usd_24h_vol ?? null,
        updatedAt: Date.now(),
      }
    }
    return matched
  } catch {
    // One upstream being down is not a reason to drop the other's answers.
    return 0
  } finally {
    clearTimeout(timeout)
  }
}

interface DexPair {
  baseToken?: { address?: string }
  priceUsd?: string
  priceChange?: { h24?: number }
  volume?: { h24?: number }
  liquidity?: { usd?: number }
}

/**
 * Prices by contract address.
 *
 * A token trades in several pairs; the deepest one is the least
 * manipulable, so that is the quote taken.
 *
 * @returns how many tokens this upstream priced.
 */
async function fromDexScreener(
  tokens: RewardToken[],
  quotes: Record<string, MarketQuote>,
): Promise<number> {
  // The endpoint accepts a comma-separated list, capped at 30 addresses.
  const batch = tokens.slice(0, 30).map((t) => t.address).join(',')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`dexscreener ${res.status}`)

    const body = (await res.json()) as { pairs?: DexPair[] | null }
    const deepest = new Map<string, DexPair>()
    for (const pair of body.pairs ?? []) {
      const address = pair.baseToken?.address?.toLowerCase()
      if (!address || !quotes[address]) continue
      const best = deepest.get(address)
      if (!best || (pair.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0)) {
        deepest.set(address, pair)
      }
    }

    let matched = 0
    for (const token of tokens) {
      const address = token.address.toLowerCase()
      const pair = deepest.get(address)
      const price = pair?.priceUsd ? Number(pair.priceUsd) : NaN
      if (!Number.isFinite(price) || price <= 0) continue
      matched++
      quotes[address] = {
        address: token.address,
        symbol: token.symbol,
        priceUsd: price,
        change24h: pair?.priceChange?.h24 ?? null,
        volume24hUsd: pair?.volume?.h24 ?? null,
        updatedAt: Date.now(),
      }
    }
    return matched
  } catch {
    return 0
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
