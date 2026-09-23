import 'server-only'
import { spinMode } from '../env'
import type { SpinRecord } from './types'

/**
 * The most recent settled spin, for the live machine panel.
 *
 * Reads from whichever source is authoritative for this deployment and returns
 * null rather than fabricating something when there is nothing to show.
 */
export async function latestSettledSpin(): Promise<SpinRecord | null> {
  try {
    if (spinMode === 'onchain') {
      const { listOnchainSpins } = await import('../onchain/spins')
      const { spins } = await listOnchainSpins({ limit: 10 })
      return spins.find((s) => s.status !== 'PENDING') ?? null
    }

    const { listDemoSpins } = await import('../demo/store')
    const { spins } = listDemoSpins({ limit: 10 })
    return spins.find((s) => s.status !== 'PENDING') ?? null
  } catch {
    return null
  }
}
