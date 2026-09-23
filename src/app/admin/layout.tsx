import type { Metadata } from 'next'
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { AdminShell } from '@/components/admin/AdminShell'
import { ThemeScript } from '@/lib/theme/ThemeScript'
import { Providers } from '@/app/providers'
import { isAdminRequest, adminConfigured } from '@/lib/admin/auth'
import { AdminLocked } from '@/components/admin/AdminLocked'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-code', display: 'swap' })

export const metadata: Metadata = {
  title: 'Bacha Admin',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The operator console sits outside the locale tree on purpose: it is an
 * internal tool with one audience, so it is English-only and never indexed.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const configured = adminConfigured()
  const authorised = configured && (await isAdminRequest())

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${interTight.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-background antialiased">
        <ThemeScript />
        <Providers>
          {authorised ? <AdminShell>{children}</AdminShell> : <AdminLocked configured={configured} />}
        </Providers>
      </body>
    </html>
  )
}
