import registry from '@data/tokens.json'

export type TokenCategory = string

export interface RewardToken {
  id: string
  name: string
  symbol: string
  /** Canonical BEP-20 contract address. The only identifier used for matching. */
  address: `0x${string}`
  decimals: number
  logo: string
  category: TokenCategory
  blurb: string
  enabled: boolean
  rewardEnabled: boolean
  coingeckoId?: string
  liquidityUsd?: number
  volume24hUsd?: number
  isNativeWrapper?: boolean
  transferNotes?: string
  source: { coingecko?: string; dexscreener?: string; bscscan?: string }
  verifiedAt: string
}

const all = (registry.tokens as unknown as RewardToken[]).map((t) => ({
  ...t,
  address: t.address as `0x${string}`,
}))

export const tokenRegistryVersion = registry.registryVersion
export const registryNotes = registry.notes as string[]

export const allTokens: RewardToken[] = all

/** Tokens an operator has switched on. */
export function enabledTokens(): RewardToken[] {
  return all.filter((t) => t.enabled)
}

/** Tokens eligible to appear in a prize table. */
export function rewardTokens(): RewardToken[] {
  return all.filter((t) => t.enabled && t.rewardEnabled)
}

const byAddress = new Map(all.map((t) => [t.address.toLowerCase(), t]))
const byId = new Map(all.map((t) => [t.id, t]))

/** Address-first lookup. A ticker alone is never enough to identify a token. */
export function tokenByAddress(address: string | undefined | null): RewardToken | undefined {
  if (!address) return undefined
  return byAddress.get(address.toLowerCase())
}

export function tokenById(id: string): RewardToken | undefined {
  return byId.get(id)
}
