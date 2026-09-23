import { parseAbiItem, type Log } from 'viem'
import { publicClient, gameAddress } from './client'
import { tokenByAddress } from '../tokens'
import { machineByTier } from '../machine'
import { rarityFromIndex } from '../rarity'
import { unitsToNumber } from '../format'
import type { SpinRecord } from '../spin/types'

/**
 * Reads settled spins straight from chain events.
 *
 * The contract is the source of truth. If `DATABASE_URL` is configured a
 * background indexer may keep a faster copy, but a cached row is only ever
 * used to *find* a spin — the fields shown are the ones the chain emitted.
 */

const SPIN_SETTLED = parseAbiItem(
  'event SpinSettled(uint256 indexed spinId, address indexed player, address indexed rewardToken, uint128 rewardAmount, uint8 rarity, uint16 prizeIndex, uint256 randomWord, uint64 settledAt)',
)

const SPIN_REQUESTED = parseAbiItem(
  'event SpinRequested(uint256 indexed spinId, address indexed player, uint8 indexed tier, uint64 versionId, bytes32 prizeTableHash, uint96 payment, uint256 requestId, uint64 requestedAt)',
)

const SPIN_CLAIMED = parseAbiItem(
  'event SpinClaimed(uint256 indexed spinId, address indexed player, address indexed rewardToken, uint128 rewardAmount, address caller)',
)

/** How far back to scan when no indexer is configured. ~3 days on BSC. */
const LOOKBACK_BLOCKS = 250_000n

export async function listOnchainSpins(opts: { limit?: number; player?: string } = {}): Promise<{
  spins: SpinRecord[]
  total: number
}> {
  if (!gameAddress) return { spins: [], total: 0 }

  const limit = Math.min(opts.limit ?? 40, 200)
  const head = await publicClient.getBlockNumber()
  const fromBlock = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n

  const [settled, requested, claimed] = await Promise.all([
    publicClient.getLogs({
      address: gameAddress,
      event: SPIN_SETTLED,
      args: opts.player ? { player: opts.player as `0x${string}` } : undefined,
      fromBlock,
      toBlock: head,
    }),
    publicClient.getLogs({
      address: gameAddress,
      event: SPIN_REQUESTED,
      args: opts.player ? { player: opts.player as `0x${string}` } : undefined,
      fromBlock,
      toBlock: head,
    }),
    publicClient.getLogs({
      address: gameAddress,
      event: SPIN_CLAIMED,
      args: opts.player ? { player: opts.player as `0x${string}` } : undefined,
      fromBlock,
      toBlock: head,
    }),
  ])

  const requests = new Map<string, (typeof requested)[number]>()
  for (const log of requested) {
    const id = log.args.spinId?.toString()
    if (id) requests.set(id, log)
  }

  const claimedIds = new Map<string, string>()
  for (const log of claimed) {
    const id = log.args.spinId?.toString()
    if (id) claimedIds.set(id, log.transactionHash ?? '')
  }

  const rows: SpinRecord[] = []
  for (const log of settled) {
    const record = toRecord(log, requests, claimedIds)
    if (record) rows.push(record)
  }

  // Newest first. Pending spins appear too, so a player can watch their own.
  for (const [id, log] of requests) {
    if (rows.some((r) => r.id === id)) continue
    const pending = toPendingRecord(id, log)
    if (pending) rows.push(pending)
  }

  rows.sort((a, b) => (b.settledAt ?? b.requestedAt) - (a.settledAt ?? a.requestedAt))
  return { spins: rows.slice(0, limit), total: rows.length }
}

type SettledLog = Log<bigint, number, false, typeof SPIN_SETTLED>
type RequestedLog = Log<bigint, number, false, typeof SPIN_REQUESTED>

function toRecord(
  log: SettledLog,
  requests: Map<string, RequestedLog>,
  claimedIds: Map<string, string>,
): SpinRecord | null {
  const id = log.args.spinId?.toString()
  const player = log.args.player
  const rewardToken = log.args.rewardToken
  if (!id || !player || !rewardToken) return null

  const request = requests.get(id)
  const tierId = Number(request?.args.tier ?? 0)
  const machine = machineByTier(tierId)
  const token = tokenByAddress(rewardToken)
  const amountUnits = log.args.rewardAmount ?? 0n

  return {
    id,
    mode: 'onchain',
    player: player.toLowerCase() as `0x${string}`,
    machineId: machine?.id ?? `tier-${tierId}`,
    tierId,
    machineVersion: request?.args.versionId?.toString() ?? 'unknown',
    prizeTableHash: request?.args.prizeTableHash ?? '0x',
    paymentWei: (request?.args.payment ?? 0n).toString(),
    requestedAt: Number(request?.args.requestedAt ?? log.args.settledAt ?? 0n) * 1000,
    settledAt: Number(log.args.settledAt ?? 0n) * 1000,
    requestId: request?.args.requestId?.toString() ?? null,
    randomWord: log.args.randomWord?.toString() ?? null,
    rewardTokenAddress: rewardToken.toLowerCase() as `0x${string}`,
    rewardAmountUnits: amountUnits.toString(),
    rewardAmount: token ? unitsToNumber(amountUnits, token.decimals) : null,
    rarity: rarityFromIndex(Number(log.args.rarity ?? 0)),
    prizeIndex: Number(log.args.prizeIndex ?? 0),
    status: claimedIds.has(id) ? 'CLAIMED' : 'SETTLED',
    txHash: request?.transactionHash ?? null,
    claimTxHash: claimedIds.get(id) || null,
  }
}

function toPendingRecord(id: string, log: RequestedLog): SpinRecord | null {
  const player = log.args.player
  if (!player) return null
  const tierId = Number(log.args.tier ?? 0)
  const machine = machineByTier(tierId)

  return {
    id,
    mode: 'onchain',
    player: player.toLowerCase() as `0x${string}`,
    machineId: machine?.id ?? `tier-${tierId}`,
    tierId,
    machineVersion: log.args.versionId?.toString() ?? 'unknown',
    prizeTableHash: log.args.prizeTableHash ?? '0x',
    paymentWei: (log.args.payment ?? 0n).toString(),
    requestedAt: Number(log.args.requestedAt ?? 0n) * 1000,
    settledAt: null,
    requestId: log.args.requestId?.toString() ?? null,
    randomWord: null,
    rewardTokenAddress: null,
    rewardAmountUnits: null,
    rewardAmount: null,
    rarity: null,
    prizeIndex: null,
    status: 'PENDING',
    txHash: log.transactionHash ?? null,
    claimTxHash: null,
  }
}

/** Single-spin lookup for the fairness verifier. */
export async function getOnchainSpin(spinId: string): Promise<SpinRecord | null> {
  if (!gameAddress) return null
  const { spins } = await listOnchainSpins({ limit: 200 })
  return spins.find((s) => s.id === spinId) ?? null
}
