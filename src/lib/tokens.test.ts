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

  it('pins every roster address and its decimals to what was verified onchain', () => {
    // The roster is a deliberate selection, and decimals are read from the
    // contract, never assumed — getting either wrong pays out the wrong asset
    // or the wrong amount by orders of magnitude. Changing this table should
    // require the same verification that produced it.
    const verified: Record<string, [`0x${string}`, number]> = {
      spcx: ['0xbe9D156892E55e7154BcD3cB0FEA677F9D3103E1', 18],
      nvda: ['0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436', 18],
      tsla: ['0x5b1910eAaD6450E50f816082Aa078C41F10C292f', 18],
      aapl: ['0x431a3BEE82E2ca41e49895CbECE5bB0F76A89b7A', 18],
      msft: ['0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0', 18],
      googl: ['0x3F53De71c126BdaBAe20f9cD64848d317f6C3238', 18],
    }

    expect(allTokens.map((t) => t.id).sort()).toEqual(Object.keys(verified).sort())

    for (const [id, [address, decimals]] of Object.entries(verified)) {
      const token = tokenById(id)
      expect(token, id).toBeDefined()
      expect(token!.address.toLowerCase(), id).toBe(address.toLowerCase())
      expect(token!.decimals, id).toBe(decimals)
    }
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
