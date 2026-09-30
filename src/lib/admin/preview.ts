import { formatEther, parseEther } from 'viem'
import { tokenByAddress } from '../tokens'
import { rarityFromIndex, type Rarity } from '../rarity'

/** One prize as `publishPrizeTable` takes it — the shape of contracts/tables/*.json. */
export interface DraftPrize {
  token: string
  /** BNB, in wei as a decimal string, spent on `token` when this prize is won. */
  value: string
  weight: number
  rarity: number
}

export interface TablePreview {
  valid: boolean
  problems: string[]
  totalWeight: number
  prizeCount: number
  distinctAssets: number
  rarityShare: { rarity: Rarity; share: number }[]
  /** Σ value × weight / totalWeight, in BNB. */
  expectedValueBnb: number
  /** Expected value over the tier price. Null without a price. */
  returnToPlayer: number | null
  /** The biggest single prize — what the contract records as `maxValue`. */
  maxValueWei: string
  /**
   * Free bankroll each pending spin ties up: max(maxValue − price, 0). The
   * payment itself covers the rest of the reserve.
   */
  perSpinBankrollWei: string
}

const UINT96_MAX = (1n << 96n) - 1n

/**
 * Parses a BNB amount typed by an operator into exact wei, or null. Goes
 * through the string, never a float, so `0.0012` is exactly 1.2e15 wei.
 */
export function bnbToWei(input: string): bigint | null {
  const text = input.trim()
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null
  try {
    return parseEther(text)
  } catch {
    return null
  }
}

/** Wei string → BNB number, for display only. */
export function weiToBnb(wei: string | bigint): number {
  try {
    return Number(formatEther(BigInt(wei)))
  } catch {
    return 0
  }
}

/**
 * Validates and previews a draft prize table before it is published.
 *
 * Mirrors every check `BachaGame.publishPrizeTable` performs that can be known
 * off-chain, so an operator finds out here rather than from a reverted
 * transaction. It also computes the table's economics: expected value, payout
 * rate against the tier price, and how much free bankroll every pending spin
 * ties up — the number that decides how many spins the game can accept.
 */
export function previewTable(
  prizes: DraftPrize[],
  opts: { priceWei?: string; maxPrizeValueWei?: string } = {},
): TablePreview {
  const problems: string[] = []

  if (prizes.length === 0) problems.push('A prize table needs at least one entry.')
  if (prizes.length > 64) problems.push('A prize table cannot hold more than 64 entries.')

  const cap = opts.maxPrizeValueWei !== undefined ? BigInt(opts.maxPrizeValueWei) : null

  let totalWeight = 0
  let maxValue = 0n
  const assets = new Set<string>()
  const valued: { value: bigint; weight: number }[] = []

  prizes.forEach((prize, i) => {
    const label = `Entry ${i + 1}`

    if (!/^0x[0-9a-fA-F]{40}$/.test(prize.token)) {
      problems.push(`${label}: not a contract address.`)
      return
    }

    const token = tokenByAddress(prize.token)
    if (!token) {
      problems.push(`${label}: ${prize.token} is not in the verified token registry.`)
      return
    }
    if (!token.rewardEnabled) {
      problems.push(`${label}: ${token.symbol} is not enabled as a reward asset.`)
    }
    if (prize.weight <= 0) problems.push(`${label}: weight must be greater than zero.`)
    if (prize.rarity < 0 || prize.rarity > 3) problems.push(`${label}: rarity must be 0–3.`)

    let value: bigint
    try {
      value = BigInt(prize.value)
    } catch {
      problems.push(`${label}: value is not a whole number of wei.`)
      return
    }
    if (value <= 0n) problems.push(`${label}: value must be greater than zero.`)
    if (value > UINT96_MAX) problems.push(`${label}: value does not fit in a uint96.`)
    if (cap !== null && value > cap) {
      problems.push(`${label}: ${formatEther(value)} BNB exceeds maxPrizeValue (${formatEther(cap)} BNB).`)
    }

    totalWeight += prize.weight
    assets.add(token.address.toLowerCase())
    if (value > maxValue) maxValue = value
    if (prize.weight > 0 && value > 0n) valued.push({ value, weight: prize.weight })
  })

  if (totalWeight > 0xffffffff) problems.push('Total weight does not fit in a uint32.')

  // Exact in wei, then converted once for display.
  const weightedWei = valued.reduce((sum, p) => sum + p.value * BigInt(p.weight), 0n)
  const expectedValueBnb = totalWeight > 0 ? weiToBnb(weightedWei) / totalWeight : 0

  const price = opts.priceWei !== undefined ? BigInt(opts.priceWei) : null
  const priceBnb = price !== null ? weiToBnb(price) : 0
  const returnToPlayer = priceBnb > 0 ? expectedValueBnb / priceBnb : null
  const perSpin = maxValue > (price ?? 0n) ? maxValue - (price ?? 0n) : 0n

  const rarityShare = [0, 1, 2, 3].map((r) => {
    const weight = prizes.filter((p) => p.rarity === r).reduce((sum, p) => sum + p.weight, 0)
    return { rarity: rarityFromIndex(r), share: totalWeight > 0 ? weight / totalWeight : 0 }
  })

  return {
    valid: problems.length === 0,
    problems,
    totalWeight,
    prizeCount: prizes.length,
    distinctAssets: assets.size,
    rarityShare,
    expectedValueBnb,
    returnToPlayer,
    maxValueWei: maxValue.toString(),
    perSpinBankrollWei: perSpin.toString(),
  }
}

/**
 * How many more spins free bankroll (balance − obligations) can back.
 *
 * Null means "not limited by this table": the price already covers the
 * biggest prize, so a spin adds at least as much as it reserves.
 */
export function fundableSpins(perSpinBankrollWei: string, freeWei: string): number | null {
  const per = BigInt(perSpinBankrollWei)
  if (per === 0n) return null
  return Number(BigInt(freeWei) / per)
}
