#!/usr/bin/env node
/**
 * Builds data/machine.json — the prize tables the demo machine runs on and the
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

// Snapshot taken 2026-09-24 alongside the address verification.
const refPrice = {
  bnb: 765.59, aster: 0.6904, cake: 2.55, mubarak: 0.05391, form: 0.2833,
  twt: 0.5354, babydoge: 3.95242e-10, lista: 0.07858, xvs: 3.2, usd1: 0.9995,
}

const R = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3 }

const machines = [
  {
    id: 'quick', tierId: 0, label: 'QUICK', priceBnb: 0.0026,
    tagline: 'One pull, low stakes.',
    prizes: [
      ['usd1', 1.2, 2600, R.COMMON], ['mubarak', 20, 2200, R.COMMON], ['babydoge', 2_500_000_000, 2000, R.COMMON],
      ['cake', 0.8, 900, R.UNCOMMON], ['twt', 3.6, 800, R.UNCOMMON], ['form', 7, 600, R.UNCOMMON],
      ['aster', 7, 500, R.RARE], ['xvs', 1.5, 300, R.RARE],
      ['bnb', 0.03, 100, R.EPIC],
    ],
  },
  {
    id: 'boost', tierId: 1, label: 'BOOST', priceBnb: 0.0039,
    tagline: 'Better odds on the deep end.',
    prizes: [
      ['usd1', 1.6, 2400, R.COMMON], ['mubarak', 29, 2000, R.COMMON], ['babydoge', 3_400_000_000, 1900, R.COMMON],
      ['cake', 1.12, 1000, R.UNCOMMON], ['twt', 5, 850, R.UNCOMMON], ['form', 10, 650, R.UNCOMMON],
      ['aster', 10, 600, R.RARE], ['xvs', 2.15, 400, R.RARE], ['lista', 63, 100, R.RARE],
      ['bnb', 0.045, 100, R.EPIC],
    ],
  },
  {
    id: 'max', tierId: 2, label: 'MAX', priceBnb: 0.0065,
    tagline: 'Every rare on the roster, at the best weight.',
    prizes: [
      ['usd1', 2.4, 2200, R.COMMON], ['mubarak', 44, 1900, R.COMMON], ['babydoge', 5_200_000_000, 1700, R.COMMON],
      ['cake', 1.7, 1100, R.UNCOMMON], ['twt', 7.6, 900, R.UNCOMMON], ['form', 15, 700, R.UNCOMMON],
      ['aster', 15.4, 700, R.RARE], ['xvs', 3.3, 450, R.RARE], ['lista', 101, 200, R.RARE],
      ['bnb', 0.069, 120, R.EPIC], ['cake', 9.7, 30, R.EPIC],
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
