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
import { rarityFromIndex } from '@/lib/rarity'
import type { SpinRecord } from './types'

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
  /** Named `record` rather than `spin` so it never collides with the action. */
  record: SpinRecord | null
  txHash: string | null
  error: string | null
}

/**
 * The game ABI plus the beacon's errors. `spin` calls into the beacon, and a
 * dry beacon reverts with its own NoCommitmentAvailable — which only decodes
 * into something readable if its definition is in the ABI viem is given.
 */
const spinAbi = [...bachaGameAbi, ...bachaRandomnessAbi.filter((item) => item.type === 'error')] as const

const INITIAL: SpinState = { phase: 'idle', record: null, txHash: null, error: null }

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
    async (machineId: string) => {
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
          await runDemoSpin(machine, address, setState, cancelled)
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

        const hash = await writeContractAsync({
          address: publicEnv.gameAddress,
          abi: spinAbi,
          functionName: 'spin',
          args: [machine.tierId],
          value: tier.price,
          chainId: publicEnv.chainId,
        })
        if (cancelled.current) return
        setState({ phase: 'submitted', record: null, txHash: hash, error: null })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (cancelled.current) return

        if (receipt.status !== 'success') throw new Error('SpinReverted')
        const spinId = extractSpinId(receipt.logs)
        if (spinId === null) throw new Error('SpinReverted')

        const pending = pendingRecord(spinId, machine, tier.price, address, hash)
        setState({ phase: 'settling', record: pending, txHash: hash, error: null })

        const settled = await pollForSettlement(spinId, machine, publicClient, cancelled)
        if (cancelled.current || !settled) return

        setState({
          phase: 'revealing',
          record: { ...pending, ...settled },
          txHash: hash,
          error: null,
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

      if (!publicEnv.gameAddress) throw new Error(t('noContracts'))
      const hash = await writeContractAsync({
        address: publicEnv.gameAddress,
        abi: bachaGameAbi,
        functionName: 'claimFor',
        args: [BigInt(record.id)],
        chainId: publicEnv.chainId,
      })
      const receipt = await publicClient?.waitForTransactionReceipt({ hash })
      if (receipt && receipt.status !== 'success') throw new Error('ClaimReverted')
      setState((s) => ({
        ...s,
        phase: 'claimed',
        record: s.record ? { ...s.record, status: 'CLAIMED', claimTxHash: hash } : s.record,
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
  setState({ phase: 'settling', record: created.spin, txHash: null, error: null })

  const settled = await postJson<{ spin: SpinRecord }>('/api/demo/settle', { id: created.spin.id })
  if (cancelled.current) return
  setState({ phase: 'revealing', record: settled.spin, txHash: null, error: null })
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

function extractSpinId(logs: readonly { data: `0x${string}`; topics: readonly `0x${string}`[] }[]): bigint | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: bachaGameAbi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      })
      if (decoded.eventName === 'SpinRequested') {
        return (decoded.args as unknown as { spinId: bigint }).spinId
      }
    } catch {
      // Not one of ours — beacon and token logs land in the same receipt.
    }
  }
  return null
}

interface ContractSpin {
  status: number
  versionId: bigint
  settledAt: bigint
  randomWord: bigint
  rewardToken: `0x${string}`
  rewardAmount: bigint
  rarity: number
  requestId: bigint
  prizeTableHash: `0x${string}`
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
    const raw = (await publicClient.readContract({
      address: publicEnv.gameAddress!,
      abi: bachaGameAbi,
      functionName: 'getSpin',
      args: [spinId],
    })) as unknown as ContractSpin

    // 2 = Settled, 3 = Claimed in BachaGame.SpinStatus
    if (raw.status === 2 || raw.status === 3) {
      // Decimals come from the verified registry — never inferred from a ticker.
      const decimals = tokenByAddress(raw.rewardToken)?.decimals ?? null
      return {
        machineVersion: raw.versionId.toString(),
        prizeTableHash: raw.prizeTableHash,
        settledAt: Number(raw.settledAt) * 1000,
        requestId: raw.requestId.toString(),
        randomWord: raw.randomWord.toString(),
        rewardTokenAddress: raw.rewardToken.toLowerCase() as `0x${string}`,
        rewardAmountUnits: raw.rewardAmount.toString(),
        rewardAmount: decimals !== null ? unitsToNumber(raw.rewardAmount, decimals) : null,
        rarity: rarityFromIndex(raw.rarity),
        // The live roster carries the version the tier sells; a spin stamped
        // with an older one cannot be indexed against it.
        prizeIndex:
          machine.source === 'onchain' && machine.versionId === raw.versionId.toString()
            ? selectPrize(machine, raw.randomWord).index
            : null,
        status: raw.status === 3 ? 'CLAIMED' : 'SETTLED',
      }
    }

    if (raw.status === 4) throw new Error('SpinRefunded')
    await sleep(3000)
  }

  if (cancelled.current) return null
  throw new Error('StillPending')
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
