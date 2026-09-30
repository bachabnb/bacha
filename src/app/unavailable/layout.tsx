import type { Metadata } from 'next'
import { Inter, Inter_Tight } from 'next/font/google'
import { ThemeScript } from '@/lib/theme/ThemeScript'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap' })

export const metadata: Metadata = {
  title: 'Bacha — Unavailable',
  robots: { index: false, follow: false },
}

/**
 * Where the geofence in middleware sends a blocked request. It sits outside
 * the locale tree because the rewrite happens before locale routing, and it
 * loads no wallet or spin code — a blocked visitor never reaches anything
 * that could take money.
 */
export default function UnavailableLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${interTight.variable}`}>
      <body className="min-h-dvh bg-background antialiased">
        <ThemeScript />
        {children}
      </body>
    </html>
  )
}
