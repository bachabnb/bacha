'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { createAppKit, useAppKitTheme } from '@reown/appkit/react'
import { useEffect, useState, type ReactNode } from 'react'
import { wagmiAdapter, wagmiConfig, activeNetwork, reownProjectId } from '@/lib/wagmi'
import { publicEnv } from '@/lib/env'
import { SoundProvider } from '@/components/play/SoundProvider'
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeProvider'

/**
 * The connect modal. Created once, at module load, as AppKit requires; the
 * page's own origin is used for the metadata so wallets show the domain the
 * player is actually on (a mismatch makes Reown flag the site as unverified).
 */
const origin = typeof window !== 'undefined' ? window.location.origin : publicEnv.siteUrl

createAppKit({
  adapters: [wagmiAdapter],
  projectId: reownProjectId,
  networks: [activeNetwork],
  defaultNetwork: activeNetwork,
  metadata: {
    name: 'Bacha',
    description: 'An onchain gacha machine for tokenized stocks on BNB Chain.',
    url: origin,
    icons: [`${origin}/icon`],
  },
  // Wallets only: no email or social accounts, no swaps or card on-ramp.
  features: { email: false, socials: false, swaps: false, onramp: false, send: false, history: false },
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4', // Binance Wallet
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', // OKX Wallet
  ],
  termsConditionsUrl: `${origin}/terms`,
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#f0b90b',
    '--w3m-color-mix': '#f0b90b',
    '--w3m-color-mix-strength': 6,
    '--w3m-font-family': 'var(--font-inter), system-ui, sans-serif',
    '--w3m-border-radius-master': '3px',
    '--w3m-z-index': 100,
  },
})

/** Keeps the modal on the same light/dark theme as the site. */
function AppKitThemeSync() {
  const { theme } = useTheme()
  const { setThemeMode } = useAppKitTheme()
  useEffect(() => setThemeMode(theme), [theme, setThemeMode])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  )

  return (
    <ThemeProvider>
      <AppKitThemeSync />
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SoundProvider>
            <TooltipProvider delayDuration={180}>{children}</TooltipProvider>
          </SoundProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}
