import machineConfig from '@data/machine.json'
import { tokenById, tokenByAddress, type RewardToken } from './tokens'
import { rarityFromIndex, type Rarity } from './rarity'

export interface PrizeEntry {
  tokenId: string
  /** Contract address — the settlement identifier. */
  token: `0x${string}`
  symbol: string
  decimals: number
  /**
   * BNB, in wei as a decimal string, spent on this token when the prize is
   * won. The number the contract stores — the prize *is* this value.
   */
  valueWei: string
  /** `valueWei` in BNB, for display. */
  valueBnb: number
  /**
   * Shares the value buys at the reference (or live) price. Display only: the
   * swap at delivery decides the real amount.
   */
  amount: number
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
  /** False when the contract has the tier switched off (or never configured it). */
  active: boolean
  /**
   * `onchain` — price and prizes were read from the tier's live version.
   * `config`  — taken from data/machine.json (demo mode, or the chain could
   *             not be read). Never presented as the live table.
   */
  source: 'onchain' | 'config'
  /** The prize table version the tier currently sells. Onchain only. */
  versionId: string | null
}

/** Wire form: bigints as strings, registry objects dropped (rehydrated by address). */
export type SerializedMachine = Omit<Machine, 'priceWei' | 'prizes'> & {
  priceWei: string
  prizes: Omit<PrizeEntry, 'token_'>[]
}

export function serializeMachine(m: Machine): SerializedMachine {
  return { ...m, priceWei: m.priceWei.toString(), prizes: m.prizes.map(({ token_: _, ...p }) => p) }
}

export function deserializeMachine(m: SerializedMachine): Machine {
  return {
    ...m,
    priceWei: BigInt(m.priceWei),
    prizes: m.prizes.map((p) => ({ ...p, token_: tokenByAddress(p.token) })),
  }
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
    valueWei: p.valueWei,
    valueBnb: p.valueBnb,
    amount: p.amount,
    weight: p.weight,
    rarity: rarityFromIndex(p.rarity),
    referenceValueUsd: p.valueUsd,
    token_: tokenById(p.tokenId),
  })),
  active: true,
  source: 'config' as const,
  versionId: null,
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

/** The BNB/USD rate a machine's reference prices were built at. */
export function bnbUsdOf(machine: Machine): number {
  return machine.priceBnb > 0 ? machine.referencePriceUsd / machine.priceBnb : 0
}
