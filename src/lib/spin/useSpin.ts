'use client'

import { useCallback, useRef, useState } from 'react'
import { useAccount, useChainId, usePublicClient, useWriteContract } from 'wagmi'
import { decodeEventLog } from 'viem'
import { bachaGameAbi, bachaRandomnessAbi } from '@/lib/contracts/abis'
import { publicEnv, spinMode } from '@/lib/env'
import { selectPrize, type Machine } from '@/lib/machine'
import { useMachines } from '@/lib/machines-context'
import { tokenByAddress } from '@/lib/tokens'
import { unitsToNumber } from '@/lib/format'
import { errorKey } from '@/lib/errors'
import { useTranslations } from 'next-intl'
import { rarityFromIndex, type Rarity } from '@/lib/rarity'
import type { SpinRecord } from './types'

/** Most spins one transaction may buy — BachaGame.MAX_SPINS_PER_CALL. */
export const MAX_SPINS_PER_CALL = 25

/**
 * The spin lifecycle, for both settlement modes.
 *
 * Phases map one-to-one onto what is actually happening, which is why there
 * is no synthetic delay anywhere in here — the machine animates for exactly
 * as long as the real work takes, whether that is a beacon reveal or a
 * local request.
 */
export type SpinPhase =
  | 'idle'
  | 'confirming' // waiting for the wallet
  | 'submitted' // tx broadcast, waiting for inclusion
  | 'settling' // waiting for randomness
  | 'revealing' // result in hand, animation playing
  | 'settled'
  | 'claiming'
  | 'claimed'
  | 'error'

export interface SpinState {
  phase: SpinPhase
  /**
   * Named `record` rather than `spin` so it never collides with the action.
   * For a batch, the best pull once every spin has revealed — what the
   * machine drops into the tray.
   */
  record: SpinRecord | null
  /** Every spin of a multi-spin purchase, in order. Null for a single spin. */
  batch: SpinRecord[] | null
  txHash: string | null
  error: string | null
  /**
   * A settled prize has not been delivered for a while — the moment to offer
   * taking it in BNB instead.
   */
  deliverySlow: boolean
}

/**
 * The game ABI plus the beacon's errors. `spin` calls into the beacon, and a
 * dry beacon reverts with its own NoCommitmentAvailable — which only decodes
 * into something readable if its definition is in the ABI viem is given.
 */
const spinAbi = [...bachaGameAbi, ...bachaRandomnessAbi.filter((item) => item.type === 'error')] as const

const INITIAL: SpinState = {
  phase: 'idle',
  record: null,
  batch: null,
  txHash: null,
  error: null,
  deliverySlow: false,
}

/** How long a settled prize may wait for delivery before BNB is offered. */
const DELIVERY_SLOW_MS = 90_000

