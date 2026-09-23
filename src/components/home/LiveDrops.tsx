'use client'

import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import useFeed from '@/lib/useFeed'
import { SectionHeader } from './SectionHeader'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { Button } from '@/components/ui/Button'
import { ArtImage } from '@/components/brand/ArtImage'
import { tokenByAddress } from '@/lib/tokens'
import { machineById } from '@/lib/machine'
import { shortAddress, formatTokenAmount } from '@/lib/format'
import { explorer } from '@/lib/chain'
import { useTimeAgo } from '@/lib/useTimeAgo'

/**
 * "Just pulled."
 *
 * Rows are real settled spins — from chain when contracts are live, from the
 * demo machine otherwise — and the eyebrow always says which. No row is ever
 * invented to fill the section.
 */
export function LiveDrops() {
  const t = useTranslations('activity')
  const { data, error } = useFeed('/api/spins?limit=8', 12_000)
  const reduce = useReducedMotion()

  const spins = (data?.spins ?? []).filter((s) => s.status !== 'PENDING').slice(0, 6)
  const isDemo = data?.mode === 'demo'

  return (
    <section data-zone="pale" className="canvas-atmosphere section-viewport">
      <div className="shell-wide">
      <SectionHeader
        index="06"
        eyebrow={isDemo ? t('eyebrowDemo') : t('eyebrow')}
        title={t('title')}
        action={
          <Button asChild variant="secondary">
            <Link href="/activity">{t('fullActivity')}</Link>
          </Button>
        }
      >
        {isDemo ? t('bodyDemo') : t('body')}
      </SectionHeader>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_2.1fr] lg:items-center lg:gap-12">
        <div className="art-grounded relative mx-auto w-full max-w-[22rem] lg:max-w-none">
          <span aria-hidden className="atmosphere-glow absolute inset-[12%] rounded-full" />
          <ArtImage
            id="activity-rail"
            alt={t('railAlt')}
            className="relative"
            sizes="(max-width: 1024px) 70vw, 28vw"
          />
        </div>

        <div className="overflow-hidden rounded-[16px] border border-border bg-surface">
          {error || (data && spins.length === 0) ? (
            <Empty title={t('empty.title')} hint={t('empty.hint')} />
          ) : !data ? (
            <Skeleton />
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {spins.map((spin, i) => {
                  const token = spin.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined
                  const machine = machineById(spin.machineId)
                  return (
                    <motion.li
                      key={`${spin.mode}-${spin.id}`}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className={i > 0 ? 'border-t border-border' : undefined}
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-hover">
                        {token ? (
                          <TokenMark token={token} size={32} />
                        ) : (
                          <span className="h-8 w-8 rounded-full bg-surface-hover" />
                        )}

                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                          {spin.mode === 'onchain' ? (
                            <a
                              href={explorer.address(spin.player)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="num text-[0.8rem] text-foreground-muted transition-colors hover:text-foreground"
                            >
                              {shortAddress(spin.player)}
                            </a>
                          ) : (
                            <span className="num text-[0.8rem] text-foreground-muted">
                              {shortAddress(spin.player)}
                            </span>
                          )}
                          <span className="text-[0.8rem] text-foreground-muted">{t('pulled')}</span>
                          <span className="num text-[0.9rem] font-semibold text-foreground">
                            {spin.rewardAmount != null
                              ? formatTokenAmount(spin.rewardAmount, token?.symbol ?? '')
                              : '—'}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          {spin.rarity && <RarityChip rarity={spin.rarity} />}
                          <span className="hidden text-[0.72rem] text-foreground-muted sm:inline">
                            {machine?.label ?? `T${spin.tierId}`}
                          </span>
                          <Relative timestamp={spin.settledAt ?? spin.requestedAt} />
                        </div>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
    </section>
  )
}

function Relative({ timestamp }: { timestamp: number }) {
  const label = useTimeAgo(timestamp)
  return <span className="num w-[5.5rem] shrink-0 text-right text-[0.72rem] text-foreground-muted">{label}</span>
}

function Skeleton() {
  return (
    <ul>
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className={i > 0 ? 'border-t border-border' : undefined}>
          <div className="flex items-center gap-4 px-5 py-4">
            <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-hover" />
            <span className="h-3 w-40 animate-pulse rounded bg-surface-hover" />
            <span className="ml-auto h-3 w-16 animate-pulse rounded bg-surface-hover" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[0.92rem] text-foreground-secondary">{title}</p>
      <p className="mt-1.5 text-[0.8rem] text-foreground-muted">{hint}</p>
    </div>
  )
}
