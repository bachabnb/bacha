import type { Rarity } from '../rarity'

export type SpinStatus = 'PENDING' | 'SETTLED' | 'CLAIMED' | 'REFUNDED'

/**
 * One spin, in the shape the UI consumes.
 *
 * `mode` is never optional and never inferred at render time. Every surface
 * that shows a spin also shows where it came from, so a simulated result can
 * never be mistaken for a mainnet one.
 */
export interface SpinRecord {
  id: string
  mode: 'onchain' | 'demo'
  player: `0x${string}`
  machineId: string
  tierId: number
  /** Immutable machine version this spin was sold against. */
  machineVersion: string
  prizeTableHash: string
  paymentWei: string
  requestedAt: number
  settledAt: number | null
  requestId: string | null
  randomWord: string | null
  rewardTokenAddress: `0x${string}` | null
  rewardAmountUnits: string | null
  /** Whole token units, for display only. */
  rewardAmount: number | null
  rarity: Rarity | null
  prizeIndex: number | null
  status: SpinStatus
  txHash: string | null
  claimTxHash: string | null
}

export interface SpinFeedResponse {
  mode: 'onchain' | 'demo'
  spins: SpinRecord[]
  total: number
}