export function useSpin() {
  const t = useTranslations('errors')
  const [state, setState] = useState<SpinState>(INITIAL)
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const cancelled = useRef(false)
  const { byId: machineById } = useMachines()

  const reset = useCallback(() => {
    cancelled.current = true
    setState(INITIAL)
  }, [])

  const markRevealed = useCallback(() => {
    setState((s) => (s.phase === 'revealing' ? { ...s, phase: 'settled' } : s))
  }, [])

  const spin = useCallback(
    async (machineId: string, requestedCount = 1) => {
      const count = Math.min(Math.max(1, Math.floor(requestedCount)), MAX_SPINS_PER_CALL)
      const machine = machineById(machineId)
      if (!machine) {
        setState({ ...INITIAL, phase: 'error', error: t('unknownSpin') })
        return
      }
      if (!address) {
        setState({ ...INITIAL, phase: 'error', error: t('connectFirst') })
        return
      }
      if (chainId !== publicEnv.chainId) {
        setState({ ...INITIAL, phase: 'error', error: t('switchFirst') })
        return
      }

      cancelled.current = false
      setState({ ...INITIAL, phase: 'confirming' })

      try {
        if (spinMode === 'demo') {
          if (count === 1) await runDemoSpin(machine, address, setState, cancelled)
          else await runDemoBatch(machine, address, count, setState, cancelled)
          return
        }

        // Kept inline so `writeContractAsync` stays bound to the registered
        // wagmi config rather than a widened generic one.
        if (!publicEnv.gameAddress) throw new Error(t('noContracts'))
        if (!publicClient) throw new Error(t('noRpc'))

        // Pay what the contract charges right now, not what the page was
        // rendered with: a tier can be repriced between render and click, and
        // a stale value would only buy an IncorrectPayment revert.
        const [tier, paused] = await Promise.all([
          publicClient.readContract({
            address: publicEnv.gameAddress,
            abi: bachaGameAbi,
            functionName: 'getTier',
            args: [machine.tierId],
          }),
          publicClient.readContract({ address: publicEnv.gameAddress, abi: bachaGameAbi, functionName: 'paused' }),
        ])
        if (paused) throw new Error('EnforcedPause')
        if (!tier.active) throw new Error('TierInactive')
        if (cancelled.current) return

        const hash =
          count === 1
            ? await writeContractAsync({
                address: publicEnv.gameAddress,
                abi: spinAbi,
                functionName: 'spin',
                args: [machine.tierId],
                value: tier.price,
                chainId: publicEnv.chainId,
              })
            : await writeContractAsync({
                address: publicEnv.gameAddress,
                abi: spinAbi,
                functionName: 'spinMany',
                args: [machine.tierId, BigInt(count)],
                value: tier.price * BigInt(count),
                chainId: publicEnv.chainId,
              })
        if (cancelled.current) return
        setState({ ...INITIAL, phase: 'submitted', txHash: hash })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (cancelled.current) return

        if (receipt.status !== 'success') throw new Error('SpinReverted')
        const spinIds = extractSpinIds(receipt.logs)
        if (spinIds.length === 0) throw new Error('SpinReverted')

        if (count > 1) {
          const pendings = spinIds.map((id) => pendingRecord(id, machine, tier.price, address, hash))
          setState({ ...INITIAL, phase: 'settling', batch: pendings, txHash: hash })
          await watchBatch(spinIds, hash, machine, publicClient, cancelled, setState)
          return
        }

        const spinId = spinIds[0]

        const pending = pendingRecord(spinId, machine, tier.price, address, hash)
        setState({ ...INITIAL, phase: 'settling', record: pending, txHash: hash })

        const settled = await pollForSettlement(spinId, machine, publicClient, cancelled)
        if (cancelled.current || !settled) return

        setState({ ...INITIAL, phase: 'revealing', record: { ...pending, ...settled }, txHash: hash })

        // The worker buys and sends the prize within seconds of settlement.
        // Watch for it without holding up the reveal.
        void pollForDelivery(spinId, publicClient, cancelled, () =>
          setState((s) => (s.record?.id === pending.id ? { ...s, deliverySlow: true } : s)),
        ).then((delivered) => {
          if (!delivered || cancelled.current) return
          setState((s) => {
            if (s.record?.id !== pending.id) return s
            const phase = s.phase === 'settled' || s.phase === 'claiming' ? 'claimed' : s.phase
            return { ...s, phase, deliverySlow: false, record: { ...s.record, ...delivered } }
          })
        })
      } catch (error) {
        if (cancelled.current) return
        setState((s) => ({ ...s, phase: 'error', error: t(errorKey(error)) }))
      }
    },
    [address, chainId, publicClient, writeContractAsync, t, machineById],
  )

  const claim = useCallback(async () => {
    const record = state.record
    if (!record || record.status !== 'SETTLED') return
    setState((s) => ({ ...s, phase: 'claiming', error: null }))

    try {
      if (spinMode === 'demo') {
        const res = await fetch('/api/demo/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: record.id }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Claim failed.')
        const { spin: updated } = (await res.json()) as { spin: SpinRecord }
        setState((s) => ({ ...s, phase: 'claimed', record: updated }))
        return
      }

      // Onchain the worker delivers the stock; the player's own action is the
      // fallback — take the prize's value in BNB instead.
      if (!publicEnv.gameAddress) throw new Error(t('noContracts'))
      const hash = await writeContractAsync({
        address: publicEnv.gameAddress,
        abi: bachaGameAbi,
        functionName: 'payInBnb',
        args: [BigInt(record.id)],
        chainId: publicEnv.chainId,
      })
      const receipt = await publicClient?.waitForTransactionReceipt({ hash })
      if (receipt && receipt.status !== 'success') throw new Error('ClaimReverted')
      setState((s) => ({
        ...s,
        phase: 'claimed',
        deliverySlow: false,
        record: s.record ? { ...s.record, status: 'PAID_BNB', claimTxHash: hash } : s.record,
      }))
    } catch (error) {
      setState((s) => ({ ...s, phase: 'settled', error: t(errorKey(error)) }))
    }
  }, [state.record, publicClient, writeContractAsync, t])

  return { ...state, spin, claim, reset, markRevealed }
}

/* ------------------------------------------------------------------ demo */

async function runDemoSpin(
  machine: Machine,
  player: `0x${string}`,
  setState: React.Dispatch<React.SetStateAction<SpinState>>,
  cancelled: React.MutableRefObject<boolean>,
) {
  const created = await postJson<{ spin: SpinRecord }>('/api/demo/spin', {
    machineId: machine.id,
    player,
  })
  if (cancelled.current) return
  setState({ ...INITIAL, phase: 'settling', record: created.spin })

  const settled = await postJson<{ spin: SpinRecord }>('/api/demo/settle', { id: created.spin.id })
  if (cancelled.current) return
  setState({ ...INITIAL, phase: 'revealing', record: settled.spin })
}

