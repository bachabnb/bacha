import 'server-only'
import { erc20Abi } from 'viem'
import { rewardTokens } from '../tokens'
import { publicEnv, contractsConfigured } from '../env'

/**
 * Reads what the vault actually holds, per reward asset.
 *
 * Returns base-unit strings keyed by lowercase address. With no contracts
 * deployed it returns zeros rather than inventing inventory — the admin
 * console should show an unfunded vault as unfunded.
 */
export async function readVaultBalances(): Promise<Record<string, string>> {
  const tokens = rewardTokens()
  const empty = Object.fromEntries(tokens.map((t) => [t.address.toLowerCase(), '0']))

  if (!contractsConfigured || !publicEnv.vaultAddress) return empty

  try {
    const { publicClient } = await import('../onchain/client')
    const results = await publicClient.multicall({
      contracts: tokens.map((token) => ({
        address: token.address,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [publicEnv.vaultAddress!] as const,
      })),
      allowFailure: true,
    })

    return Object.fromEntries(
      tokens.map((token, i) => {
        const result = results[i]
        const value = result.status === 'success' ? (result.result as bigint) : 0n
        return [token.address.toLowerCase(), value.toString()]
      }),
    )
  } catch {
    // An RPC failure must not make the console claim the vault is empty in a
    // way that looks authoritative — callers render this as "unavailable".
    return empty
  }
}
