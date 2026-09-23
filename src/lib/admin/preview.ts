import { tokenByAddress } from '../tokens'
import { rarityFromIndex, type Rarity } from '../rarity'
import { unitsToNumber } from '../format'

export interface DraftPrize {
  token: string
  amountUnits: string
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
  /** Worst-case inventory needed per asset, for a single spin. */
  perSpinLiability: { address: string; symbol: string; amountUnits: string; amount: number }[]
  /** Expected value in token terms, per asset. Never a dollar figure. */
  expectedPerSpin: { symbol: string; amount: number }[]
}

/**
 * Validates and previews a draft prize table before it is published.
 *
 * Mirrors every check `BachaGame.publishPrizeTable` performs, so an operator
 * finds out here rather than from a reverted transaction. It also computes the
 * worst-case inventory requirement — the number that decides how many spins a
 * funded vault can actually honour.
 */
export function previewTable(prizes: DraftPrize[]): TablePreview {
  const problems: string[] = []

  if (prizes.length === 0) problems.push('A prize table needs at least one entry.')
  if (prizes.length > 64) problems.push('A prize table cannot hold more than 64 entries.')

  let totalWeight = 0
  const maxPerToken = new Map<string, bigint>()
  const evPerToken = new Map<string, number>()

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

    let units: bigint
    try {
      units = BigInt(prize.amountUnits)
    } catch {
      problems.push(`${label}: amount is not a whole number of base units.`)
      return
    }
    if (units <= 0n) problems.push(`${label}: amount must be greater than zero.`)

    totalWeight += prize.weight

    const key = token.address.toLowerCase()
    if (units > (maxPerToken.get(key) ?? 0n)) maxPerToken.set(key, units)
  })

  if (totalWeight > 0) {
    for (const prize of prizes) {
      const token = tokenByAddress(prize.token)
      if (!token) continue
      try {
        const amount = unitsToNumber(BigInt(prize.amountUnits), token.decimals)
        evPerToken.set(
          token.symbol,
          (evPerToken.get(token.symbol) ?? 0) + (prize.weight / totalWeight) * amount,
        )
      } catch {
        /* already reported above */
      }
    }
  }

  const rarityShare = [0, 1, 2, 3].map((r) => {
    const weight = prizes.filter((p) => p.rarity === r).reduce((sum, p) => sum + p.weight, 0)
    return { rarity: rarityFromIndex(r), share: totalWeight > 0 ? weight / totalWeight : 0 }
  })

  return {
    valid: problems.length === 0,
    problems,
    totalWeight,
    prizeCount: prizes.length,
    distinctAssets: maxPerToken.size,
    rarityShare,
    perSpinLiability: [...maxPerToken.entries()].map(([address, units]) => {
      const token = tokenByAddress(address)
      return {
        address,
        symbol: token?.symbol ?? address,
        amountUnits: units.toString(),
        amount: token ? unitsToNumber(units, token.decimals) : 0,
      }
    }),
    expectedPerSpin: [...evPerToken.entries()].map(([symbol, amount]) => ({ symbol, amount })),
  }
}

/** How many spins a given inventory can safely honour. */
export function fundableSpins(
  liability: TablePreview['perSpinLiability'],
  balances: Record<string, string>,
): number {
  if (liability.length === 0) return 0
  let min = Number.POSITIVE_INFINITY
  for (const item of liability) {
    const per = BigInt(item.amountUnits)
    if (per === 0n) continue
    const held = BigInt(balances[item.address.toLowerCase()] ?? '0')
    const fits = Number(held / per)
    if (fits < min) min = fits
  }
  return Number.isFinite(min) ? min : 0
}
