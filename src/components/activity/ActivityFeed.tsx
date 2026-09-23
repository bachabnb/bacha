'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import useFeed from '@/lib/useFeed'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { Capsule } from '@/components/brand/Capsule'
import { tokenByAddress } from '@/lib/tokens'
import { machineById } from '@/lib/machine'
import { RARITIES, type Rarity } from '@/lib/rarity'
import { shortAddress, shortHash, formatTokenAmount, formatUsd, formatBnb } from '@/lib/format'
import { useTimeAgo } from '@/lib/useTimeAgo'
import { explorer } from '@/lib/chain'
import { cn } from '@/lib/cn'
import type { MarketQuote } from '@/lib/market'

type Filter = 'ALL' | Rarity

export function ActivityFeed({ quotes }: { quotes: Record<string, MarketQuote> }) {
  const t = useTranslations('activity')
  const r = useTranslations('rarity')
  const { data, error } = useFeed('/api/spins?limit=100', 15_000)
  const [filter, setFilter] = useState<Filter>('ALL')
  const reduce = useReducedMotion()

  const settled = useMemo(
    () => (data?.spins ?? []).filter((s) => s.status !== 'PENDING' && s.rarity),
    [data],
  )
  const rows = useMemo(
    () => (filter === 'ALL' ? settled : settled.filter((s) => s.rarity === filter)),
    [settled, filter],
  )

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: settled.length }
    for (const r of RARITIES) map[r] = settled.filter((s) => s.rarity === r).length
    return map
  }, [settled])

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by rarity">
          {(['ALL', ...RARITIES] as Filter[]).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              aria-pressed={filter === option}
              className={cn(
                'rounded-[8px] border px-3 py-1.5 text-[0.76rem] font-medium transition-colors',
                filter === option
                  ? 'border-brand-line bg-brand-soft text-brand'
                  : 'border-border bg-surface text-foreground-secondary hover:border-border-strong hover:text-foreground',
              )}
            >
              {option === 'ALL' ? t('filters.all') : r(option)}
              <span className="num ml-1.5 text-[0.68rem] opacity-60">{counts[option] ?? 0}</span>
            </button>
          ))}
        </div>

        {data && (
          <span className="tag tag-neutral">
            {data.mode === 'demo' ? t('modeDemo') : t('modeLive')}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-border bg-surface">
        <div className="hidden grid-cols-[7rem_8rem_6rem_7rem_1fr_7rem_6rem_6rem] gap-4 border-b border-border px-6 py-3 text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted lg:grid">
          <span>{t('columns.time')}</span>
          <span>{t('columns.player')}</span>
          <span>{t('columns.machine')}</span>
          <span>{t('columns.paid')}</span>
          <span>{t('columns.pulled')}</span>
          <span className="text-right">{t('columns.value')}</span>
          <span>{t('columns.rarity')}</span>
          <span className="text-right">{t('columns.transaction')}</span>
        </div>

        {error ? (
          <Empty title={t('error.title')} hint={t('error.hint')} />
        ) : !data ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <Empty
            title={filter === 'ALL' ? t('empty.title') : t('empty.titleFiltered', { rarity: r(filter) })}
            hint={t('empty.hint')}
          />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {rows.map((spin, i) => {
                const token = spin.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined
                const machine = machineById(spin.machineId)
                const quote = spin.rewardTokenAddress ? quotes[spin.rewardTokenAddress.toLowerCase()] : undefined
                const value =
                  quote?.priceUsd != null && spin.rewardAmount != null
                    ? quote.priceUsd * spin.rewardAmount
                    : null

                return (
                  <motion.li
                    key={`${spin.mode}-${spin.id}`}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className={cn('px-6 py-4 transition-colors hover:bg-surface', i > 0 && 'border-t border-border')}
                  >
                    <div className="grid grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[7rem_8rem_6rem_7rem_1fr_7rem_6rem_6rem]">
                      <RelativeTime
                        timestamp={spin.settledAt ?? spin.requestedAt}
                        className="order-2 lg:order-none"
                      />

                      <span className="num order-1 hidden text-[0.78rem] lg:order-none lg:block">
                        {spin.mode === 'onchain' ? (
                          <a
                            href={explorer.address(spin.player)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground-secondary transition-colors hover:text-foreground"
                          >
                            {shortAddress(spin.player)}
                          </a>
                        ) : (
                          <span className="text-foreground-secondary">{shortAddress(spin.player)}</span>
                        )}
                      </span>

                      <span className="hidden text-[0.78rem] text-foreground-secondary lg:block">{machine?.label ?? `T${spin.tierId}`}</span>

                      <span className="num hidden text-[0.78rem] text-foreground-secondary lg:block">
                        {formatBnb(BigInt(spin.paymentWei), 4)} BNB
                      </span>

                      <span className="order-0 flex min-w-0 items-center gap-2.5 lg:order-none">
                        {token ? <TokenMark token={token} size={26} /> : <span className="h-[26px] w-[26px] rounded-full bg-surface-raised" />}
                        <span className="num truncate text-[0.85rem] font-medium text-foreground">
                          {spin.rewardAmount != null ? formatTokenAmount(spin.rewardAmount, token?.symbol ?? '') : '—'}
                        </span>
                      </span>

                      <span className="num hidden text-right text-[0.8rem] text-foreground-secondary lg:block">
                        {value != null ? formatUsd(value) : '—'}
                      </span>

                      <span className="order-3 lg:order-none">{spin.rarity && <RarityChip rarity={spin.rarity} />}</span>

                      <span className="num hidden text-right text-[0.74rem] lg:block">
                        {spin.txHash ? (
                          <a
                            href={explorer.tx(spin.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground-secondary transition-colors hover:text-foreground"
                          >
                            {shortHash(spin.txHash, 4, 3)}
                          </a>
                        ) : (
                          <span className="text-foreground-muted">{t('modeDemo')}</span>
                        )}
                      </span>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </>
  )
}

function RelativeTime({ timestamp, className }: { timestamp: number; className?: string }) {
  const label = useTimeAgo(timestamp)
  return <span className={cn('num text-[0.74rem] text-foreground-muted', className)}>{label}</span>
}

function Skeleton() {
  return (
    <ul>
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className={cn('flex items-center gap-4 px-6 py-4', i > 0 && 'border-t border-border')}>
          <span className="h-[26px] w-[26px] animate-pulse rounded-full bg-surface-hover" />
          <span className="h-3 w-48 animate-pulse rounded bg-surface-hover" />
          <span className="ml-auto h-3 w-20 animate-pulse rounded bg-surface" />
        </li>
      ))}
    </ul>
  )
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <Capsule finish="graphite" size={56} />
      <p className="mt-6 text-[0.95rem] text-foreground-secondary">{title}</p>
      <p className="mt-1.5 max-w-sm text-[0.8rem] text-foreground-muted">{hint}</p>
    </div>
  )
}
