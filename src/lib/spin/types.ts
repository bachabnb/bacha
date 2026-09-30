import type { Rarity } from '../rarity'

/**
 * PENDING  — paid, waiting on randomness
 * SETTLED  — prize decided, not yet bought for the player
 * CLAIMED  — prize bought and delivered to the player's wallet
 * PAID_BNB — the player took the prize's value in BNB instead
 * REFUNDED — randomness never came; the payment went back
 */
export type SpinStatus = 'PENDING' | 'SETTLED' | 'CLAIMED' | 'PAID_BNB' | 'REFUNDED'

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
  /** BNB, in wei, the prize is worth — what the contract pays out. */
  rewardValueWei?: string | null
  /**
   * Token base units the player received. Exact once delivered; before that,
   * an estimate at the current price (see `rewardAmountExact`).
   */
  rewardAmountUnits: string | null
  /** Whole token units, for display only. */
  rewardAmount: number | null
  /** True once the prize was delivered and `rewardAmount` is what arrived. */
  rewardAmountExact?: boolean
  rarity: Rarity | null
  prizeIndex: number | null
  status: SpinStatus
  /** When a still-pending spin can be refunded (ms). Onchain only. */
  refundableAt?: number | null
  txHash: string | null
  claimTxHash: string | null
}

export interface SpinFeedResponse {
  mode: 'onchain' | 'demo'
  spins: SpinRecord[]
  total: number
}
