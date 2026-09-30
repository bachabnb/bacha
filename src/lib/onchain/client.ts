import 'server-only'
import { createPublicClient, http } from 'viem'
import { bsc, bscTestnet } from 'viem/chains'
import { publicEnv } from '../env'

/**
 * Server-side read client. Never holds a key and never signs.
 *
 * Prefers `BACHA_RPC_URL`, which is server-only, so a keyed provider URL used
 * for these reads is never inlined into the browser bundle the way a
 * `NEXT_PUBLIC_` one would be. Falls back to the public endpoint.
 */
const rpcUrl = process.env.BACHA_RPC_URL?.trim() || publicEnv.rpcUrl

export const publicClient = createPublicClient({
  chain: publicEnv.chainId === 97 ? bscTestnet : bsc,
  transport: http(rpcUrl, { batch: true, retryCount: 2, timeout: 12_000 }),
})

export const gameAddress = publicEnv.gameAddress
export const vaultAddress = publicEnv.vaultAddress
export const randomnessAddress = publicEnv.randomnessAddress
