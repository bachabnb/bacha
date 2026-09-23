'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { SectionHeader } from './SectionHeader'
import { TokenMark } from '@/components/ui/TokenMark'
import { Button } from '@/components/ui/Button'
import { ArtImage } from '@/components/brand/ArtImage'
import { formatUsd, formatPercent } from '@/lib/format'
import type { RewardToken } from '@/lib/tokens'
import type { MarketQuote } from '@/lib/market'

export interface RosterEntry {
  token: RewardToken
  quote: MarketQuote | null
  bestOdds: number
}

/**
 * The reward roster.
 *
 * Vault artwork on the left, a token matrix on the right — which breaks the
 * headline-then-grid rhythm the rest of the page would otherwise fall into,
 * and gives the section something to look at besides data.
 */
export function WhatsInside({ roster }: { roster: RosterEntry[] }) {
  const t = useTranslations('rewards')
  const reduce = useReducedMotion()

  return (
    <section data-zone="pale" className="canvas-atmosphere section-viewport">
      <div className="shell-wide">
      <SectionHeader
        index="03"
        eyebrow={t('eyebrow')}
        title={t('title')}
        action={
          <Button asChild variant="secondary">
            <Link href="/rewards">{t('allRewards')}</Link>
          </Button>
        }
      >
        {t('body')}
      </SectionHeader>

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.66fr_1.34fr] lg:items-center lg:gap-12">
        <motion.div
          className="art-grounded relative mx-auto w-full max-w-[17rem] lg:max-w-[22rem]"
          initial={reduce ? false : { opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span aria-hidden className="atmosphere-glow absolute inset-[8%] rounded-full" />
          <ArtImage
            id="reward-vault"
            alt={t('vaultAlt')}
            className="relative"
            sizes="(max-width: 1024px) 70vw, 32vw"
          />
        </motion.div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {roster.map(({ token, quote, bestOdds }, i) => (
            <motion.div
              key={token.address}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: Math.min(i, 9) * 0.035 }}
            >
              <Link
                href={`/rewards#${token.id}`}
                className="group relative flex h-full flex-col gap-3 bg-surface p-4 transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="relative">
                    <span
                      aria-hidden
                      className="absolute -inset-1 rounded-full border border-brand-line opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <TokenMark token={token} size={32} />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="font-display text-[1.12rem] font-bold tracking-[-0.03em] text-foreground">
                    {token.symbol}
                  </div>
                  <div className="mt-0.5 truncate text-[0.74rem] text-foreground-muted">{token.name}</div>
                </div>

                <dl className="mt-auto space-y-1 border-t border-border pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-foreground-muted">
                      {t('price')}
                    </dt>
                    <dd className="num text-[0.76rem] text-foreground">
                      {quote?.priceUsd != null ? formatUsd(quote.priceUsd) : '—'}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-foreground-muted">
                      {t('bestOdds')}
                    </dt>
                    <dd className="num text-[0.76rem] text-brand">{formatPercent(bestOdds)}</dd>
                  </div>
                </dl>

                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-brand transition-transform duration-300 group-hover:scale-x-100"
                />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-[0.76rem] leading-relaxed text-foreground-muted">{t('priceNote')}</p>
    </div>
    </section>
  )
}
