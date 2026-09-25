#!/usr/bin/env node
/**
 * The Bacha treasury worker.
 *
 * Closes the loop that makes the machine self-funding:
 *
 *   players pay BNB  ->  game contract
 *   game contract    ->  treasury wallet        (withdrawFees, minus refundable)
 *   treasury wallet  ->  PancakeSwap            (buy whatever inventory is short)
 *   bought tokens    ->  vault                  (fund, permissionless)
 *   vault            ->  players                (claims, as spins settle)
 *
 * WHAT THIS KEY CAN AND CANNOT DO
 *
 * The signer needs exactly one privilege: TREASURER_ROLE on the *game*, to
 * sweep spin revenue. It deliberately does NOT hold TREASURER_ROLE on the
 * vault, because `vault.fund()` is permissionless — restocking needs no role
 * at all.
 *
 * So if this hot key is stolen, the attacker can withdraw unreserved spin
 * revenue. They cannot touch vault inventory, so recorded player rewards stay
 * payable; they cannot publish odds, pause, or grant roles. Keep the balance
 * here low — it is a working float, not a treasury.
 *
 * WHY IT BUYS WHAT IT BUYS
 *
 * The game refuses a spin unless the vault covers the worst case for *every*
 * asset in the table on top of everything already owed. One asset running
 * short stops the whole machine, so the deficit that is furthest below target
 * is always filled first — that is the one capping throughput.
 *
 * Environment:
 *   BACHA_RPC_URL                 RPC endpoint
 *   BACHA_GAME_ADDRESS            game contract
 *   BACHA_VAULT_ADDRESS           vault contract
 *   BACHA_TREASURY_KEY            hot key holding game TREASURER_ROLE
 * Optional:
 *   BACHA_TARGET_SPINS            concurrent spins to keep stocked (default 3)
 *   BACHA_GAS_FLOOR_BNB           never spend below this (default 0.02)
 *   BACHA_MAX_SLIPPAGE_BPS        per swap (default 200 = 2%)
 *   BACHA_MAX_SPEND_PER_TICK_BNB  cap on one pass (default 0.05)
 *   BACHA_SWEEP_MIN_BNB           only sweep revenue above this (default 0.01)
 *   BACHA_POLL_MS                 loop interval (default 30000)
 *   BACHA_RESERVE_BNB             hold this much before taking profit (default 0.13)
 *   BACHA_PROFIT_ADDRESS          cold wallet for surplus. Unset = never take profit
 *   BACHA_PROFIT_SPLIT_BPS        share of the surplus to take (default 5000 = 50%)
 *
 * Usage:
 *   node scripts/treasury-worker.mjs --quote     # print the best route per asset
 *   node scripts/treasury-worker.mjs             # dry run, prints the plan
 *   node scripts/treasury-worker.mjs --live      # actually transacts
 *   node scripts/treasury-worker.mjs --live --once
 */
import { readFile } from 'node:fs/promises'
import {
  createPublicClient,
  createWalletClient,
  http,
  encodePacked,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bsc, bscTestnet } from 'viem/chains'

const argv = new Set(process.argv.slice(2))
const LIVE = argv.has('--live')
const ONCE = argv.has('--once')
const QUOTE_ONLY = argv.has('--quote')

const RPC = process.env.BACHA_RPC_URL
const GAME = process.env.BACHA_GAME_ADDRESS
const VAULT = process.env.BACHA_VAULT_ADDRESS
const KEY = process.env.BACHA_TREASURY_KEY

const TARGET_SPINS = BigInt(process.env.BACHA_TARGET_SPINS ?? 5)
const GAS_FLOOR = parseEther(process.env.BACHA_GAS_FLOOR_BNB ?? '0.02')
const SLIPPAGE_BPS = BigInt(process.env.BACHA_MAX_SLIPPAGE_BPS ?? 200)
const MAX_SPEND = parseEther(process.env.BACHA_MAX_SPEND_PER_TICK_BNB ?? '0.05')
const SWEEP_MIN = parseEther(process.env.BACHA_SWEEP_MIN_BNB ?? '0.01')
const POLL_MS = Number(process.env.BACHA_POLL_MS ?? 30000)
const RESERVE = parseEther(process.env.BACHA_RESERVE_BNB ?? '0.13')
const PROFIT_ADDRESS = process.env.BACHA_PROFIT_ADDRESS
const PROFIT_SPLIT_BPS = BigInt(process.env.BACHA_PROFIT_SPLIT_BPS ?? 5000)

