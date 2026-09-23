import { createPublicClient, http } from 'viem'
import { bsc, bscTestnet } from 'viem/chains'
import { publicEnv } from '../env'

/** Server-side read client. Never holds a key and never signs. */
export const publicClient = createPublicClient({
  chain: publicEnv.chainId === 97 ? bscTestnet : bsc,
  transport: http(publicEnv.rpcUrl, { batch: true, retryCount: 2, timeout: 12_000 }),
})

export const gameAddress = publicEnv.gameAddress
export const vaultAddress = publicEnv.vaultAddress
