#!/usr/bin/env node
/**
 * The Bacha solvency governor.
 *
 * THE PROBLEM IT EXISTS FOR
 *
 * A prize is a fixed number of tokens. A spin costs a fixed amount of BNB.
 * Return-to-player is therefore not a constant — it is the ratio of two
 * baskets that move independently, and the table is only "62% RTP" at the
 * prices it was built from.
 *
 * Measured on the current table: if the reward roster gains 62% against BNB,
 * RTP reaches 100% and the machine stops making money on every spin. Past
 * that it bleeds. Over 10k simulated spins with memecoin-grade volatility,
 * leaving amounts fixed stalled the machine in 0.8% of runs and let RTP run
 * to 119% in the worst 5%. Retuning weekly took stalls to 0% and capped the
 * worst case near 90%.
 *
 * WHAT IT DOES
 *
 * Reads live prices, measures the RTP the published table is actually paying,
 * and when that leaves the allowed band, republishes the same table with every
 * amount scaled by one factor and repoints the tier at the new version.
 *
 * Scaling uniformly is deliberate: it holds the weights, the rarity split and
 * the ordering of the bands exactly as published, so the only thing that moves
 * is size. A spin already in flight keeps the version it was stamped with, so
 * retuning can never reach a spin that has already been paid for.
 *
 * THE KEY THIS NEEDS
 *
 * OPERATOR_ROLE, which is a bigger privilege than the treasury worker's. Set
 * `prizeCeiling` on the game for every asset before running this: it is the
 * limit the operator key cannot cross, and it is what stops a stolen key
 * publishing a table whose top prize is the whole vault. The governor refuses
 * to run against assets with no ceiling unless --no-ceiling-check is passed.
 *
 * Environment:
 *   BACHA_RPC_URL, BACHA_GAME_ADDRESS
 *   BACHA_OPERATOR_KEY           hot key holding OPERATOR_ROLE
 * Optional:
 *   BACHA_TARGET_RTP             retune to this (default 0.62)
 *   BACHA_RTP_FLOOR              act below this (default 0.55)
 *   BACHA_RTP_CEILING            act above this (default 0.70)
 *   BACHA_GOVERNOR_POLL_MS       default 3600000 (hourly)
 *
 * Usage:
 *   node scripts/solvency-governor.mjs           # dry run, prints the verdict
 *   node scripts/solvency-governor.mjs --live
 */
import { readFile } from 'node:fs/promises'
import { createPublicClient, createWalletClient, http, formatUnits, getAddress, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bsc, bscTestnet } from 'viem/chains'

const argv = new Set(process.argv.slice(2))
const LIVE = argv.has('--live')
const ONCE = argv.has('--once')
const SKIP_CEILING_CHECK = argv.has('--no-ceiling-check')

const RPC = process.env.BACHA_RPC_URL
const GAME = process.env.BACHA_GAME_ADDRESS
const KEY = process.env.BACHA_OPERATOR_KEY

const TARGET = Number(process.env.BACHA_TARGET_RTP ?? 0.62)
const FLOOR = Number(process.env.BACHA_RTP_FLOOR ?? 0.55)
const CEILING = Number(process.env.BACHA_RTP_CEILING ?? 0.7)
const POLL_MS = Number(process.env.BACHA_GOVERNOR_POLL_MS ?? 3_600_000)

if (!RPC || !GAME || !KEY) {
  console.error('missing environment: BACHA_RPC_URL, BACHA_GAME_ADDRESS and BACHA_OPERATOR_KEY are all required')
  process.exit(1)
}
if (!(FLOOR < TARGET && TARGET < CEILING && CEILING < 1)) {
  console.error(`invalid band: need floor < target < ceiling < 1, got ${FLOOR} / ${TARGET} / ${CEILING}`)
  process.exit(1)
}