async function runDemoBatch(
  machine: Machine,
  player: `0x${string}`,
  count: number,
  setState: React.Dispatch<React.SetStateAction<SpinState>>,
  cancelled: React.MutableRefObject<boolean>,
) {
  const batch: SpinRecord[] = []
  setState({ ...INITIAL, phase: 'settling', batch: [] })
  for (let i = 0; i < count; i++) {
    const created = await postJson<{ spin: SpinRecord }>('/api/demo/spin', { machineId: machine.id, player })
    if (cancelled.current) return
    const settled = await postJson<{ spin: SpinRecord }>('/api/demo/settle', { id: created.spin.id })
    if (cancelled.current) return
    batch.push(settled.spin)
    setState((s) => ({ ...s, batch: [...batch] }))
  }
  setState((s) => ({ ...s, phase: 'revealing', record: bestOf(batch) }))
}

/* --------------------------------------------------------------- onchain */

function pendingRecord(
  spinId: bigint,
  machine: Machine,
  priceWei: bigint,
  player: `0x${string}`,
  hash: `0x${string}`,
): SpinRecord {
  return {
    id: spinId.toString(),
    mode: 'onchain',
    player,
    machineId: machine.id,
    tierId: machine.tierId,
    machineVersion: 'pending',
    prizeTableHash: machine.localTableHash,
    paymentWei: priceWei.toString(),
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
    txHash: hash,
    claimTxHash: null,
  }
}

function extractSpinIds(logs: readonly { data: `0x${string}`; topics: readonly `0x${string}`[] }[]): bigint[] {
  const ids: bigint[] = []
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: bachaGameAbi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      })
      if (decoded.eventName === 'SpinRequested') {
        ids.push((decoded.args as unknown as { spinId: bigint }).spinId)
      }
    } catch {
      // Not one of ours — beacon and token logs land in the same receipt.
    }
  }
  return ids
}

interface ContractSpin {
  status: number
  versionId: bigint
  settledAt: bigint
  randomWord: bigint
  rewardToken: `0x${string}`
  rewardValue: bigint
  deliveredAmount: bigint
  rarity: number
  requestId: bigint
  prizeTableHash: `0x${string}`
}

// BachaGame.SpinStatus
const PENDING = 1
const SETTLED = 2
const DELIVERED = 3
const PAID_IN_BNB = 4
const REFUNDED = 5

async function readSpin(
  spinId: bigint,
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
): Promise<ContractSpin> {
  return (await publicClient.readContract({
    address: publicEnv.gameAddress!,
    abi: bachaGameAbi,
    functionName: 'getSpin',
    args: [spinId],
  })) as unknown as ContractSpin
}

/** The chain's view of a revealed spin, in the shape the UI consumes. */
function settledFields(raw: ContractSpin, machine: Machine): Partial<SpinRecord> {
  // The live roster carries the version the tier sells; a spin stamped with
  // an older one cannot be indexed against it.
  const index =
    machine.source === 'onchain' && machine.versionId === raw.versionId.toString()
      ? selectPrize(machine, raw.randomWord).index
      : null
  // Until delivery, show what the value buys at the table's price.
  const estimate = index !== null ? machine.prizes[index].amount : null
  const decimals = tokenByAddress(raw.rewardToken)?.decimals ?? null
  const delivered = raw.status === DELIVERED
  return {
    machineVersion: raw.versionId.toString(),
    prizeTableHash: raw.prizeTableHash,
    settledAt: Number(raw.settledAt) * 1000,
    requestId: raw.requestId.toString(),
    randomWord: raw.randomWord.toString(),
    rewardTokenAddress: raw.rewardToken.toLowerCase() as `0x${string}`,
    rewardValueWei: raw.rewardValue.toString(),
    rewardAmountUnits: delivered ? raw.deliveredAmount.toString() : null,
    rewardAmount: delivered && decimals !== null ? unitsToNumber(raw.deliveredAmount, decimals) : estimate,
    rewardAmountExact: delivered,
    rarity: rarityFromIndex(raw.rarity),
    prizeIndex: index,
    status: delivered ? 'CLAIMED' : raw.status === PAID_IN_BNB ? 'PAID_BNB' : 'SETTLED',
  }
}

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'

