'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { Button } from '@/components/ui/Button'
import { Capsule } from '@/components/brand/Capsule'
import { formatUsd, formatPercent, formatTokenAmount, shortAddress } from '@/lib/format'
import { explorer } from '@/lib/chain'
import { machinesContaining, oddsOf, machines } from '@/lib/machine'
import { rarityStyle } from '@/lib/rarity'
import type { RewardToken } from '@/lib/tokens'
import type { MarketQuote } from '@/lib/market'
import { cn } from '@/lib/cn'

export interface RewardCard {
  token: RewardToken
  quote: MarketQuote | null
}

export function RewardsGrid({ cards }: { cards: RewardCard[] }) {
  const t = useTranslations('rewards')
  const [selected, setSelected] = useState<RewardToken | null>(null)
  const reduce = useReducedMotion()
  const activeQuote = cards.find((c) => c.token.address === selected?.address)?.quote ?? null

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ token, quote }, i) => {
          const appearances = machinesContaining(token.address)
          const rarities = Array.from(
            new Set(appearances.flatMap((a) => a.entries.map((e) => e.rarity))),
          )
          const bestOdds = Math.max(...machines.map((m) => oddsOf(m, token.address)))

          return (
            <motion.button
              key={token.address}
              id={token.id}
              onClick={() => setSelected(token)}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.04 }}
              className="group panel scroll-mt-28 p-6 text-left transition-colors hover:border-border-strong hover:bg-surface-raised"
            >
              <div className="flex items-start justify-between gap-4">
                <TokenMark token={token} size={52} />
                <div className="flex flex-wrap justify-end gap-1.5">
                  {rarities.map((r) => (
                    <RarityChip key={r} rarity={r} />
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <h3 className="font-display text-[1.45rem] font-bold tracking-[-0.038em] text-foreground">
                  {token.symbol}
                </h3>
                <p className="mt-0.5 text-[0.84rem] text-foreground-secondary">{token.name}</p>
              </div>

              <p className="mt-3 line-clamp-2 min-h-[2.4rem] text-[0.82rem] leading-relaxed text-foreground-muted">
                {token.blurb}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                <Metric label={t('price')} value={quote?.priceUsd != null ? formatUsd(quote.priceUsd) : '—'} />
                <Metric
                  label={t('change24h')}
                  value={quote?.change24h != null ? `${quote.change24h > 0 ? '+' : ''}${quote.change24h.toFixed(1)}%` : '—'}
                  tone={quote?.change24h == null ? 'muted' : quote.change24h >= 0 ? 'up' : 'down'}
                />
                <Metric label={t('bestOdds')} value={formatPercent(bestOdds)} tone="brand" />
              </div>

              <div className="mt-4 flex items-center gap-1.5">
                {machines.map((m) => {
                  const present = oddsOf(m, token.address) > 0
                  return (
                    <span
                      key={m.id}
                      title={present ? m.label : `${m.label} — ${t('detail.notInMachine')}`}
                      className={cn(
                        'rounded-[4px] border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.1em]',
                        present
                          ? 'border-border-strong text-foreground-secondary'
                          : 'border-border text-foreground-muted/50 line-through',
                      )}
                    >
                      {m.label}
                    </span>
                  )
                })}
              </div>
            </motion.button>
          )
        })}
      </div>

      <RewardDetail token={selected} quote={activeQuote} onClose={() => setSelected(null)} />
    </>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'brand' | 'up' | 'down' | 'muted'
}) {
  return (
    <div className="min-w-0">
      <div className="text-[0.6rem] uppercase tracking-[0.13em] text-foreground-muted">{label}</div>
      <div
        className={cn(
          'num mt-1 truncate text-[0.82rem] font-medium',
          tone === 'brand' && 'text-brand',
          tone === 'up' && 'text-success',
          tone === 'down' && 'text-danger',
          tone === 'muted' && 'text-foreground-muted',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function RewardDetail({
  token,
  quote,
  onClose,
}: {
  token: RewardToken | null
  quote: MarketQuote | null
  onClose: () => void
}) {
  const t = useTranslations('rewards.detail')
  const r = useTranslations('rewards')
  const appearances = token ? machinesContaining(token.address) : []

  return (
    <Dialog.Root open={!!token} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/88 backdrop-blur-md" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-dvh w-[min(30rem,100vw)] overflow-y-auto border-l border-border bg-surface p-7 focus:outline-none">
          {token && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <TokenMark token={token} size={56} />
                  <div>
                    <Dialog.Title className="font-display text-[1.6rem] font-bold tracking-[-0.04em] text-foreground">
                      {token.symbol}
                    </Dialog.Title>
                    <Dialog.Description className="text-[0.86rem] text-foreground-secondary">{token.name}</Dialog.Description>
                  </div>
                </div>
                <Dialog.Close
                  className="rounded-md p-1.5 text-foreground-secondary transition-colors hover:text-foreground"
                  aria-label={t('close')}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </Dialog.Close>
              </div>

              <p className="mt-5 text-[0.9rem] leading-relaxed text-foreground-secondary">{token.blurb}</p>

              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-border bg-surface-hover">
                <DetailCell label={r('price')} value={quote?.priceUsd != null ? formatUsd(quote.priceUsd) : '—'} />
                <DetailCell
                  label={r('change24h')}
                  value={quote?.change24h != null ? `${quote.change24h > 0 ? '+' : ''}${quote.change24h.toFixed(2)}%` : '—'}
                />
                <DetailCell label={t('decimals')} value={String(token.decimals)} />
                <DetailCell label={t('category')} value={token.category} />
              </div>

              <section className="mt-7">
                <h4 className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                  {t('whereItDrops')}
                </h4>
                <div className="mt-3 space-y-2">
                  {appearances.map(({ machine, entries }) => (
                    <div key={machine.id} className="rounded-[10px] border border-border bg-surface p-4">
                      <div className="flex items-baseline justify-between">
                        <span className="font-display text-[1rem] font-bold tracking-[-0.03em] text-foreground">
                          {machine.label}
                        </span>
                        <span className="num text-[0.78rem] text-brand">
                          {formatPercent(oddsOf(machine, token.address))}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {entries.map((entry, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-3 text-[0.78rem]">
                            <span className="num text-foreground-secondary">
                              {formatTokenAmount(entry.amount, token.symbol)}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="num text-foreground-muted">
                                {formatPercent(entry.weight / machine.totalWeight)}
                              </span>
                              <span
                                className="h-1.5 w-1.5 rounded-[1px]"
                                style={{ backgroundColor: rarityStyle[entry.rarity].bar }}
                              />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-7">
                <h4 className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                  {t('verification')}
                </h4>
                <dl className="mt-3 space-y-2.5 text-[0.78rem]">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-foreground-muted">{t('contract')}</dt>
                    <dd>
                      <a
                        href={explorer.token(token.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="num text-foreground-secondary underline decoration-white/20 underline-offset-4 hover:text-foreground"
                      >
                        {shortAddress(token.address, 6, 6)}
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-foreground-muted">{t('verified')}</dt>
                    <dd className="num text-foreground-secondary">{token.verifiedAt}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-foreground-muted">{t('sources')}</dt>
                    <dd className="flex gap-3">
                      {token.source.coingecko && (
                        <a href={token.source.coingecko} target="_blank" rel="noopener noreferrer" className="text-foreground-secondary hover:text-foreground">
                          CoinGecko
                        </a>
                      )}
                      {token.source.dexscreener && (
                        <a href={token.source.dexscreener} target="_blank" rel="noopener noreferrer" className="text-foreground-secondary hover:text-foreground">
                          DexScreener
                        </a>
                      )}
                    </dd>
                  </div>
                </dl>
                {token.transferNotes && (
                  <p className="mt-4 rounded-[8px] border border-warning/25 bg-warning-soft p-3 text-[0.74rem] leading-relaxed text-warning">
                    {token.transferNotes}
                  </p>
                )}
              </section>

              <div className="mt-8 flex items-center gap-3">
                <Capsule finish="bnb" size={40} flat />
                <Button asChild className="flex-1 justify-center">
                  <Link href="/play">{t('spinForIt')}</Link>
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-4">
      <div className="text-[0.62rem] uppercase tracking-[0.14em] text-foreground-muted">{label}</div>
      <div className="num mt-1.5 truncate text-[0.92rem] text-foreground">{value}</div>
    </div>
  )
}
