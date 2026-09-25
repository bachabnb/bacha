'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { BachaWordmark } from '@/components/brand/BachaLogo'
import { publicEnv, contractsConfigured } from '@/lib/env'
import { explorer, networkLabel } from '@/lib/chain'
import { shortAddress } from '@/lib/format'
import { BnbChainLockup, BnbChainMark } from '@/components/brand/BnbChain'

const COLUMNS = [
  { key: 'play', links: [['play', '/play'], ['machines', '/#machines'], ['me', '/me']] },
  { key: 'explore', links: [['rewards', '/rewards'], ['activity', '/activity'], ['tokens', '/rewards#roster']] },
  { key: 'transparency', links: [['fairness', '/fairness'], ['whitepaper', '/whitepaper'], ['contracts', '/fairness#contracts'], ['docs', '/docs']] },
  { key: 'about', links: [['about', '/about'], ['faq', '/docs#faq'], ['terms', '/terms']] },
] as const

const SOCIAL: [string, string][] = [['X', 'https://x.com/bachabnb']]

export function SiteFooter() {
  const t = useTranslations('footer')
  const pathname = usePathname()
  if (pathname?.includes('/admin')) return null

  return (
    <footer data-zone="cool" className="canvas-atmosphere relative mt-24 overflow-hidden border-t border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-60" />
      <div className="shell-wide relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2.7fr]">
          <div>
            <BachaWordmark
              iconClassName="h-[64px] w-[53px]"
              wordmarkClassName="text-[2.1rem]"
              className="gap-3.5"
            />
            <p className="mt-5 max-w-xs text-[0.88rem] leading-relaxed text-foreground-secondary">
              {t('tagline')}
            </p>
            <div className="mt-6">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.16em] text-foreground-muted">
                {t('builtOn')}
              </p>
              <a
                href="https://www.bnbchain.org"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex transition-opacity hover:opacity-80"
              >
                <BnbChainLockup className="h-[22px] w-auto" title="BNB Chain" />
              </a>
            </div>
            <div className="mt-5 flex gap-4">
              {SOCIAL.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.82rem] text-foreground-secondary transition-colors hover:text-foreground"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.key}>
                <h3 className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                  {t(`columns.${col.key}`)}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map(([key, href]) => (
                    <li key={key}>
                      <Link
                        href={href}
                        className="text-[0.84rem] text-foreground-secondary transition-colors hover:text-foreground"
                      >
                        {t(`links.${key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 hairline-x" />

        <div className="mt-6 flex flex-col gap-4 text-[0.74rem] text-foreground-muted md:flex-row md:items-start md:justify-between">
          <p className="max-w-2xl leading-relaxed">{t('disclaimer')}</p>
          <div className="flex shrink-0 items-center gap-4">
            <span className="num inline-flex items-center gap-1.5">
              <BnbChainMark className="h-[13px] w-[11px]" />
              {networkLabel}
            </span>
            {contractsConfigured && publicEnv.gameAddress ? (
              <a
                href={explorer.address(publicEnv.gameAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="num transition-colors hover:text-foreground-secondary"
              >
                {shortAddress(publicEnv.gameAddress)}
              </a>
            ) : (
              <span className="num">{t('contractsNotDeployed')}</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
