'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { useState, type ReactNode } from 'react'
import { wagmiConfig } from '@/lib/wagmi'
import { SoundProvider } from '@/components/play/SoundProvider'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'

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
