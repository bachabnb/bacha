import { http, createConfig, cookieStorage, createStorage } from 'wagmi'
import { bsc, bscTestnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { publicEnv } from './env'

/**
 * Wallet setup.
 *
 * `injected` covers MetaMask, Trust Wallet's in-app browser, Coinbase Wallet's
 * extension, Rabby and any other EIP-1193 provider. WalletConnect is added only
 * when a project id is configured — without one the connector throws at
 * runtime, so it is better to omit it than to ship a button that cannot work.
 *
 * The dedicated Coinbase connector is deliberately not used: it pulls the
 * whole `@coinbase/cdp-sdk` tree in for no benefit here.
 */
const connectors = [
  injected({ shimDisconnect: true }),
  ...(publicEnv.walletConnectProjectId
    ? [
        walletConnect({
          projectId: publicEnv.walletConnectProjectId,
          showQrModal: true,
          metadata: {
            name: 'Bacha',
            description: 'An onchain gacha game for discovering BNB Chain tokens.',
            url: publicEnv.siteUrl,
            icons: [`${publicEnv.siteUrl}/icon.png`],
          },
        }),
      ]
    : []),
]

export const wagmiConfig = createConfig({
  chains: [bsc, bscTestnet],
  connectors,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [bsc.id]: http(publicEnv.chainId === 56 ? publicEnv.rpcUrl : undefined),
    [bscTestnet.id]: http(publicEnv.chainId === 97 ? publicEnv.rpcUrl : undefined),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}

export const walletConnectAvailable = Boolean(publicEnv.walletConnectProjectId)
