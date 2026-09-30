import { http, cookieStorage, createStorage } from 'wagmi'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { bsc, bscTestnet } from '@reown/appkit/networks'
import { publicEnv } from './env'

/**
 * Wallet setup, through Reown AppKit.
 *
 * AppKit brings the connect modal: injected wallets (MetaMask, Trust, Rabby,
 * OKX, Binance Wallet's extension…), WalletConnect QR and mobile deep links,
 * all discovered through EIP-6963. Wagmi stays underneath, so every hook in
 * the app keeps working unchanged.
 *
 * Only the configured chain is offered. A player who ends up elsewhere sees
 * the switch-network button, never a testnet in the modal's network list.
 */

/** Public by design: it identifies the dapp to Reown and ships in the bundle. */
export const reownProjectId = publicEnv.walletConnectProjectId

export const activeNetwork = publicEnv.chainId === 97 ? bscTestnet : bsc

export const wagmiAdapter = new WagmiAdapter({
  projectId: reownProjectId,
  networks: [activeNetwork],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: { [activeNetwork.id]: http(publicEnv.rpcUrl) },
  customRpcUrls: { [`eip155:${activeNetwork.id}`]: [{ url: publicEnv.rpcUrl }] },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
