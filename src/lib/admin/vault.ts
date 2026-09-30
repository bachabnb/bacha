import 'server-only'
import { bachaGameAbi } from '../contracts/abis'
import { publicEnv, contractsConfigured } from '../env'

/** One tier as the game sells it, with how many more spins it can take. */
export interface BankrollTier {
  tierId: number
  label: string
  active: boolean
  priceWei: string
  versionId: string
  /** The version's biggest prize, in wei. */
  maxValueWei: string
  /** `remainingFundedSpins(versionId)`, straight from the contract. */
  remainingFundedSpins: string
}

/**
 * The game's bankroll. Wei amounts are decimal strings so the whole thing can
 * be handed to a client component unchanged.
 */
export interface Bankroll {
  /** False when there is no game to read, or the RPC did not answer. */
  available: boolean
  balanceWei: string
  /** `pendingReserve + settledOwed` — everything the balance must cover. */
  obligationsWei: string
  pendingReserveWei: string
  settledOwedWei: string
  /** BNB above every obligation: what a treasurer may withdraw. */
  withdrawableWei: string
  /** Admin-set cap on any single prize; `publishPrizeTable` rejects above it. */
  maxPrizeValueWei: string
  tiers: BankrollTier[]
}

const EMPTY: Bankroll = {
  available: false,
  balanceWei: '0',
  obligationsWei: '0',
  pendingReserveWei: '0',
  settledOwedWei: '0',
  withdrawableWei: '0',
  maxPrizeValueWei: '0',
  tiers: [],
}

/**
 * Reads what the game holds and what it owes.
 *
 * The game holds one asset, BNB, so this is a balance and the four solvency
 * views the contract exposes. With no contracts deployed it returns zeros
 * marked unavailable rather than inventing a bankroll.
 */
export async function readBankroll(): Promise<Bankroll> {
  const game = publicEnv.gameAddress
  if (!contractsConfigured || !game) return EMPTY

  try {
    const { publicClient } = await import('../onchain/client')
    const read = { address: game, abi: bachaGameAbi } as const

    const [balance, obligations, pendingReserve, settledOwed, withdrawable, maxPrizeValue, tierIds] =
      await Promise.all([
        publicClient.getBalance({ address: game }),
        publicClient.readContract({ ...read, functionName: 'obligations' }),
        publicClient.readContract({ ...read, functionName: 'pendingReserve' }),
        publicClient.readContract({ ...read, functionName: 'settledOwed' }),
        publicClient.readContract({ ...read, functionName: 'withdrawableFees' }),
        publicClient.readContract({ ...read, functionName: 'maxPrizeValue' }),
        publicClient.readContract({ ...read, functionName: 'tierIds' }),
      ])

    const tiers = await Promise.all(
      tierIds.map(async (tierId): Promise<BankrollTier> => {
        const tier = await publicClient.readContract({ ...read, functionName: 'getTier', args: [tierId] })
        const [[version], remaining] = await Promise.all([
          publicClient.readContract({ ...read, functionName: 'getVersion', args: [tier.versionId] }),
          publicClient.readContract({
            ...read,
            functionName: 'remainingFundedSpins',
            args: [tier.versionId],
          }),
        ])
        return {
          tierId,
          label: tier.label,
          active: tier.active,
          priceWei: tier.price.toString(),
          versionId: tier.versionId.toString(),
          maxValueWei: version.maxValue.toString(),
          remainingFundedSpins: remaining.toString(),
        }
      }),
    )

    return {
      available: true,
      balanceWei: balance.toString(),
      obligationsWei: obligations.toString(),
      pendingReserveWei: pendingReserve.toString(),
      settledOwedWei: settledOwed.toString(),
      withdrawableWei: withdrawable.toString(),
      maxPrizeValueWei: maxPrizeValue.toString(),
      tiers,
    }
  } catch {
    // An RPC failure must not make the console claim the bankroll is empty in
    // a way that looks authoritative — callers render this as "unavailable".
    return EMPTY
  }
}
