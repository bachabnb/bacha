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

// Snapshot taken 2026-09-30 from the deepest BSC DexScreener pool for each
// asset. Used only to print expected value while tuning — the contract never
// sees a price.
const refPrice = {
  bnb: 769.50,
  spcx: 149.46, nvda: 228.23, tsla: 350.80,
  aapl: 330.06, msft: 509.01, googl: 343.83,
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
 * The table is sized for a launch float of about $100. The contract reserves
 * the largest entry of *every* asset for *every* pending spin, so the sum of
 * per-asset maxima is the capital one concurrent spin ties up — about $13.60
 * here — and the rarest prizes set that floor far more than they set the
 * payout. At ~$2 a spin, every amount is sized so that five spins can be in
 * flight at once from ~$68 of inventory, with the rest of the float left for
 * gas and swap slippage. Spins settle in seconds, so five in flight is a
 * burst limit, not a volume limit, and it lifts as revenue restocks the vault.
 *
 * Every prize is a fixed amount of BNB, spent on the named stock only when
 * the spin that won it settles: the contract swaps it on PancakeSwap straight
 * into the player's wallet. Nothing is stockpiled, so the payout rate is
 * exactly what this table says — the stocks' prices change how many shares a
 * prize buys, never what it costs the house.
 *
 * A pending spin reserves the table's biggest prize, so the epic sets the
 * bankroll one spin in flight needs: the epic minus the spin price.
 *
 * Bands must stay ordered: every epic amount is worth more than every rare,
 * every rare more than every uncommon, and so on. Reference prices move, so
 * check this after any amount change — the build refuses a table whose bands
 * overlap at the reference prices.
 */
const machines = [
  {
    id: 'bacha', tierId: 0, label: 'BACHA', priceBnb: 0.0026,
    tagline: 'One machine. Six stocks. One pull.',
    // [stock, BNB spent on it, weight, rarity]
    prizes: [
      ['nvda', 0.0012, 2600, R.COMMON],
      ['spcx', 0.0012, 2300, R.COMMON],
      ['aapl', 0.0012, 1900, R.COMMON],

      ['tsla', 0.0019, 1400, R.UNCOMMON],
      ['googl', 0.0019, 900, R.UNCOMMON],

      ['msft', 0.0035, 450, R.RARE],
      ['tsla', 0.0039, 280, R.RARE],
      ['spcx', 0.0037, 70, R.RARE],

      ['tsla', 0.006, 100, R.EPIC],
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
  const prizes = m.prizes.map(([id, valueBnb, weight, rarity]) => {
    const token = byId[id]
    if (!token) throw new Error(`unknown token id: ${id}`)
    totalWeight += weight
    const valueUsd = valueBnb * refPrice.bnb
    return {
      tokenId: id, token: token.address, symbol: token.symbol, decimals: token.decimals,
      valueBnb, valueWei: toUnits(valueBnb, 18), weight, rarity,
      valueUsd: Number(valueUsd.toFixed(4)),
      // Shares it buys at the reference price. Display only — the swap decides.
      amount: Number((valueUsd / refPrice[id]).toPrecision(3)),
    }
  })

  if (totalWeight !== 10000) throw new Error(`${m.id}: weights sum to ${totalWeight}, expected 10000`)

  for (let r = 0; r < 3; r++) {
    const top = Math.max(...prizes.filter((p) => p.rarity === r).map((p) => p.valueUsd))
    const next = Math.min(...prizes.filter((p) => p.rarity === r + 1).map((p) => p.valueUsd))
    if (!(top < next)) throw new Error(`${m.id}: rarity ${r} tops out at $${top}, above rarity ${r + 1} starting at $${next}`)
  }

  // What one pending spin needs from the bankroll: the biggest prize, less
  // the payment that arrives with it.
  const maxValueBnb = Math.max(...prizes.map((p) => p.valueBnb))
  const reservationUsd = Math.max(maxValueBnb - m.priceBnb, 0) * refPrice.bnb

  const ev = prizes.reduce((sum, p) => sum + (p.weight / totalWeight) * p.valueUsd, 0)
  const rtp = ev / priceUsd

  // Mirrors the contract: keccak over (chainId, gameAddress, versionId, prizes).
  // Address and version are unknown until deploy, so the local hash is scoped
  // to the table contents and labelled as a *local* hash, never a chain hash.
  const canonical = JSON.stringify(prizes.map((p) => [p.token.toLowerCase(), p.valueWei, p.weight, p.rarity]))
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
    `C ${(byRarity[0] * 100).toFixed(0)}% U ${(byRarity[1] * 100).toFixed(0)}% R ${(byRarity[2] * 100).toFixed(0)}% E ${(byRarity[3] * 100).toFixed(1)}%  ` +
    `needs $${reservationUsd.toFixed(2)} of bankroll per pending spin`)
}

console.log('')
await writeFile('data/machine.json', JSON.stringify(out, null, 2) + '\n')
console.log('wrote data/machine.json')
