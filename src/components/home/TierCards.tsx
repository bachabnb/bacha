'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { SectionHeader } from './SectionHeader'
import { OddsBar } from '@/components/ui/OddsBar'
import { Button } from '@/components/ui/Button'
import { ArtImage } from '@/components/brand/ArtImage'
import { machines, rarityBreakdown } from '@/lib/machine'
import type { ArtId } from '@/lib/art'
import { cn } from '@/lib/cn'

const ART: Record<string, ArtId> = {
  quick: 'tier-quick',
  boost: 'tier-boost',
  max: 'tier-max',
}

/**
 * Machine tiers.
 *
 * Each card leads with the machine module itself, so the three read as a
 * product family that escalates. Only the prize-table differences are stated —
 * a higher tier is a different distribution, not a better deal, and the copy
 * never implies otherwise.
 */
export function TierCards() {
  const t = useTranslations('tiers')
  const reduce = useReducedMotion()

  return (
    <section data-zone="warm" className="canvas-atmosphere section-viewport">
      <div className="shell-wide">
      <SectionHeader index="05" eyebrow={t('eyebrow')} title={t('title')}>
        {t('body')}
      </SectionHeader>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {machines.map((machine, i) => {
          const featured = machine.id === 'max'
          const distinctAssets = new Set(machine.prizes.map((p) => p.token.toLowerCase())).size

          return (
            <motion.article
              key={machine.id}
              initial={reduce ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-[18px] border transition-colors',
                featured ? 'border-brand-line bg-surface-raised' : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              {featured && (
                <span
                  aria-hidden
                  className="atmosphere-glow pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full"
                />
              )}

              <div className="relative flex h-[9rem] items-end justify-center pt-4">
                <motion.div
                  className="art-grounded h-full w-auto"
                  animate={reduce ? {} : { y: [0, -5, 0] }}
                  transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArtImage
                    id={ART[machine.id] ?? 'tier-quick'}
                    alt=""
                    className="h-full w-auto"
                    sizes="(max-width: 1024px) 50vw, 20vw"
                  />
                </motion.div>
              </div>

              <div className="relative flex flex-1 flex-col p-5 lg:p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-[1.7rem] font-extrabold tracking-[-0.04em] text-foreground">
                    {machine.label}
                  </h3>
                  <span className="num text-[0.74rem] text-foreground-muted">
                    ≈ {machine.priceBnb} BNB
                  </span>
                </div>
                <p className="mt-1.5 text-[0.82rem] text-foreground-muted">{t(`${machine.id}.note`)}</p>

                <div className="mt-4 font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.05em] text-foreground">
                  ${machine.referencePriceUsd.toFixed(0)}
                </div>

                <div className="mt-5">
                  <OddsBar segments={rarityBreakdown(machine)} />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-y-2 border-t border-border pt-4 text-[0.78rem]">
                  <dt className="text-foreground-muted">{t('possibleRewards')}</dt>
                  <dd className="num text-right text-foreground">{t('tokens', { count: distinctAssets })}</dd>
                  <dt className="text-foreground-muted">{t('prizeEntries')}</dt>
                  <dd className="num text-right text-foreground">{machine.prizes.length}</dd>
                </dl>

                <Button
                  asChild
                  className="mt-5 w-full"
                  variant={featured ? 'primary' : 'secondary'}
                >
                  <Link href={`/play?machine=${machine.id}`}>
                    {t('spinTier', { tier: machine.label })}
                  </Link>
                </Button>
              </div>
            </motion.article>
          )
        })}
      </div>

      <p className="mt-5 text-[0.76rem] text-foreground-muted">{t('priceNote')}</p>
    </div>
    </section>
  )
}
