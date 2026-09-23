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
 * Chainlink VRF v2.5 coordinators, for the fairness page and deploy docs.
 * Confirm against docs.chain.link before deploying — Chainlink does rotate these.
 */
export const vrfCoordinators: Record<number, { address: string; docs: string }> = {
  56: {
    address: '0xd691f04bc0C9a24Edb78af9E005Cf85768F694C9',
    docs: 'https://docs.chain.link/vrf/v2-5/supported-networks#bnb-chain',
  },
  97: {
    address: '0xDA3b641D438362C440Ac5458c57e00a712b66700',
    docs: 'https://docs.chain.link/vrf/v2-5/supported-networks#bnb-chain-testnet',
  },
}
