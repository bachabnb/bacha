'use client'

import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import useFeed from '@/lib/useFeed'
import { formatUsd } from '@/lib/format'
import type { MarketQuote } from '@/lib/market'

/**
 * A small readout of what this wallet has done.
 *
 * Counts and an indicative valuation of what is held — never a profit figure,
 * because a spin's cost and its reward are not the same kind of number and
 * presenting them as one would be misleading. Hidden entirely when no wallet
 * is connected rather than shown as an empty shell.
 */
export function SessionPanel({ quotes }: { quotes: Record<string, MarketQuote> }) {
  const t = useTranslations('play.session')
  const { address, isConnected } = useAccount()
  const { data } = useFeed(
    address ? `/api/spins?limit=60&player=${address}` : '/api/spins?limit=0',
    20_000,
  )

  const summary = useMemo(() => {
    const spins = data?.spins ?? []
    let value = 0
    let rare = 0
    let unclaimed = 0
    for (const spin of spins) {
      if (spin.rarity === 'RARE' || spin.rarity === 'EPIC') rare++
      if (spin.status === 'SETTLED') unclaimed++
      const quote = spin.rewardTokenAddress ? quotes[spin.rewardTokenAddress.toLowerCase()] : undefined
      if (quote?.priceUsd != null && spin.rewardAmount != null && spin.status !== 'PENDING') {
        value += quote.priceUsd * spin.rewardAmount
      }
    }
    return { total: spins.length, value, rare, unclaimed }
  }, [data, quotes])

  if (!isConnected || summary.total === 0) return null

  return (
    <section aria-labelledby="your-session" className="card-physical p-5">
      <h2
        id="your-session"
        className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted"
      >
        {t('title')}
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
        <Metric label={t('spins')} value={String(summary.total)} />
        <Metric label={t('rewards')} value={formatUsd(summary.value, { approx: true })} />
        <Metric label={t('rare')} value={String(summary.rare)} />
        <Metric
          label={t('unclaimed')}
          value={String(summary.unclaimed)}
          tone={summary.unclaimed > 0 ? 'brand' : 'default'}
        />
      </dl>

      <p className="mt-4 text-[0.7rem] leading-relaxed text-foreground-muted">{t('note')}</p>
    </section>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'brand'
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">{label}</dt>
      <dd
        className={`num mt-1 truncate font-display text-[1.35rem] font-extrabold tracking-[-0.04em] ${
          tone === 'brand' ? 'text-brand' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
