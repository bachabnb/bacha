import machineConfig from '@data/machine.json'
import { tokenById, tokenByAddress, type RewardToken } from './tokens'
import { rarityFromIndex, type Rarity } from './rarity'

export interface PrizeEntry {
  tokenId: string
  /** Contract address — the settlement identifier. */
  token: `0x${string}`
  symbol: string
  decimals: number
  /** Whole token units, for display. */
  amount: number
  /** Exact base units, as a decimal string. The number the contract stores. */
  amountUnits: string
  weight: number
  rarity: Rarity
  /** Snapshot value at table-authoring time. Never used for settlement. */
  referenceValueUsd: number
  token_: RewardToken | undefined
}

export interface Machine {
  id: string
  tierId: number
  label: string
  tagline: string
  priceBnb: number
  priceWei: bigint
  referencePriceUsd: number
  totalWeight: number
  localTableHash: string
  /** Share of total weight per rarity, in COMMON → EPIC order. */
  rarityShare: number[]
  expectedValueUsd: number
  referenceReturnToPlayer: number
  prizes: PrizeEntry[]
}

export const machines: Machine[] = machineConfig.machines.map((m) => ({
  id: m.id,
  tierId: m.tierId,
  label: m.label,
  tagline: m.tagline,
  priceBnb: m.priceBnb,
  priceWei: BigInt(m.priceWei),
  referencePriceUsd: m.referencePriceUsd,
  totalWeight: m.totalWeight,
  localTableHash: m.localTableHash,
  rarityShare: m.rarityShare,
  expectedValueUsd: m.expectedValueUsd,
  referenceReturnToPlayer: m.referenceReturnToPlayer,
  prizes: m.prizes.map((p) => ({
    tokenId: p.tokenId,
    token: p.token as `0x${string}`,
    symbol: p.symbol,
    decimals: p.decimals,
    amount: p.amount,
    amountUnits: p.amountUnits,
    weight: p.weight,
    rarity: rarityFromIndex(p.rarity),
    referenceValueUsd: p.valueUsd,
    token_: tokenById(p.tokenId),
  })),
}))

export const machineConfigGeneratedAt = machineConfig.generatedAt

export function machineById(id: string): Machine | undefined {
  return machines.find((m) => m.id === id)
}

export function machineByTier(tierId: number): Machine | undefined {
  return machines.find((m) => m.tierId === tierId)
}

export const defaultMachine = machines[0]

/** Distinct reward assets across every machine, in roster order. */
export function rosterTokens(): RewardToken[] {
  const seen = new Set<string>()
  const out: RewardToken[] = []
  for (const m of machines) {
    for (const p of m.prizes) {
      const key = p.token.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const token = tokenByAddress(p.token)
      if (token) out.push(token)
    }
  }
  return out
}

/** Which machines can drop a given asset, and at what rarity. */
export function machinesContaining(address: string): { machine: Machine; entries: PrizeEntry[] }[] {
  const key = address.toLowerCase()
  return machines
    .map((machine) => ({
      machine,
      entries: machine.prizes.filter((p) => p.token.toLowerCase() === key),
    }))
    .filter((m) => m.entries.length > 0)
}

/** Combined odds of pulling an asset from a machine, as a fraction. */
export function oddsOf(machine: Machine, address: string): number {
  const key = address.toLowerCase()
  const weight = machine.prizes
    .filter((p) => p.token.toLowerCase() === key)
    .reduce((sum, p) => sum + p.weight, 0)
  return weight / machine.totalWeight
}

/**
 * The exact weighted walk the contract performs, mirrored in TypeScript so the
 * fairness page can re-derive a result from a random word without an RPC call.
 * Must stay identical to `BachaGame._selectPrize`.
 */
export function selectPrize(machine: Machine, randomWord: bigint): { index: number; prize: PrizeEntry } {
  const roll = randomWord % BigInt(machine.totalWeight)
  let cumulative = 0n
  for (let i = 0; i < machine.prizes.length; i++) {
    cumulative += BigInt(machine.prizes[i].weight)
    if (roll < cumulative) return { index: i, prize: machine.prizes[i] }
  }
  const last = machine.prizes.length - 1
  return { index: last, prize: machine.prizes[last] }
}

/** Rarity breakdown for the probability bar. */
export function rarityBreakdown(machine: Machine): { rarity: Rarity; share: number }[] {
  return machine.rarityShare.map((share, i) => ({ rarity: rarityFromIndex(i), share }))
}
