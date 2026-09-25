#!/usr/bin/env node
/**
 * Builds data/machine.json — the prize table the machine runs on and the
 * starting point an operator would publish onchain.
 *
 * Amounts are authored in whole token units here and converted to exact base
 * units, so nothing downstream ever has to do float maths on a reward.
 *
 * The reference prices below are only used to print expected value while
 * tuning. They are a snapshot, not a settlement input — the contract never
 * sees a price.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const tokens = JSON.parse(await readFile('data/tokens.json', 'utf8')).tokens
const byId = Object.fromEntries(tokens.map((t) => [t.id, t]))

// Snapshot taken 2026-09-25 alongside the address verification, from the same
// DexScreener pairs the roster was selected from. Used only to print expected
// value while tuning — the contract never sees a price.
const refPrice = {
  bnb: 765.59,
  b2: 0.4927, lobster: 0.125, marscoin: 0.1085,
  mubarak: 0.04324, aster: 0.7113, giggle: 40.53,
}

const R = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3 }

/**
 * One machine.
 *
 * There were three tiers; there is now a single unit, so there is no "better
 * deal" to imply and no reason for a player to wonder which one to pick. Every
 * asset on the roster appears in this one table.
 *
 * Amounts are tuned so expected payout sits below the spin price — that margin
 * is what funds inventory. GIGGLE is deliberately a small amount despite its
 * unit price: its 24h turnover is thin, and a reward that cannot be sold near
 * the shown price is not worth what it appears to be.
 *
 * The epic entries are sized against working capital, not just against
 * expected value. The contract reserves the largest entry for *every* asset
 * on *every* pending spin, so the rarest prizes set the capital floor far
 * more than they set the payout: at 1% weight they were ~4% of expected
 * payout but ~64% of the reservation. Halving them buys two-thirds more
 * concurrent spins from the same float for ~1 point of RTP.
 *
 * Halving also moved GIGGLE out of the epic band. At 0.075 it is worth about
 * $3, which is less than the 9.5 B2 rare — an "epic" that pays less than a
 * rare is a lie told by a label, so it sits in the band its value actually
 * belongs to and ASTER carries the epic alone. Weights are redistributed so
 * the published 68/23/8/1 split is unchanged.
 *
 * Bands must stay ordered: every epic amount is worth more than every rare,
 * every rare more than every uncommon, and so on. Reference prices move, so
 * check this after any amount change.
 */
const machines = [
  {
    id: 'bacha', tierId: 0, label: 'BACHA', priceBnb: 0.0039,
    tagline: 'One machine. Six assets. One pull.',
    prizes: [
      ['mubarak', 32, 2600, R.COMMON],
      ['marscoin', 12, 2300, R.COMMON],
      ['lobster', 11, 1900, R.COMMON],

      ['b2', 4.5, 1400, R.UNCOMMON],
      ['lobster', 20, 900, R.UNCOMMON],

      ['aster', 5.5, 450, R.RARE],
      ['b2', 9.5, 280, R.RARE],
      ['giggle', 0.075, 70, R.RARE],

      ['aster', 8, 100, R.EPIC],
    ],
  },
]

/**
 * Whole tokens → exact base units.
 *
 * Deliberately not `toFixed`: past ~15 significant digits it loses precision,
 * so `(1.2).toFixed(18)` yields `1.199999999999999956` and the published prize
 * would be a hair short on every spin. The shortest round-trip string is exact
 * for the value JS actually holds.
 */
function toUnits(amount, decimals) {
  let text = String(amount)
  if (text.includes('e') || text.includes('E')) {
    text = amount.toFixed(Math.max(decimals, 20))
  }
  const [whole = '0', frac = ''] = text.split('.')
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0')).toString()
}

const out = { $generatedBy: 'scripts/build-machine-config.mjs', generatedAt: new Date().toISOString().slice(0, 10), machines: [] }

console.log('')
for (const m of machines) {
  const priceUsd = m.priceBnb * refPrice.bnb
  let totalWeight = 0
  const prizes = m.prizes.map(([id, amount, weight, rarity]) => {
    const token = byId[id]
    if (!token) throw new Error(`unknown token id: ${id}`)
    totalWeight += weight
    return {
      tokenId: id, token: token.address, symbol: token.symbol, decimals: token.decimals,
      amount, amountUnits: toUnits(amount, token.decimals), weight, rarity,
      valueUsd: Number((amount * refPrice[id]).toFixed(4)),
    }
  })

  if (totalWeight !== 10000) throw new Error(`${m.id}: weights sum to ${totalWeight}, expected 10000`)

  const ev = prizes.reduce((sum, p) => sum + (p.weight / totalWeight) * p.valueUsd, 0)
  const rtp = ev / priceUsd

  // Mirrors the contract: keccak over (chainId, gameAddress, versionId, prizes).
  // Address and version are unknown until deploy, so the local hash is scoped
  // to the table contents and labelled as a *local* hash, never a chain hash.
  const canonical = JSON.stringify(prizes.map((p) => [p.token.toLowerCase(), p.amountUnits, p.weight, p.rarity]))
  const localHash = '0x' + createHash('sha256').update(canonical).digest('hex')

  const byRarity = [0, 1, 2, 3].map((r) =>
    prizes.filter((p) => p.rarity === r).reduce((s, p) => s + p.weight, 0) / totalWeight
  )

  out.machines.push({
    id: m.id, tierId: m.tierId, label: m.label, tagline: m.tagline,
    priceBnb: m.priceBnb, priceWei: toUnits(m.priceBnb, 18),
    referencePriceUsd: Number(priceUsd.toFixed(2)),
    totalWeight, localTableHash: localHash,
    rarityShare: byRarity.map((v) => Number(v.toFixed(6))),
    expectedValueUsd: Number(ev.toFixed(4)),
    referenceReturnToPlayer: Number(rtp.toFixed(4)),
    prizes,
  })

  console.log(`${m.label.padEnd(6)} $${priceUsd.toFixed(2).padStart(5)}  EV $${ev.toFixed(3)}  RTP ${(rtp * 100).toFixed(1)}%  ` +
    `C ${(byRarity[0] * 100).toFixed(0)}% U ${(byRarity[1] * 100).toFixed(0)}% R ${(byRarity[2] * 100).toFixed(0)}% E ${(byRarity[3] * 100).toFixed(1)}%`)
}

console.log('')
await writeFile('data/machine.json', JSON.stringify(out, null, 2) + '\n')
console.log('wrote data/machine.json')
