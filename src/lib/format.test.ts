import { describe, it, expect } from 'vitest'
import {
  unitsToNumber,
  numberToUnits,
  formatTokenAmount,
  formatUsd,
  formatPercent,
  shortAddress,
  shortHash,
  formatBnb,
} from './format'

describe('base-unit conversion', () => {
  it('round-trips a whole-token amount exactly', () => {
    expect(numberToUnits(1.2, 18).toString()).toBe('1200000000000000000')
    expect(unitsToNumber(1200000000000000000n, 18)).toBeCloseTo(1.2, 12)
  })

  it('handles 9-decimal assets, where a wrong assumption is expensive', () => {
    const units = numberToUnits(2_500_000_000, 9)
    expect(units.toString()).toBe('2500000000000000000')
    expect(unitsToNumber(units, 9)).toBeCloseTo(2_500_000_000, 0)
  })

  it('truncates rather than rounding up, so a prize is never overstated', () => {
    expect(numberToUnits(1.999999999999999999999, 2).toString()).toBe('200')
    expect(numberToUnits(0.00049, 3).toString()).toBe('0')
  })

  it('refuses nonsense input instead of producing a bogus amount', () => {
    expect(numberToUnits(0, 18)).toBe(0n)
    expect(numberToUnits(-5, 18)).toBe(0n)
    expect(numberToUnits(Number.NaN, 18)).toBe(0n)
    expect(numberToUnits(Number.POSITIVE_INFINITY, 18)).toBe(0n)
  })

  it('handles zero-decimal tokens', () => {
    expect(numberToUnits(7, 0).toString()).toBe('7')
    expect(unitsToNumber(7n, 0)).toBe(7)
  })
})

describe('display formatting', () => {
  it('scales token amounts to something readable', () => {
    expect(formatTokenAmount(2_500_000_000, 'BABYDOGE')).toBe('2.50B BABYDOGE')
    expect(formatTokenAmount(1_500_000)).toBe('1.50M')
    expect(formatTokenAmount(0.82, 'CAKE')).toBe('0.82 CAKE')
    expect(formatTokenAmount(0)).toBe('0')
  })

  it('keeps tiny amounts legible rather than rounding them to zero', () => {
    expect(formatTokenAmount(0.0001)).not.toBe('0')
    expect(formatTokenAmount(0.0001)).toContain('0.0001')
  })

  it('marks approximate values as approximate', () => {
    expect(formatUsd(2.08, { approx: true })).toBe('≈ $2.08')
    expect(formatUsd(2.08)).toBe('$2.08')
  })

  it('shows an em dash rather than a fake zero when a price is unknown', () => {
    expect(formatUsd(null)).toBe('—')
    expect(formatUsd(undefined)).toBe('—')
    expect(formatUsd(Number.NaN)).toBe('—')
    expect(formatTokenAmount(Number.NaN)).toBe('—')
  })

  it('gives small percentages enough precision to stay distinct', () => {
    expect(formatPercent(0.68)).toBe('68.0%')
    expect(formatPercent(0.01)).toBe('1.00%')
    expect(formatPercent(0.003)).toBe('0.30%')
    expect(formatPercent(0.0001)).not.toBe('0.00%')
  })
})

describe('truncation', () => {
  it('shortens addresses and hashes without losing the ends', () => {
    const address = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d'
    expect(shortAddress(address)).toBe('0x8d0D…8B0d')
    expect(shortAddress(address, 6, 6)).toBe('0x8d0D00…f08B0d')
    expect(shortHash('0xdeadbeefcafebabe')).toBe('0xdeadbe…babe')
  })

  it('leaves already-short values alone', () => {
    expect(shortAddress('0x1234')).toBe('0x1234')
  })
})

describe('BNB amounts', () => {
  it('trims trailing zeros so a price reads cleanly', () => {
    expect(formatBnb(2600000000000000n)).toBe('0.0026')
    expect(formatBnb(1000000000000000000n)).toBe('1')
  })
})
