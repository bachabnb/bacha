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
      b2: ['0x783c3f003f172c6Ac5AC700218a357d2D66Ee2a2', 18],
      lobster: ['0xeCCBb861c0dda7eFd964010085488B69317e4444', 18],
      marscoin: ['0xFe189E97832DA1573e4e4Ff034F4fFC3a15c7777', 18],
      mubarak: ['0x5C85D6C6825aB4032337F11Ee92a72DF936b46F6', 18],
      aster: ['0x000Ae314E2A2172a039B26378814C252734f556A', 18],
      giggle: ['0x20d6015660b3fe52e6690a889b5C51F69902cE0e', 18],
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
