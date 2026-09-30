import 'server-only'
import { decodeEventLog, parseAbiItem } from 'viem'
import { publicClient, gameAddress } from './client'
import { bachaGameAbi } from '../contracts/abis'
import { tokenByAddress } from '../tokens'
import { machineByTier } from '../machine'
import { rarityFromIndex } from '../rarity'
import { unitsToNumber } from '../format'
import type { SpinRecord, SpinStatus } from '../spin/types'

/**
 * Reads spins straight from contract state.
 *
 * `spinCount`, `spinsOf` and `getSpin` are views, so this needs no event scan
 * and works against any RPC — including ones that refuse `eth_getLogs` or cap
 * its range, which is most of them. The only thing state does not hold is the
 * transaction that produced each step; those links are filled in from a short
 * window of recent logs when the provider serves them, and left empty when it
 * does not.
 */

const SPIN_REQUESTED = parseAbiItem(
  'event SpinRequested(uint256 indexed spinId, address indexed player, uint8 indexed tier, uint64 versionId, bytes32 prizeTableHash, uint96 payment, uint256 requestId, uint64 requestedAt)',
)

const SPIN_CLAIMED = parseAbiItem(
  'event SpinClaimed(uint256 indexed spinId, address indexed player, address indexed rewardToken, uint128 rewardAmount, address caller)',
)

/** Recent window scanned for transaction links. Small enough for capped providers. */
const LINK_WINDOW_BLOCKS = 4_000n

/**
 * Links are decoration, so they never hold up the feed: the lookup gets a
 * short budget, and a provider that refuses or stalls on getLogs is left
 * alone for a while instead of being retried on every request.
 */
const LINK_BUDGET_MS = 2_500
const LINK_BACKOFF_MS = 5 * 60_000
let linksDisabledUntil = 0

const STATUS: Record<number, SpinStatus> = { 1: 'PENDING', 2: 'SETTLED', 3: 'CLAIMED', 4: 'REFUNDED' }

type ContractSpin = {
  player: `0x${string}`
  tier: number
  status: number
  rarity: number
  versionId: bigint
  requestedAt: bigint
  settledAt: bigint
  payment: bigint
  rewardToken: `0x${string}`
  rewardAmount: bigint
  requestId: bigint
  randomWord: bigint
  prizeTableHash: `0x${string}`
}

export async function listOnchainSpins(opts: { limit?: number; player?: string } = {}): Promise<{
  spins: SpinRecord[]
  total: number
}> {
  if (!gameAddress) return { spins: [], total: 0 }
  const limit = Math.min(Math.max(opts.limit ?? 40, 0), 200)

  let ids: bigint[]
  let total: number
  if (opts.player) {
    const [playerIds, playerTotal] = await publicClient.readContract({
      address: gameAddress,
      abi: bachaGameAbi,
      functionName: 'spinsOf',
      args: [opts.player as `0x${string}`, 0n, BigInt(limit)],
    })
    ids = [...playerIds]
    total = Number(playerTotal)
  } else {
    const count = await publicClient.readContract({ address: gameAddress, abi: bachaGameAbi, functionName: 'spinCount' })
    total = Number(count)
    ids = []
    for (let id = count; id >= 1n && ids.length < limit; id--) ids.push(id)
  }

  return { spins: await readSpins(ids), total }
}

/** Single-spin lookup for the fairness verifier: by id, or by the hash of its spin or claim transaction. */
export async function getOnchainSpin(query: string): Promise<SpinRecord | null> {
  if (!gameAddress) return null

  if (/^\d{1,20}$/.test(query)) {
    const [spin] = await readSpins([BigInt(query)])
    return spin ?? null
  }

  const receipt = await publicClient.getTransactionReceipt({ hash: query as `0x${string}` }).catch(() => null)
  if (!receipt) return null
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== gameAddress) continue
    try {
      const decoded = decodeEventLog({ abi: [SPIN_REQUESTED, SPIN_CLAIMED], data: log.data, topics: log.topics })
      const [spin] = await readSpins([decoded.args.spinId])
      if (!spin) return null
      return decoded.eventName === 'SpinRequested'
        ? { ...spin, txHash: query }
        : { ...spin, claimTxHash: query }
    } catch {
      // Another event from the game in the same receipt — keep looking.
    }
  }
  return null
}

