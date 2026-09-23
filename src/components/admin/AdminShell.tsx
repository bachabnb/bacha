'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BachaWordmark } from '@/components/brand/BachaLogo'
import { ThemeToggle } from '@/components/site/ThemeToggle'
import { NetworkBadge } from '@/components/site/NetworkBadge'
import { ConnectButton } from '@/components/site/ConnectButton'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/assets', label: 'Reward assets' },
  { href: '/admin/machines', label: 'Machines' },
  { href: '/admin/tables', label: 'Prize tables' },
  { href: '/admin/vault', label: 'Vault' },
  { href: '/admin/spins', label: 'Spins' },
  { href: '/admin/settings', label: 'Settings' },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex h-[60px] items-center justify-between gap-6 px-5">
          <div className="flex items-center gap-4">
            <Link href="/admin" aria-label="Bacha admin">
              <BachaWordmark />
            </Link>
            <span className="tag tag-neutral">Operator</span>
          </div>
          <div className="flex items-center gap-2">
            <NetworkBadge className="hidden md:inline-flex" />
            <ThemeToggle />
            <ConnectButton />
            <button
              onClick={async () => {
                await fetch('/api/admin/session', { method: 'DELETE' })
                window.location.href = '/admin'
              }}
              className="h-9 rounded-[9px] border border-border bg-surface px-3 text-[0.78rem] text-foreground-secondary transition-colors hover:text-foreground"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Admin sections"
          className="shrink-0 border-b border-border bg-background-secondary lg:w-60 lg:border-b-0 lg:border-r"
        >
          <ul className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
            {NAV.map((item) => {
              const active =
                item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'block whitespace-nowrap rounded-[8px] px-3 py-2 text-[0.84rem] font-medium transition-colors',
                      active
                        ? 'bg-brand-soft text-brand'
                        : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
