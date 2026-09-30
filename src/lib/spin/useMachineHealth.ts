'use client'

import { useReadContracts } from 'wagmi'
import { bachaGameAbi, bachaRandomnessAbi } from '@/lib/contracts/abis'
import { publicEnv, contractsConfigured } from '@/lib/env'
import type { Machine } from '@/lib/machine'

export type MachineHealth =
  | { status: 'demo' | 'unknown' | 'paused' | 'inactive' | 'empty' | 'noRandomness' }
  | { status: 'ready' | 'low'; fundedSpins: number; seeds: number }

/** Below this many fundable spins the pool reads as low rather than healthy. */
const LOW_WATER = 5

/**
 * What the contracts would say to a spin right now.
 *
 * Every state here is one `spin()` actually checks — paused, tier inactive,
 * inventory for one more worst case, a committed seed on the beacon — so the
 * console can refuse up front instead of letting a wallet sign a revert.
 * `unknown` means the reads failed, and is never shown as healthy.
 */
export function useMachineHealth(machine: Machine): MachineHealth {
  const game = publicEnv.gameAddress
  const beacon = publicEnv.randomnessAddress
  const versionId = machine.versionId ? BigInt(machine.versionId) : undefined

  const { data } = useReadContracts({
    contracts: [
      { address: game, abi: bachaGameAbi, functionName: 'paused', chainId: publicEnv.chainId },
      {
        address: game,
        abi: bachaGameAbi,
        functionName: 'remainingFundedSpins',
        args: [versionId ?? 0n],
        chainId: publicEnv.chainId,
      },
      { address: beacon, abi: bachaRandomnessAbi, functionName: 'availableCommitments', chainId: publicEnv.chainId },
    ],
    query: { enabled: contractsConfigured && versionId !== undefined, refetchInterval: 15_000 },
  })

  if (!contractsConfigured) return { status: 'demo' }
  if (!machine.active) return { status: 'inactive' }
  if (!data || data.some((r) => r.status !== 'success')) return { status: 'unknown' }

  const [paused, funded, commitments] = data.map((r) => r.result)
  if (paused) return { status: 'paused' }
  if (commitments === 0n) return { status: 'noRandomness' }
  const fundedSpins = Number(funded as bigint)
  if (fundedSpins === 0) return { status: 'empty' }
  return { status: fundedSpins < LOW_WATER ? 'low' : 'ready', fundedSpins, seeds: Number(commitments as bigint) }
}

/**
 * How many spins one purchase can buy right now: every spin needs its own
 * reserve and its own seed, so a batch larger than either would revert.
 */
export function maxSpinsNow(health: MachineHealth, cap: number): number {
  if (health.status !== 'ready' && health.status !== 'low') return cap
  return Math.max(1, Math.min(cap, health.fundedSpins, health.seeds))
}

/** States in which `spin()` is certain to revert. */
export function blocksSpin(health: MachineHealth): boolean {
  return (
    health.status === 'paused' ||
    health.status === 'inactive' ||
    health.status === 'empty' ||
    health.status === 'noRandomness'
  )
}