async function readSpins(ids: bigint[]): Promise<SpinRecord[]> {
  if (!gameAddress || ids.length === 0) return []
  const game = gameAddress

  const [results, revealTimeout] = await Promise.all([
    publicClient.multicall({
      contracts: ids.map((id) => ({ address: game, abi: bachaGameAbi, functionName: 'getSpin', args: [id] }) as const),
    }),
    publicClient.readContract({ address: game, abi: bachaGameAbi, functionName: 'revealTimeout' }),
  ])

  const found: { id: bigint; raw: ContractSpin }[] = []
  results.forEach((r, i) => {
    // An id that does not exist reverts with UnknownSpin; skip it.
    if (r.status === 'success') found.push({ id: ids[i], raw: r.result as unknown as ContractSpin })
  })

  // The prize index is not stored; the contract's own walk reproduces it.
  const settled = found.filter((s) => s.raw.status === 2 || s.raw.status === 3)
  const previews = await publicClient.multicall({
    contracts: settled.map(
      (s) =>
        ({
          address: game,
          abi: bachaGameAbi,
          functionName: 'previewPrize',
          args: [s.raw.versionId, s.raw.randomWord],
        }) as const,
    ),
  })
  const prizeIndex = new Map<bigint, number>()
  previews.forEach((p, i) => {
    if (p.status === 'success') prizeIndex.set(settled[i].id, Number((p.result as readonly unknown[])[0]))
  })

  const links = await recentLinks(ids)

  return found.map(({ id, raw }) => {
    const key = id.toString()
    const status = STATUS[raw.status] ?? 'PENDING'
    const hasReward = status === 'SETTLED' || status === 'CLAIMED'
    const token = hasReward ? tokenByAddress(raw.rewardToken) : undefined
    const requestedAt = Number(raw.requestedAt) * 1000

    return {
      id: key,
      mode: 'onchain',
      player: raw.player.toLowerCase() as `0x${string}`,
      machineId: machineByTier(raw.tier)?.id ?? `tier-${raw.tier}`,
      tierId: raw.tier,
      machineVersion: raw.versionId.toString(),
      prizeTableHash: raw.prizeTableHash,
      paymentWei: raw.payment.toString(),
      requestedAt,
      settledAt: raw.settledAt > 0n ? Number(raw.settledAt) * 1000 : null,
      requestId: raw.requestId.toString(),
      randomWord: hasReward ? raw.randomWord.toString() : null,
      rewardTokenAddress: hasReward ? (raw.rewardToken.toLowerCase() as `0x${string}`) : null,
      rewardAmountUnits: hasReward ? raw.rewardAmount.toString() : null,
      rewardAmount: hasReward && token ? unitsToNumber(raw.rewardAmount, token.decimals) : null,
      rarity: hasReward ? rarityFromIndex(raw.rarity) : null,
      prizeIndex: prizeIndex.get(id) ?? null,
      status,
      refundableAt: status === 'PENDING' ? requestedAt + Number(revealTimeout) * 1000 : null,
      txHash: links.requested.get(key) ?? null,
      claimTxHash: links.claimed.get(key) ?? null,
    } satisfies SpinRecord
  })
}

/** Best-effort transaction links for spins made in the last few thousand blocks. */
async function recentLinks(ids: bigint[]) {
  const requested = new Map<string, string>()
  const claimed = new Map<string, string>()
  if (!gameAddress || Date.now() < linksDisabledUntil) return { requested, claimed }

  try {
    const head = await publicClient.getBlockNumber()
    const fromBlock = head > LINK_WINDOW_BLOCKS ? head - LINK_WINDOW_BLOCKS : 0n
    const args = { spinId: ids }
    const [req, clm] = await withinBudget(
      Promise.all([
        publicClient.getLogs({ address: gameAddress, event: SPIN_REQUESTED, args, fromBlock, toBlock: head }),
        publicClient.getLogs({ address: gameAddress, event: SPIN_CLAIMED, args, fromBlock, toBlock: head }),
      ]),
    )
    for (const log of req) if (log.args.spinId != null) requested.set(log.args.spinId.toString(), log.transactionHash)
    for (const log of clm) if (log.args.spinId != null) claimed.set(log.args.spinId.toString(), log.transactionHash)
  } catch {
    // Provider refuses, caps or stalls on getLogs. Spins still render; they
    // just lack links until the backoff lapses.
    linksDisabledUntil = Date.now() + LINK_BACKOFF_MS
  }
  return { requested, claimed }
}

function withinBudget<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('link lookup over budget')), LINK_BUDGET_MS)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
