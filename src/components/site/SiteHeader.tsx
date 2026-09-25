'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { BachaWordmark } from '@/components/brand/BachaLogo'
import { MegaMenu } from './MegaMenu'
import { MobileNav } from './MobileNav'
import { ConnectButton } from './ConnectButton'
import { NetworkChip } from './NetworkChip'
import { ThemeToggle } from './ThemeToggle'
import { LanguageSelect } from './LanguageSelect'
import { cn } from '@/lib/cn'

/**
 * The header is a floating control panel, not a bar welded to the viewport.
 *
 * It sits inset from every edge with its own rounded shell, so the page
 * scrolls underneath it rather than against it — which is what makes the
 * whole thing read as hardware sitting on a surface. It gains contrast as
 * content passes beneath, and never grows tall enough to crowd the hero.
 */
export function SiteHeader() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (pathname?.includes('/admin')) return null

  return (
    <div className="pointer-events-none sticky top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5 lg:px-8 lg:pt-6">
      <header
        className={cn(
          'pointer-events-auto mx-auto flex h-[64px] w-full max-w-[1450px] items-center justify-between',
          'gap-4 rounded-[22px] border px-3 backdrop-blur-xl sm:h-[70px] sm:gap-6 sm:rounded-[26px] sm:px-4',
          'transition-[background-color,border-color,box-shadow] duration-300',
          scrolled ? 'header-shell header-shell-raised' : 'header-shell',
        )}
      >
        <div className="flex min-w-0 items-center gap-6 self-stretch xl:gap-9">
          <Link href="/" className="shrink-0 rounded-[12px]" aria-label="Bacha">
            <BachaWordmark
              iconClassName="h-[36px] w-[30px] sm:h-[44px] sm:w-[36px]"
              wordmarkClassName="text-[1.3rem] sm:text-[1.45rem]"
            />
          </Link>
          <MegaMenu className="hidden self-stretch lg:flex" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://x.com/bachabnb"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Bacha on X"
            className="hidden h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-border bg-surface text-foreground-muted transition-colors hover:text-foreground xl:inline-flex"
          >
            <svg viewBox="0 0 18 18" className="h-[15px] w-[15px]" fill="currentColor" aria-hidden="true">
              <path d="M13.9 2.2h2.4l-5.3 6 6.2 8.2h-4.9l-3.8-5-4.4 5H1.7l5.6-6.4L1.4 2.2h5l3.5 4.6 4-4.6Zm-.9 12.8h1.4L5.9 3.6H4.4l8.6 11.4Z" />
            </svg>
          </a>

          <NetworkChip className="hidden md:inline-flex" />
          <LanguageSelect className="hidden sm:inline-flex" />
          <ThemeToggle className="hidden sm:inline-flex" />
          <ConnectButton className="hidden sm:inline-flex" size="lg" />
          {/* Mobile keeps the wallet reachable without the label, which will
              not fit next to the wordmark at 375px. */}
          <ConnectButton className="sm:hidden" compact />
          <MobileNav />
        </div>
      </header>
      <span className="sr-only">{t('menu')}</span>
    </div>
  )
}
