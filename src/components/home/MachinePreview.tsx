'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { OddsBar } from '@/components/ui/OddsBar'
import { Button } from '@/components/ui/Button'
import { TokenMark } from '@/components/ui/TokenMark'
import { BachaMachine } from '@/components/brand/BachaMachine'
import { machines, rarityBreakdown } from '@/lib/machine'
import { tokenByAddress } from '@/lib/tokens'
import { contractsConfigured } from '@/lib/env'
import { networkLabel } from '@/lib/chain'
import { formatTokenAmount, timeAgo } from '@/lib/format'
import type { SpinRecord } from '@/lib/spin/types'
import { cn } from '@/lib/cn'

/**
 * A live look at the running configuration.
 *
 * Everything here is read from the same prize tables a spin resolves against,
 * so switching tiers genuinely changes what is shown. The latest settlement is
 * a real record, or nothing at all.
 */
export function MachinePreview({ latest }: { latest: SpinRecord | null }) {
  const t = useTranslations('machinePreview')
  const [active, setActive] = useState(machines[0].id)
  const reduce = useReducedMotion()
  const machine = machines.find((m) => m.id === active) ?? machines[0]

  const chamberTokens = Array.from(
    new Map(
      machine.prizes
        .map((p) => tokenByAddress(p.token))
        .filter((token): token is NonNullable<typeof token> => Boolean(token))
        .map((token) => [token.id, token]),
    ).values(),
  )

  const latestToken = latest?.rewardTokenAddress ? tokenByAddress(latest.rewardTokenAddress) : undefined

  return (
    <section data-zone="cool" className="canvas-atmosphere section-viewport relative border-y border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-70" />

      <div className="shell-wide relative grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
        <div className="relative mx-auto w-full max-w-[17rem] lg:max-w-[21rem]">
          <span aria-hidden className="atmosphere-glow absolute inset-[10%] rounded-full" />
          {/* Same machine as the hero, loaded with this tier's actual roster. */}
          <BachaMachine
            tokens={chamberTokens.map((token) => ({
              id: token.id,
              symbol: token.symbol,
              logo: token.logo,
            }))}
            compact
            label={`BACHA · ${machine.label}`}
            className="relative"
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">{t('label')}</span>
            {contractsConfigured && (
              <span className="inline-flex items-center gap-2 rounded-[6px] border border-border px-2 py-1">
                <span className="live-dot" />
                <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-foreground-secondary">
                  {t('live')}
                </span>
              </span>
            )}
          </div>

          <h2 className="type-section mt-4 font-display font-extrabold text-foreground">{t('title')}</h2>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-foreground-secondary">{t('body')}</p>

          <div className="mt-7 inline-flex rounded-[10px] border border-border bg-surface p-1">
            {machines.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                aria-pressed={m.id === active}
                className={cn(
                  'relative min-h-[2.25rem] rounded-[7px] px-4 text-[0.8rem] font-medium transition-colors',
                  m.id === active ? 'text-brand-foreground' : 'text-foreground-secondary hover:text-foreground',
                )}
              >
                {m.id === active && (
                  <motion.span
                    layoutId="preview-tier"
                    className="absolute inset-0 rounded-[7px] bg-brand"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 panel p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                  {t('spinPrice')}
                </div>
                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.05em] text-foreground">
                    ${machine.referencePriceUsd.toFixed(0)}
                  </span>
                  <span className="num text-[0.78rem] text-foreground-muted">≈ {machine.priceBnb} BNB</span>
                </div>
              </div>
              <Button asChild>
                <Link href={`/play?machine=${machine.id}`}>{t('openMachine')}</Link>
              </Button>
            </div>

            <div className="mt-7">
              <div className="mb-3 text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                {t('distribution')}
              </div>
              <OddsBar segments={rarityBreakdown(machine)} />
            </div>

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-3">
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                  {t('poolHealth')}
                </dt>
                <dd className="num mt-1 text-[0.9rem] font-medium text-foreground">{chamberTokens.length}</dd>
              </div>
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                  {t('network')}
                </dt>
                <dd className="mt-1 truncate text-[0.9rem] font-medium text-foreground">{networkLabel}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                  {t('latest')}
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-[0.9rem] font-medium text-foreground">
                  {latest && latestToken && latest.rewardAmount != null ? (
                    <>
                      <TokenMark token={latestToken} size={18} ring={false} />
                      <span className="num truncate">
                        {formatTokenAmount(latest.rewardAmount, latestToken.symbol)}
                      </span>
                      <span className="num shrink-0 text-[0.7rem] text-foreground-muted">
                        {timeAgo(latest.settledAt ?? latest.requestedAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-foreground-muted">{t('noSettlement')}</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-3 text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                {t('inMachine')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chamberTokens.map((token) => (
                  <span
                    key={token.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-2.5"
                  >
                    <TokenMark token={token} size={18} ring={false} />
                    <span className="num text-[0.7rem] text-foreground-secondary">{token.symbol}</span>
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