/** Reads every spin of a batch in one call. */
async function readSpins(
  spinIds: bigint[],
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
): Promise<ContractSpin[]> {
  const results = await publicClient.multicall({
    multicallAddress: MULTICALL3,
    allowFailure: false,
    contracts: spinIds.map((id) => ({
      address: publicEnv.gameAddress!,
      abi: bachaGameAbi,
      functionName: 'getSpin' as const,
      args: [id],
    })),
  })
  return results as unknown as ContractSpin[]
}

const RARITY_RANK: Record<Rarity, number> = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3 }

/** The pull a batch is remembered by: rarest first, then most valuable. */
export function bestOf(batch: SpinRecord[]): SpinRecord | null {
  let best: SpinRecord | null = null
  for (const r of batch) {
    if (!r.rarity || !r.rewardTokenAddress) continue
    if (
      !best ||
      RARITY_RANK[r.rarity] > RARITY_RANK[best.rarity!] ||
      (RARITY_RANK[r.rarity] === RARITY_RANK[best.rarity!] &&
        BigInt(r.rewardValueWei ?? '0') > BigInt(best.rewardValueWei ?? '0'))
    ) {
      best = r
    }
  }
  return best
}

/**
 * Follows every spin of a batch from pending to delivered. Results land one by
 * one as the worker reveals them; once none is pending the machine drops the
 * best of them, and the watch carries on until every prize has arrived.
 */
async function watchBatch(
  spinIds: bigint[],
  hash: `0x${string}`,
  machine: Machine,
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  cancelled: React.MutableRefObject<boolean>,
  setState: React.Dispatch<React.SetStateAction<SpinState>>,
) {
  const started = Date.now()
  let revealedAt: number | null = null

  while (!cancelled.current && Date.now() - started < 30 * 60_000) {
    const raws = await readSpins(spinIds, publicClient).catch(() => null)
    if (cancelled.current) return

    if (raws) {
      const pending = raws.filter((r) => r.status === PENDING).length
      const open = raws.filter((r) => r.status === SETTLED).length
      if (pending === 0 && revealedAt === null) revealedAt = Date.now()
      const slow = revealedAt !== null && open > 0 && Date.now() - revealedAt > DELIVERY_SLOW_MS

      setState((s) => {
        if (s.txHash !== hash || !s.batch) return s
        const batch = s.batch.map((r, i) => {
          const raw = raws[i]
          if (raw.status === REFUNDED) return { ...r, status: 'REFUNDED' as const }
          if (raw.status >= SETTLED) return { ...r, ...settledFields(raw, machine) }
          return r
        })
        const next: SpinState = { ...s, batch, deliverySlow: slow }
        if (pending === 0 && s.phase === 'settling') {
          next.phase = 'revealing'
          next.record = bestOf(batch)
        }
        return next
      })

      if (pending === 0 && open === 0) return
    }

    if (revealedAt === null && Date.now() - started > 10 * 60_000) throw new Error('StillPending')
    await sleep(3000)
  }
}

async function pollForSettlement(
  spinId: bigint,
  machine: Machine,
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  cancelled: React.MutableRefObject<boolean>,
): Promise<Partial<SpinRecord> | null> {
  const started = Date.now()
  const TIMEOUT_MS = 10 * 60_000

  while (!cancelled.current && Date.now() - started < TIMEOUT_MS) {
    const raw = await readSpin(spinId, publicClient)

    if (raw.status >= SETTLED && raw.status <= PAID_IN_BNB) return settledFields(raw, machine)

    if (raw.status === REFUNDED) throw new Error('SpinRefunded')
    await sleep(3000)
  }

  if (cancelled.current) return null
  throw new Error('StillPending')
}

/**
 * Waits for the settlement worker to buy and deliver the prize. Resolves with
 * the delivered amount, or the BNB payout if the player took that instead.
 * Calls `onSlow` once if nothing has happened after DELIVERY_SLOW_MS.
 */
async function pollForDelivery(
  spinId: bigint,
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  cancelled: React.MutableRefObject<boolean>,
  onSlow: () => void,
): Promise<Partial<SpinRecord> | null> {
  const started = Date.now()
  let flagged = false

  while (!cancelled.current && Date.now() - started < 30 * 60_000) {
    const raw = await readSpin(spinId, publicClient).catch(() => null)
    if (raw?.status === DELIVERED) {
      const decimals = tokenByAddress(raw.rewardToken)?.decimals ?? null
      return {
        status: 'CLAIMED',
        rewardAmountUnits: raw.deliveredAmount.toString(),
        rewardAmount: decimals !== null ? unitsToNumber(raw.deliveredAmount, decimals) : null,
        rewardAmountExact: true,
      }
    }
    if (raw?.status === PAID_IN_BNB) return { status: 'PAID_BNB' }
    if (!flagged && Date.now() - started > DELIVERY_SLOW_MS) {
      flagged = true
      onSlow()
    }
    await sleep(3000)
  }
  return null
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
