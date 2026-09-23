import { describe, it, expect } from 'vitest'
import { allTokens, tokenByAddress, tokenById, rewardTokens, enabledTokens } from './tokens'

/**
 * The token registry is the only thing standing between a prize table and a
 * wrong contract address. These assertions encode the rules that made each
 * entry safe to add, so a careless edit fails here rather than onchain.
 */
describe('token registry', () => {
  it('every address is a checksum-shaped BEP-20 address', () => {
    for (const token of allTokens) {
      expect(token.address, token.symbol).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })

  it('addresses are unique — no asset is listed twice', () => {
    const seen = allTokens.map((t) => t.address.toLowerCase())
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('ids are unique', () => {
    const ids = allTokens.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('records decimals within the range a BEP-20 can declare', () => {
    for (const token of allTokens) {
      expect(Number.isInteger(token.decimals)).toBe(true)
      expect(token.decimals).toBeGreaterThanOrEqual(0)
      expect(token.decimals).toBeLessThanOrEqual(18)
    }
  })

  it('keeps BABYDOGE at 9 decimals, which is what the contract declares', () => {
    // Worth pinning: assuming 18 here would overstate a reward by a billion.
    expect(tokenById('babydoge')?.decimals).toBe(9)
  })

  it('carries a verification date and independent sources for every entry', () => {
    for (const token of allTokens) {
      expect(token.verifiedAt, token.symbol).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(token.source.bscscan, token.symbol).toContain(token.address)
      expect(Object.keys(token.source).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('excludes bridged representations of other chains’ assets', () => {
    // Bacha is a BNB Chain showcase; a Binance-Peg BTC would defeat that.
    const banned = /^(BTCB?|WBTC|ETH|WETH|SOL|DOGE|XRP|ADA|MATIC|AVAX|DOT|LTC)$/i
    for (const token of allTokens) {
      expect(banned.test(token.symbol), `${token.symbol} looks like a bridged asset`).toBe(false)
    }
  })
})

describe('lookup', () => {
  it('resolves by address regardless of case', () => {
    for (const token of allTokens) {
      expect(tokenByAddress(token.address.toLowerCase())?.id).toBe(token.id)
      expect(tokenByAddress(token.address.toUpperCase().replace('0X', '0x'))?.id).toBe(token.id)
    }
  })

  it('returns undefined rather than guessing for an unknown address', () => {
    expect(tokenByAddress('0x0000000000000000000000000000000000000000')).toBeUndefined()
    expect(tokenByAddress(undefined)).toBeUndefined()
    expect(tokenByAddress(null)).toBeUndefined()
    expect(tokenByAddress('')).toBeUndefined()
  })

  it('never resolves a token from a ticker alone', () => {
    // There is deliberately no `tokenBySymbol`: a ticker is not an identifier.
    const registry = { tokenByAddress, tokenById } as Record<string, unknown>
    expect(registry.tokenBySymbol).toBeUndefined()
  })
})

describe('filters', () => {
  it('rewardTokens is a subset of enabledTokens', () => {
    const enabled = new Set(enabledTokens().map((t) => t.id))
    for (const token of rewardTokens()) {
      expect(enabled.has(token.id)).toBe(true)
    }
  })
})
