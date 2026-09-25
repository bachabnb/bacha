import { bsc, bscTestnet } from 'wagmi/chains'
import { publicEnv } from './env'

export const supportedChains = [bsc, bscTestnet] as const

export const activeChain = publicEnv.chainId === 97 ? bscTestnet : bsc

export const isTestnet = publicEnv.chainId === 97

export const explorerBase = isTestnet ? 'https://testnet.bscscan.com' : 'https://bscscan.com'

export const explorer = {
  tx: (hash: string) => `${explorerBase}/tx/${hash}`,
  address: (address: string) => `${explorerBase}/address/${address}`,
  token: (address: string) => `${explorerBase}/token/${address}`,
  block: (block: number | bigint) => `${explorerBase}/block/${block}`,
}

export const networkLabel = isTestnet ? 'BNB Chain Testnet' : 'BNB Chain'

/**
 * The randomness beacon.
 *
 * Bacha runs its own commit–reveal beacon rather than an external VRF. There
 * is no third-party coordinator address to look up: the contract is deployed
 * alongside the game and its address comes from the same configuration.
 *
 * Unlike the old coordinator constant, this cannot be hardcoded per chain —
 * an address that is not deployed must read as not deployed.
 */
export const beacon = {
  address: publicEnv.randomnessAddress,
  source: 'https://github.com/bachabnb/bacha/blob/main/contracts/src/BachaRandomness.sol',
} as const