const gameAbi = [
  { type: 'function', name: 'tierIds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8[]' }] },
  { type: 'function', name: 'getTier', stateMutability: 'view', inputs: [{ name: 'tierId', type: 'uint8' }], outputs: [{ type: 'tuple', components: [{ name: 'exists', type: 'bool' }, { name: 'active', type: 'bool' }, { name: 'price', type: 'uint96' }, { name: 'versionId', type: 'uint64' }, { name: 'label', type: 'string' }] }] },
  { type: 'function', name: 'prizeCeiling', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'getVersion', stateMutability: 'view', inputs: [{ name: 'versionId', type: 'uint64' }],
    outputs: [
      { name: 'version', type: 'tuple', components: [{ name: 'published', type: 'bool' }, { name: 'totalWeight', type: 'uint32' }, { name: 'prizeTableHash', type: 'bytes32' }, { name: 'publishedAt', type: 'uint64' }] },
      { name: 'prizes', type: 'tuple[]', components: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint128' }, { name: 'weight', type: 'uint32' }, { name: 'rarity', type: 'uint8' }] },
      { name: 'tokens', type: 'address[]' },
    ],
  },
  { type: 'function', name: 'publishPrizeTable', stateMutability: 'nonpayable', inputs: [{ name: 'prizes', type: 'tuple[]', components: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint128' }, { name: 'weight', type: 'uint32' }, { name: 'rarity', type: 'uint8' }] }], outputs: [{ type: 'uint64' }] },
  { type: 'function', name: 'configureTier', stateMutability: 'nonpayable', inputs: [{ name: 'tierId', type: 'uint8' }, { name: 'label', type: 'string' }, { name: 'price', type: 'uint96' }, { name: 'versionId', type: 'uint64' }, { name: 'active', type: 'bool' }], outputs: [] },
]

const account = privateKeyToAccount(KEY.startsWith('0x') ? KEY : `0x${KEY}`)
const publicClient = createPublicClient({ transport: http(RPC) })
const chainId = await publicClient.getChainId()
const wallet = createWalletClient({ account, chain: chainId === 97 ? bscTestnet : bsc, transport: http(RPC) })
const game = getAddress(GAME)

const read = (functionName, args = []) => publicClient.readContract({ address: game, abi: gameAbi, functionName, args })

async function send(functionName, args) {
  if (!LIVE) return { hash: '(dry run)', result: null }
  const { request, result } = await publicClient.simulateContract({ address: game, abi: gameAbi, functionName, args, account })
  const hash = await wallet.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted (${hash})`)
  return { hash, result }
}

/* ------------------------------------------------------------------ prices */

const registry = JSON.parse(await readFile('data/tokens.json', 'utf8')).tokens
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'

/**
 * Live USD prices by contract address, deepest pair wins.
 *
 * These decide how big a prize is, never which prize is won — the contract
 * has no price input and this never touches settlement.
 */
async function livePrices(addresses) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`dexscreener ${res.status}`)
  const body = await res.json()
  const deepest = new Map()
  for (const pair of body.pairs ?? []) {
    const address = pair.baseToken?.address?.toLowerCase()
    if (!address) continue
    const best = deepest.get(address)
    if (!best || (pair.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0)) deepest.set(address, pair)
  }
  const out = {}
  for (const [address, pair] of deepest) {
    const price = Number(pair.priceUsd)
    if (Number.isFinite(price) && price > 0) out[address] = price
  }
  return out
}

/* -------------------------------------------------------------------- tick */

async function tick() {
  const tiers = await read('tierIds')
  let tier = null
  let tierId = null
  for (const id of tiers) {
    const t = await read('getTier', [id])
    if (t.exists && t.active) { tier = t; tierId = id; break }
  }
  if (!tier) { console.log('no active tier — nothing to govern'); return }

  const [, prizes] = await read('getVersion', [tier.versionId])
  const addresses = [...new Set(prizes.map((p) => p.token.toLowerCase()))]
  const prices = await livePrices([...addresses, WBNB])

  const bnbPrice = prices[WBNB.toLowerCase()]
  if (!bnbPrice) { console.warn('no BNB price — skipping this pass rather than guessing'); return }

  const decimalsOf = (address) =>
    registry.find((t) => t.address.toLowerCase() === address.toLowerCase())?.decimals ?? 18

  // Any asset we cannot price makes the RTP measurement wrong, and acting on a
  // wrong measurement is worse than not acting.
  const missing = addresses.filter((a) => !prices[a])
  if (missing.length > 0) {
    console.warn(`no price for ${missing.join(', ')} — skipping this pass`)
    return
  }

  const spinUsd = Number(formatUnits(tier.price, 18)) * bnbPrice
  const totalWeight = prizes.reduce((s, p) => s + Number(p.weight), 0)
  const ev = prizes.reduce((s, p) => {
    const amount = Number(formatUnits(p.amount, decimalsOf(p.token)))
    return s + (Number(p.weight) / totalWeight) * amount * prices[p.token.toLowerCase()]
  }, 0)
  const rtp = ev / spinUsd

  console.log(`spin $${spinUsd.toFixed(2)}  expected payout $${ev.toFixed(3)}  RTP ${(rtp * 100).toFixed(1)}%  band ${(FLOOR * 100).toFixed(0)}-${(CEILING * 100).toFixed(0)}%`)

  if (rtp >= FLOOR && rtp <= CEILING) {
    console.log('inside the band — leaving the table alone')
    return
  }

  const scale = TARGET / rtp
  console.log(`${rtp > CEILING ? 'above' : 'below'} the band — scaling every amount by ${scale.toFixed(4)} to reach ${(TARGET * 100).toFixed(0)}%`)

  // One factor across every entry: weights, rarity split and band ordering all
  // stay exactly as published. Only size moves.
  const retuned = []
  for (const p of prizes) {
    const decimals = decimalsOf(p.token)
    const current = Number(formatUnits(p.amount, decimals))
    const next = current * scale
    let amount = parseUnits(next.toFixed(decimals), decimals)
    if (amount === 0n) {
      console.warn(`  ${p.token}: scales to zero — refusing to publish a table with an empty prize`)
      return
    }

    const ceiling = await read('prizeCeiling', [p.token])
    if (ceiling === 0n && !SKIP_CEILING_CHECK) {
      console.error(`  ${p.token} has no prizeCeiling set. Set one before running the governor live — it is what bounds a stolen operator key. Pass --no-ceiling-check to override.`)
      return
    }
    if (ceiling !== 0n && amount > ceiling) {
      console.warn(`  ${p.token}: ${formatUnits(amount, decimals)} exceeds ceiling ${formatUnits(ceiling, decimals)} — clamping`)
      amount = ceiling
    }
    retuned.push({ token: p.token, amount, weight: p.weight, rarity: p.rarity })
  }

  const { hash: publishHash, result: newVersion } = await send('publishPrizeTable', [retuned])
  console.log(`published version ${newVersion ?? '(dry run)'}  ${publishHash}`)

  if (LIVE) {
    const { hash } = await send('configureTier', [tierId, tier.label, tier.price, newVersion, true])
    console.log(`tier ${tierId} repointed at version ${newVersion}  ${hash}`)
  } else {
    console.log(`would repoint tier ${tierId} at the new version`)
  }
}

/* -------------------------------------------------------------------- loop */

console.log(`game      ${game}`)
console.log(`operator  ${account.address}`)
console.log(`chain     ${chainId}`)
console.log(`mode      ${LIVE ? 'LIVE' : 'DRY RUN (pass --live to transact)'}`)
console.log(`band      retune to ${(TARGET * 100).toFixed(0)}% when outside ${(FLOOR * 100).toFixed(0)}-${(CEILING * 100).toFixed(0)}%`)
console.log('')

async function run() {
  try {
    await tick()
  } catch (err) {
    console.error(`pass failed: ${err.shortMessage ?? err.message}`)
  }
}

await run()
if (!ONCE) setInterval(run, POLL_MS)
else process.exit(0)
