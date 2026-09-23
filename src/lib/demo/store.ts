import 'server-only'
import { machines, machineById, selectPrize, type Machine } from '../machine'
import { unitsToNumber } from '../format'
import type { SpinRecord } from '../spin/types'
import { demoRandomWord } from './randomness'

/**
 * In-process store for demo spins.
 *
 * Intentionally not a database: demo mode is for local exploration and
 * previews, and its results carry no value. When `DATABASE_URL` and real
 * contracts are configured the app reads from chain instead and this module is
 * never reached.
 */

const MAX_HISTORY = 400

let nextId = 1
const spins: SpinRecord[] = []
let seeded = false

function makeAddress(seed: number): `0x${string}` {
  // Deterministic placeholder wallets for the seeded demo feed. Formatted like
  // an address but derived from a counter — these are not real accounts and
  // the UI labels the whole feed as simulated.
  const hex = (seed * 0x9e3779b1).toString(16).padStart(8, '0').slice(-8)
  return `0x${hex}${'4bac'.repeat(8)}`.slice(0, 42) as `0x${string}`
}

function settleAgainst(machine: Machine, word: bigint) {
  const { index, prize } = selectPrize(machine, word)
  return {
    prizeIndex: index,
    rewardTokenAddress: prize.token,
    rewardAmountUnits: prize.amountUnits,
    rewardAmount: unitsToNumber(BigInt(prize.amountUnits), prize.decimals),
    rarity: prize.rarity,
  }
}

/** Populates the feed so the activity surfaces aren't empty on first load. */
function seed() {
  if (seeded) return
  seeded = true
  const now = Date.now()
  for (let i = 0; i < 24; i++) {
    const machine = machines[i % machines.length]
    const word = demoRandomWord()
    const requestedAt = now - (i + 1) * (40_000 + (i % 7) * 26_000)
    const outcome = settleAgainst(machine, word)
    spins.unshift({
      id: String(nextId++),
      mode: 'demo',
      player: makeAddress(i + 11),
      machineId: machine.id,
      tierId: machine.tierId,
      machineVersion: 'demo-1',
      prizeTableHash: machine.localTableHash,
      paymentWei: machine.priceWei.toString(),
      requestedAt,
      settledAt: requestedAt + 9_000,
      requestId: `demo-${nextId}`,
      randomWord: word.toString(),
      status: i % 9 === 0 ? 'SETTLED' : 'CLAIMED',
      txHash: null,
      claimTxHash: null,
      ...outcome,
    })
  }
  spins.sort((a, b) => b.requestedAt - a.requestedAt)
}

export function createDemoSpin(machineId: string, player: `0x${string}`): SpinRecord {
  seed()
  const machine = machineById(machineId)
  if (!machine) throw new Error(`unknown machine: ${machineId}`)

  const record: SpinRecord = {
    id: String(nextId++),
    mode: 'demo',
    player,
    machineId: machine.id,
    tierId: machine.tierId,
    machineVersion: 'demo-1',
    prizeTableHash: machine.localTableHash,
    paymentWei: machine.priceWei.toString(),
    requestedAt: Date.now(),
    settledAt: null,
    requestId: null,
    randomWord: null,
    rewardTokenAddress: null,
    rewardAmountUnits: null,
    rewardAmount: null,
    rarity: null,
    prizeIndex: null,
    status: 'PENDING',
    txHash: null,
    claimTxHash: null,
  }

  spins.unshift(record)
  if (spins.length > MAX_HISTORY) spins.length = MAX_HISTORY
  return record
}

export function settleDemoSpin(id: string): SpinRecord | undefined {
  seed()
  const record = spins.find((s) => s.id === id)
  if (!record || record.status !== 'PENDING') return record

  const machine = machineById(record.machineId)
  if (!machine) return record

  const word = demoRandomWord()
  Object.assign(record, {
    status: 'SETTLED' as const,
    settledAt: Date.now(),
    requestId: `demo-${record.id}`,
    randomWord: word.toString(),
    ...settleAgainst(machine, word),
  })
  return record
}

export function claimDemoSpin(id: string): SpinRecord | undefined {
  seed()
  const record = spins.find((s) => s.id === id)
  if (!record || record.status !== 'SETTLED') return record
  record.status = 'CLAIMED'
  return record
}

export function getDemoSpin(id: string): SpinRecord | undefined {
  seed()
  return spins.find((s) => s.id === id)
}

export function listDemoSpins(opts: { limit?: number; player?: string } = {}): {
  spins: SpinRecord[]
  total: number
} {
  seed()
  const limit = Math.min(opts.limit ?? 40, 200)
  let rows = spins
  if (opts.player) {
    const key = opts.player.toLowerCase()
    rows = rows.filter((s) => s.player.toLowerCase() === key)
  }
  return { spins: rows.slice(0, limit), total: rows.length }
}
