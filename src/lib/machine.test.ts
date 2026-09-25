import { describe, it, expect } from 'vitest'
import {
  machines,
  selectPrize,
  oddsOf,
  rarityBreakdown,
  rosterTokens,
  machineByTier,
  machineById,
} from './machine'
import { tokenByAddress, rewardTokens } from './tokens'
import { RARITIES } from './rarity'

/**
 * These cover the part of the frontend that has to agree with the contract.
 * `selectPrize` is a mirror of `BachaGame._selectPrize`; if it drifts, the
 * fairness verifier starts telling people their spin was wrong.
 */
describe('prize selection', () => {
  it('mirrors the contract: exactly one prize for any random word', () => {
    for (const machine of machines) {
      for (const word of [0n, 1n, 4999n, 9999n, 2n ** 250n, 2n ** 256n - 1n]) {
        const { index, prize } = selectPrize(machine, word)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(machine.prizes.length)
        expect(machine.prizes[index]).toBe(prize)
      }
    }
  })

  it('walks the table in published order, exactly at the boundaries', () => {
    const machine = machines[0]
    let cumulative = 0
    machine.prizes.forEach((prize, i) => {
      // The first roll that lands on this entry, and the last one.
      expect(selectPrize(machine, BigInt(cumulative)).index).toBe(i)
      cumulative += prize.weight
      expect(selectPrize(machine, BigInt(cumulative - 1)).index).toBe(i)
    })
    expect(cumulative).toBe(machine.totalWeight)
  })

  it('wraps by total weight, so a huge word is still in range', () => {
    const machine = machines[0]
    const total = BigInt(machine.totalWeight)
    expect(selectPrize(machine, total).index).toBe(selectPrize(machine, 0n).index)
    expect(selectPrize(machine, total * 7n + 3n).index).toBe(selectPrize(machine, 3n).index)
  })

  it('is deterministic — the same word always yields the same prize', () => {
    const machine = machines[0]
    const word = 123456789012345678901234567890n
    const first = selectPrize(machine, word)
    const second = selectPrize(machine, word)
    expect(second.index).toBe(first.index)
    expect(second.prize.amountUnits).toBe(first.prize.amountUnits)
  })
})

describe('published odds', () => {
  it('every machine sums to its recorded total weight', () => {
    for (const machine of machines) {
      const sum = machine.prizes.reduce((total, p) => total + p.weight, 0)
      expect(sum).toBe(machine.totalWeight)
    }
  })

  it('rarity shares add up to 1', () => {
    for (const machine of machines) {
      const total = rarityBreakdown(machine).reduce((sum, s) => sum + s.share, 0)
      expect(total).toBeCloseTo(1, 10)
    }
  })

  it('odds for an asset equal its combined weight share', () => {
    for (const machine of machines) {
      for (const token of rosterTokens()) {
        const weight = machine.prizes
          .filter((p) => p.token.toLowerCase() === token.address.toLowerCase())
          .reduce((sum, p) => sum + p.weight, 0)
        expect(oddsOf(machine, token.address)).toBeCloseTo(weight / machine.totalWeight, 12)
      }
    }
  })

  it('never advertises odds for an asset a machine cannot drop', () => {
    for (const machine of machines) {
      const present = new Set(machine.prizes.map((p) => p.token.toLowerCase()))
      for (const token of rosterTokens()) {
        if (!present.has(token.address.toLowerCase())) {
          expect(oddsOf(machine, token.address)).toBe(0)
        }
      }
    }
  })
})

describe('prize table integrity', () => {
  it('every entry references a verified, reward-enabled token', () => {
    for (const machine of machines) {
      for (const prize of machine.prizes) {
        const token = tokenByAddress(prize.token)
        expect(token, `${prize.token} is not in the registry`).toBeDefined()
        expect(token!.rewardEnabled).toBe(true)
        expect(token!.symbol).toBe(prize.symbol)
      }
    }
  })

  it('amounts are exact base units that match the token decimals', () => {
    for (const machine of machines) {
      for (const prize of machine.prizes) {
        const token = tokenByAddress(prize.token)!
        expect(prize.decimals).toBe(token.decimals)
        // A whole number of base units — never a float.
        expect(prize.amountUnits).toMatch(/^\d+$/)
        expect(BigInt(prize.amountUnits) > 0n).toBe(true)
        // The display amount and the base units describe the same quantity.
        const reconstructed = Number(BigInt(prize.amountUnits)) / 10 ** token.decimals
        expect(reconstructed).toBeCloseTo(prize.amount, 6)
      }
    }
  })

  it('uses a valid rarity everywhere', () => {
    for (const machine of machines) {
      for (const prize of machine.prizes) {
        expect(RARITIES).toContain(prize.rarity)
      }
    }
  })

  it('weights are positive integers', () => {
    for (const machine of machines) {
      for (const prize of machine.prizes) {
        expect(Number.isInteger(prize.weight)).toBe(true)
        expect(prize.weight).toBeGreaterThan(0)
      }
    }
  })
})

describe('machine configuration', () => {
  it('tiers are unique and resolvable both ways', () => {
    const tierIds = machines.map((m) => m.tierId)
    expect(new Set(tierIds).size).toBe(tierIds.length)
    for (const machine of machines) {
      expect(machineByTier(machine.tierId)?.id).toBe(machine.id)
      expect(machineById(machine.id)?.tierId).toBe(machine.tierId)
    }
  })

  it('prices rise with tier and are exact wei', () => {
    const sorted = [...machines].sort((a, b) => a.tierId - b.tierId)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].priceWei > sorted[i - 1].priceWei).toBe(true)
    }
    for (const machine of machines) {
      expect(machine.priceWei > 0n).toBe(true)
      expect(Number(machine.priceWei) / 1e18).toBeCloseTo(machine.priceBnb, 12)
    }
  })

  it('keeps expected value below the spin price, so the machine is sustainable', () => {
    for (const machine of machines) {
      expect(machine.referenceReturnToPlayer).toBeLessThan(1)
      expect(machine.referenceReturnToPlayer).toBeGreaterThan(0.5)
    }
  })

  it('is a single machine', () => {
    // A product decision, not an accident of configuration: with one unit
    // there is no "better deal" to imply and nothing for a player to weigh up.
    // Anything that reintroduces a tier should have to change this line.
    expect(machines).toHaveLength(1)
    expect(machines[0].tierId).toBe(0)
  })

  it('still weights rarer outcomes more heavily as the tier rises', () => {
    // Vacuous while there is one machine. Kept so that reintroducing tiers
    // cannot quietly ship a higher tier with worse odds than a lower one.
    const sorted = [...machines].sort((a, b) => a.tierId - b.tierId)
    for (let i = 1; i < sorted.length; i++) {
      const prevRare = sorted[i - 1].rarityShare[2] + sorted[i - 1].rarityShare[3]
      const thisRare = sorted[i].rarityShare[2] + sorted[i].rarityShare[3]
      expect(thisRare).toBeGreaterThanOrEqual(prevRare)
    }
  })
})

describe('reward roster', () => {
  it('only exposes enabled, reward-enabled tokens', () => {
    for (const token of rosterTokens()) {
      expect(token.enabled).toBe(true)
      expect(token.rewardEnabled).toBe(true)
    }
  })

  it('every reward token is reachable from at least one machine', () => {
    for (const token of rewardTokens()) {
      const reachable = machines.some((m) => oddsOf(m, token.address) > 0)
      expect(reachable, `${token.symbol} is enabled but unreachable`).toBe(true)
    }
  })
})
