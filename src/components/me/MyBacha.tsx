'use client'

import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import useFeed from '@/lib/useFeed'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { ConnectButton } from '@/components/site/ConnectButton'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { Capsule } from '@/components/brand/Capsule'
import { useTimeAgo } from '@/lib/useTimeAgo'
import { tokenByAddress } from '@/lib/tokens'
import { machineById } from '@/lib/machine'
import { formatTokenAmount, formatUsd, shortHash } from '@/lib/format'
import { explorer } from '@/lib/chain'
import { spinMode } from '@/lib/env'
import { useHumanError } from '@/lib/errors'
import type { MarketQuote } from '@/lib/market'
import type { SpinRecord } from '@/lib/spin/types'

/**
 * A player's own history.
 *
 * Counts only — no performance metrics, no profit-and-loss framing. The USD
 * column is an indicative valuation of what is currently held and is labelled
 * as such, because presenting it as a return would be misleading.
 */
export function MyBacha({ quotes }: { quotes: Record<string, MarketQuote> }) {
  const t = useTranslations('me')
  const { address, isConnected } = useAccount()
  const humanError = useHumanError()
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reduce = useReducedMotion()

  const { data } = useFeed(
    address ? `/api/spins?limit=100&player=${address}` : '/api/spins?limit=0',
    20_000,
  )

  const spins = useMemo(() => (isConnected ? (data?.spins ?? []) : []), [data, isConnected])

  const summary = useMemo(() => {
    let rewardValue = 0
    let rare = 0
    const unclaimed: SpinRecord[] = []
    for (const spin of spins) {
      if (spin.rarity === 'RARE' || spin.rarity === 'EPIC') rare++
      if (spin.status === 'SETTLED') unclaimed.push(spin)
      const quote = spin.rewardTokenAddress ? quotes[spin.rewardTokenAddress.toLowerCase()] : undefined
      if (quote?.priceUsd != null && spin.rewardAmount != null && spin.status !== 'PENDING') {
        rewardValue += quote.priceUsd * spin.rewardAmount
      }
    }
    return { total: spins.length, rewardValue, rare, unclaimed }
  }, [spins, quotes])

  async function claimAll() {
    setClaiming(true)
    setError(null)
    try {
      for (const spin of summary.unclaimed) {
        const res = await fetch('/api/demo/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: spin.id }),
        })
        if (!res.ok) throw new Error(String(res.status))
      }
    } catch (e) {
      setError(humanError(e))
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="shell-wide py-14 lg:py-20">
      <header className="max-w-2xl">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1 className="type-hero mt-4 font-display font-extrabold text-foreground">{t('title')}</h1>
      </header>

      {!isConnected ? (
        <div className="mt-12 flex flex-col items-center rounded-[16px] border border-border bg-surface px-6 py-20 text-center">
          <Capsule finish="bnb" size={64} />
          <p className="mt-7 max-w-sm text-[0.95rem] text-foreground-secondary">{t('connectPrompt')}</p>
          <ConnectButton className="mt-6" />
        </div>
      ) : (
        <>
          <dl className="mt-10 grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={t('totalSpins')} value={String(summary.total)} />
            <Metric label={t('totalRewards')} value={formatUsd(summary.rewardValue, { approx: true })} />
            <Metric label={t('rarePulls')} value={String(summary.rare)} />
            <Metric
              label={t('unclaimed')}
              value={String(summary.unclaimed.length)}
              tone={summary.unclaimed.length > 0 ? 'brand' : 'default'}
            />
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {summary.unclaimed.length > 0 && spinMode === 'demo' && (
              <Button onClick={claimAll} disabled={claiming}>
                {claiming ? t('claiming') : t('claimAll')}
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href="/activity">{t('viewActivity')}</Link>
            </Button>
          </div>

          {error && (
            <p className="mt-4 rounded-[8px] border border-danger/25 bg-danger-soft p-3 text-[0.8rem] text-danger">
              {error}
            </p>
          )}

          <section className="mt-12">
            <h2 className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">{t('history')}</h2>

            {spins.length === 0 ? (
              <div className="mt-4 flex flex-col items-center rounded-[16px] border border-border bg-surface px-6 py-16 text-center">
                <Capsule finish="graphite" size={48} />
                <p className="mt-6 text-[0.92rem] text-foreground-secondary">{t('noSpins')}</p>
                <p className="mt-1.5 text-[0.8rem] text-foreground-muted">{t('noSpinsHint')}</p>
              </div>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spins.map((spin, i) => {
                  const token = spin.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined
                  const machine = machineById(spin.machineId)
                  const quote = spin.rewardTokenAddress ? quotes[spin.rewardTokenAddress.toLowerCase()] : undefined
                  const value =
                    quote?.priceUsd != null && spin.rewardAmount != null
                      ? quote.priceUsd * spin.rewardAmount
                      : null

                  return (
                    <motion.li
                      key={spin.id}
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03 }}
                      className="panel p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {token ? (
                          <TokenMark token={token} size={38} />
                        ) : (
                          <span className="h-[38px] w-[38px] rounded-full bg-surface-hover" />
                        )}
                        {spin.rarity && <RarityChip rarity={spin.rarity} />}
                      </div>

                      <div className="num mt-4 text-[1.05rem] font-semibold text-foreground">
                        {spin.rewardAmount != null
                          ? formatTokenAmount(spin.rewardAmount, token?.symbol ?? '')
                          : '—'}
                      </div>
                      <div className="num mt-0.5 text-[0.78rem] text-foreground-muted">
                        {value != null ? formatUsd(value, { approx: true }) : '—'}
                      </div>

                      <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-[0.72rem]">
                        <Row label={machine?.label ?? `T${spin.tierId}`} value={`#${spin.id}`} />
                        <Row
                          label={<Relative timestamp={spin.settledAt ?? spin.requestedAt} />}
                          value={
                            spin.txHash ? (
                              <a
                                href={explorer.tx(spin.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground"
                              >
                                {shortHash(spin.txHash, 4, 3)}
                              </a>
                            ) : (
                              spin.status
                            )
                          }
                        />
                      </dl>
                    </motion.li>
                  )
                })}
              </ul>
            )}

            <p className="mt-6 max-w-2xl text-[0.74rem] leading-relaxed text-foreground-muted">
              {t('valueNote')}
            </p>
          </section>
        </>
      )}
    </div>
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
    <div className="bg-surface p-6">
      <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{label}</dt>
      <dd
        className={`num mt-2 font-display text-[1.9rem] font-extrabold tracking-[-0.045em] ${
          tone === 'brand' ? 'text-brand' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="num text-foreground-muted">{label}</dt>
      <dd className="num truncate text-foreground-secondary">{value}</dd>
    </div>
  )
}

function Relative({ timestamp }: { timestamp: number }) {
  return <>{useTimeAgo(timestamp)}</>
}