if (!RPC || !GAME || !VAULT || !KEY) {
  console.error('missing environment: BACHA_RPC_URL, BACHA_GAME_ADDRESS, BACHA_VAULT_ADDRESS and BACHA_TREASURY_KEY are all required')
  process.exit(1)
}

/* ------------------------------------------------------------------ chain */

const V2_ROUTER = getAddress('0x10ED43C718714eb63d5aA57B78B54704E256024E')
const V3_QUOTER = getAddress('0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997')
const V3_ROUTER = getAddress('0x13f4EA83D0bd40E75C8222255bc855a974568Dd4')
const WBNB = getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c')
const USDT = getAddress('0x55d398326f99059fF775485246999027B3197955')
const V3_FEES = [100, 500, 2500, 10000]

const gameAbi = [
  { type: 'function', name: 'withdrawableFees', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'withdrawFees', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'pendingLiabilityOf', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'versionMaxPerToken', stateMutability: 'view', inputs: [{ name: 'versionId', type: 'uint64' }, { name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'remainingFundedSpins', stateMutability: 'view', inputs: [{ name: 'versionId', type: 'uint64' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getTier', stateMutability: 'view', inputs: [{ name: 'tierId', type: 'uint8' }], outputs: [{ type: 'tuple', components: [ { name: 'exists', type: 'bool' }, { name: 'active', type: 'bool' }, { name: 'price', type: 'uint96' }, { name: 'versionId', type: 'uint64' }, { name: 'label', type: 'string' } ] }] },
  { type: 'function', name: 'tierIds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8[]' }] },
]

const vaultAbi = [
  { type: 'function', name: 'balanceOfAsset', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approvedAsset', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'fund', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
]

const v2RouterAbi = [
  { type: 'function', name: 'getAmountsOut', stateMutability: 'view', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'swapExactETHForTokensSupportingFeeOnTransferTokens', stateMutability: 'payable', inputs: [{ name: 'amountOutMin', type: 'uint256' }, { name: 'path', type: 'address[]' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
]

const v3QuoterAbi = [
  {
    type: 'function', name: 'quoteExactInput', stateMutability: 'nonpayable',
    inputs: [{ name: 'path', type: 'bytes' }, { name: 'amountIn', type: 'uint256' }],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
      { name: 'initializedTicksCrossedList', type: 'uint32[]' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
]

const v3RouterAbi = [
  {
    type: 'function', name: 'exactInput', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'path', type: 'bytes' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
]

const account = privateKeyToAccount(KEY.startsWith('0x') ? KEY : `0x${KEY}`)
const publicClient = createPublicClient({ transport: http(RPC) })
const chainId = await publicClient.getChainId()
const chain = chainId === 97 ? bscTestnet : bsc
const wallet = createWalletClient({ account, chain, transport: http(RPC) })

const game = getAddress(GAME)
const vault = getAddress(VAULT)

const readGame = (functionName, args = []) => publicClient.readContract({ address: game, abi: gameAbi, functionName, args })
const readVault = (functionName, args = []) => publicClient.readContract({ address: vault, abi: vaultAbi, functionName, args })

async function send(address, abi, functionName, args, value = 0n) {
  if (!LIVE) return '(dry run)'
  const { request } = await publicClient.simulateContract({ address, abi, functionName, args, account, value })
  const hash = await wallet.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted (${hash})`)
  return hash
}

/* ------------------------------------------------------------------ swaps */

/**
 * Find the best route across PancakeSwap V2 and V3.
 *
 * Quoting V2 alone is not safe here. Measured against this roster, V2 had
 * almost no depth in B2 and would have filled at roughly twice the market
 * price, and mubarak about 10% over — both of which quietly eat the margin
 * this whole loop depends on. The same tokens fill at market on V3. Several
 * also route better through USDT than against WBNB directly, so both hops
 * are tried at every fee tier.
 */
async function bestRoute(token, amountIn) {
  let best = null
  const keep = (candidate) => {
    if (candidate.out > 0n && (!best || candidate.out > best.out)) best = candidate
  }

  // --- V2 --------------------------------------------------------------
  for (const path of [[WBNB, token], [WBNB, USDT, token]]) {
    try {
      const amounts = await publicClient.readContract({
        address: V2_ROUTER, abi: v2RouterAbi, functionName: 'getAmountsOut', args: [amountIn, path],
      })
      keep({ kind: 'v2', path, out: amounts[amounts.length - 1], label: path.length === 2 ? 'V2' : 'V2 via USDT' })
    } catch {
      // No pool on this route.
    }
  }

  // --- V3 --------------------------------------------------------------
  const quoteV3 = async (path, label) => {
    try {
      // QuoterV2 is non-view by design (it reverts internally to measure), so
      // it has to be simulated rather than read.
      const { result } = await publicClient.simulateContract({
        address: V3_QUOTER, abi: v3QuoterAbi, functionName: 'quoteExactInput', args: [path, amountIn],
      })
      keep({ kind: 'v3', path, out: result[0], label })
    } catch {
      // Pool does not exist at this fee tier.
    }
  }

  for (const fee of V3_FEES) {
    await quoteV3(encodePacked(['address', 'uint24', 'address'], [WBNB, fee, token]), `V3 ${fee / 10000}%`)
    for (const fee2 of V3_FEES) {
      await quoteV3(
        encodePacked(['address', 'uint24', 'address', 'uint24', 'address'], [WBNB, fee, USDT, fee2, token]),
        `V3 ${fee / 10000}% via USDT ${fee2 / 10000}%`,
      )
    }
  }

  return best
}

/** Executes `route` for `spend` wei of BNB, enforcing `minOut`. */
async function executeSwap(route, spend, minOut) {
  if (route.kind === 'v2') {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 120)
    return send(
      V2_ROUTER, v2RouterAbi, 'swapExactETHForTokensSupportingFeeOnTransferTokens',
      [minOut, route.path, account.address, deadline], spend,
    )
  }
  // The V3 router wraps native BNB itself when the path starts at WBNB.
  return send(
    V3_ROUTER, v3RouterAbi, 'exactInput',
    [{ path: route.path, recipient: account.address, amountIn: spend, amountOutMinimum: minOut }], spend,
  )
}

/* ------------------------------------------------------------------- tick */

const roster = JSON.parse(await readFile('data/tokens.json', 'utf8')).tokens.filter((t) => t.rewardEnabled)

async function tick() {
  const bnbBefore = await publicClient.getBalance({ address: account.address })

  // --- which table is live ------------------------------------------------
  const tiers = await readGame('tierIds')
  const active = []
  for (const id of tiers) {
    const tier = await readGame('getTier', [id])
    if (tier.exists && tier.active) active.push(tier.versionId)
  }
  if (active.length === 0) {
    console.log('no active tier — nothing to stock')
    return
  }
  const versionId = active[0]

  // --- 1. sweep revenue ---------------------------------------------------
  const fees = await readGame('withdrawableFees')
  if (fees >= SWEEP_MIN) {
    const hash = await send(game, gameAbi, 'withdrawFees', [account.address, fees])
    console.log(`swept ${formatEther(fees)} BNB of revenue  ${hash}`)
  } else if (fees > 0n) {
    console.log(`revenue ${formatEther(fees)} BNB below sweep floor — leaving it`)
  }

  // --- 2. what is short ---------------------------------------------------
  const deficits = []
  for (const token of roster) {
    const address = getAddress(token.address)
    const [maxPer, liability, held, approved] = await Promise.all([
      readGame('versionMaxPerToken', [versionId, address]),
      readGame('pendingLiabilityOf', [address]),
      readVault('balanceOfAsset', [address]),
      readVault('approvedAsset', [address]),
    ])
    if (maxPer === 0n) continue // not in this table
    if (!approved) {
      console.warn(`${token.symbol}: vault has not approved this asset — cannot fund it`)
      continue
    }
    const target = maxPer * TARGET_SPINS + liability
    if (held >= target) continue
    deficits.push({
      token, address, decimals: token.decimals,
      short: target - held, target, held,
      // How close this asset is to blocking the machine. Lowest goes first.
      ratio: target === 0n ? 1 : Number(held) / Number(target),
    })
  }

  const remaining = await readGame('remainingFundedSpins', [versionId])
  console.log(`machine can accept ${remaining} more spin(s); ${deficits.length} asset(s) below target`)

  if (deficits.length === 0) {
    await takeProfit(deficits)
    return
  }

  // --- 3. budget ----------------------------------------------------------
  const balance = await publicClient.getBalance({ address: account.address })
  let budget = balance > GAS_FLOOR ? balance - GAS_FLOOR : 0n
  if (budget > MAX_SPEND) budget = MAX_SPEND
  if (budget === 0n) {
    console.warn(`treasury at ${formatEther(balance)} BNB is at or below the ${formatEther(GAS_FLOOR)} gas floor — not buying`)
    return
  }

  // Fill whatever is closest to blocking the machine first.
  deficits.sort((a, b) => a.ratio - b.ratio)
  const slice = budget / BigInt(deficits.length)

  for (const d of deficits) {
    if (slice === 0n) break

    const quote = await bestRoute(d.address, slice)
    if (!quote) {
      console.warn(`${d.token.symbol}: no PancakeSwap route from BNB — skipping`)
      continue
    }
    // Never buy more than the deficit: overshooting locks capital that could
    // be stocking an asset that is actually blocking spins.
    let spend = slice
    if (quote.out > d.short) {
      spend = (slice * d.short) / quote.out
    }
    if (spend === 0n) continue

    const finalQuote = await bestRoute(d.address, spend)
    if (!finalQuote) continue
    const minOut = (finalQuote.out * (10000n - SLIPPAGE_BPS)) / 10000n

    console.log(
      `${d.token.symbol}: short ${formatUnits(d.short, d.decimals)} — ` +
      `buying with ${formatEther(spend)} BNB, expect ${formatUnits(finalQuote.out, d.decimals)}, ` +
      `min ${formatUnits(minOut, d.decimals)} (${Number(SLIPPAGE_BPS) / 100}% slippage), ` +
      `via ${finalQuote.label}`,
    )

    try {
      const swapHash = await executeSwap(finalQuote, spend, minOut)
      console.log(`  swapped ${swapHash}`)

      // Fund with the measured balance, not the quote — the vault credits what
      // actually arrives, and so should we.
      const got = await publicClient.readContract({
        address: d.address, abi: erc20Abi, functionName: 'balanceOf', args: [account.address],
      })
      if (got === 0n) continue

      const allowance = await publicClient.readContract({
        address: d.address, abi: erc20Abi, functionName: 'allowance', args: [account.address, vault],
      })
      if (allowance < got) {
        await send(d.address, erc20Abi, 'approve', [vault, got])
      }
      const fundHash = await send(vault, vaultAbi, 'fund', [d.address, got])
      console.log(`  funded vault with ${formatUnits(got, d.decimals)} ${d.token.symbol}  ${fundHash}`)
    } catch (err) {
      console.error(`  ${d.token.symbol} failed: ${err.shortMessage ?? err.message}`)
    }
  }

  await takeProfit(await remainingDeficits(versionId))

  const bnbAfter = await publicClient.getBalance({ address: account.address })
  console.log(`treasury ${formatEther(bnbBefore)} -> ${formatEther(bnbAfter)} BNB`)
}

/** Re-checks inventory after buying, so profit is never taken on a stale read. */
async function remainingDeficits(versionId) {
  const short = []
  for (const token of roster) {
    const address = getAddress(token.address)
    const [maxPer, liability, held] = await Promise.all([
      readGame('versionMaxPerToken', [versionId, address]),
      readGame('pendingLiabilityOf', [address]),
      readVault('balanceOfAsset', [address]),
    ])
    if (maxPer === 0n) continue
    if (held < maxPer * TARGET_SPINS + liability) short.push(token.symbol)
  }
  return short
}

/**
 * Take profit, but only from genuine surplus.
 *
 * The order matters and is not negotiable: inventory first, then the reserve,
 * and only what is left over is profit. Taking a cut before the machine is
 * stocked would be borrowing from the float that keeps it running — the
 * quickest way to turn a profitable machine into one that stalls.
 *
 * Half the surplus is left compounding by default, because the reserve is
 * also what sets concurrency: a bigger float is a machine that can accept
 * more simultaneous spins.
 */
async function takeProfit(deficits) {
  if (!PROFIT_ADDRESS) return
  if (deficits.length > 0) {
    console.log('inventory still below target — no profit taken this pass')
    return
  }

  const balance = await publicClient.getBalance({ address: account.address })
  const floor = RESERVE + GAS_FLOOR
  if (balance <= floor) {
    console.log(`treasury ${formatEther(balance)} BNB is below the ${formatEther(floor)} reserve — compounding, not taking profit`)
    return
  }

  const surplus = balance - floor
  const take = (surplus * PROFIT_SPLIT_BPS) / 10000n
  if (take === 0n) return

  const to = getAddress(PROFIT_ADDRESS)
  if (!LIVE) {
    console.log(`would send ${formatEther(take)} BNB profit to ${to} (surplus ${formatEther(surplus)}, leaving ${formatEther(surplus - take)} compounding)`)
    return
  }
  const hash = await wallet.sendTransaction({ to, value: take })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`profit ${formatEther(take)} BNB -> ${to}  ${hash}  (left ${formatEther(surplus - take)} compounding)`)
}

/* ------------------------------------------------------------------- loop */

console.log(`game      ${game}`)
console.log(`vault     ${vault}`)
console.log(`treasury  ${account.address}`)
console.log(`chain     ${chainId}`)
console.log(`mode      ${LIVE ? 'LIVE' : 'DRY RUN (pass --live to transact)'}`)
console.log(`target    ${TARGET_SPINS} concurrent spins stocked, gas floor ${formatEther(GAS_FLOOR)} BNB`)
console.log(`profit    ${PROFIT_ADDRESS ? `${Number(PROFIT_SPLIT_BPS) / 100}% of surplus above ${formatEther(RESERVE)} BNB reserve -> ${PROFIT_ADDRESS}` : 'disabled (set BACHA_PROFIT_ADDRESS to enable)'}`)
console.log('')

/**
 * Print the route the worker would take for each asset, without touching the
 * game or the vault. Worth running before going live, and after any roster
 * change: a token whose depth has moved to a different pool will show up here
 * as a changed route rather than as a bad fill.
 */
async function printQuotes() {
  const probe = parseEther('0.0065') // ~$5, the scale this worker buys at
  console.log(`best route for ${formatEther(probe)} BNB per asset:\n`)
  for (const token of roster) {
    const route = await bestRoute(getAddress(token.address), probe)
    if (!route) {
      console.log(`  ${token.symbol.padEnd(10)} NO ROUTE`)
      continue
    }
    const amount = Number(formatUnits(route.out, token.decimals))
    console.log(`  ${token.symbol.padEnd(10)} ${route.label.padEnd(26)} ${amount.toFixed(6).padStart(14)}`)
  }
}

async function run() {
  try {
    await tick()
  } catch (err) {
    console.error(`tick failed: ${err.shortMessage ?? err.message}`)
  }
}

if (QUOTE_ONLY) {
  await printQuotes()
  process.exit(0)
}

await run()
if (!ONCE) setInterval(run, POLL_MS)
else process.exit(0)
