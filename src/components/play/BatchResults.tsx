'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { RarityChip } from '@/components/ui/RarityChip'
import { TokenMark } from '@/components/ui/TokenMark'
import { useSound } from './SoundProvider'
import { RARITIES, rarityStyle, type Rarity } from '@/lib/rarity'
import { tokenByAddress } from '@/lib/tokens'
import { formatBnb, formatTokenAmount, formatUsd } from '@/lib/format'
import { explorer } from '@/lib/chain'
import type { MarketQuote } from '@/lib/market'
import type { SpinRecord } from '@/lib/spin/types'
import type { SpinPhase } from '@/lib/spin/useSpin'
import { cn } from '@/lib/cn'

/**
 * The results of a multi-spin, filling in as the worker reveals each one.
 *
 * One tile per spin, in purchase order. A tile turns over when its spin
 * settles and gains a tick when the stock lands in the wallet. The summary
 * above adds up what came out against what went in — in BNB, which is what
 * the contract actually deals in, with dollars as the estimate.
 */
export function BatchResults({
  batch,
  expected,
  phase,
  quotes,
  txHash,
  deliverySlow,
  onSpinAgain,
}: {
  batch: SpinRecord[]
  /** Spins bought; demo batches arrive one at a time. */
  expected: number
  phase: SpinPhase
  quotes: Record<string, MarketQuote>
  txHash: string | null
  deliverySlow: boolean
  onSpinAgain: () => void
}) {
  const t = useTranslations('play.reveal')
  const reduce = useReducedMotion()
  const { play } = useSound()

  const size = phase === 'settling' ? Math.max(expected, batch.length) : batch.length
  const settled = batch.filter((r) => r.status !== 'PENDING').length
  const delivered = batch.filter((r) => r.status === 'CLAIMED' || r.status === 'PAID_BNB').length
  const refunded = batch.filter((r) => r.status === 'REFUNDED').length
  const open = batch.filter((r) => r.status === 'SETTLED').length
  const done = settled === size && open === 0 && batch.every((r) => r.mode === 'onchain')

  const summary = useMemo(() => {
    let valueWei = 0n
    let paidWei = 0n
    let usd = 0
    let usdKnown = false
    const counts: Record<Rarity, number> = { COMMON: 0, UNCOMMON: 0, RARE: 0, EPIC: 0 }
    for (const r of batch) {
      paidWei += BigInt(r.paymentWei)
      if (r.status === 'PENDING' || r.status === 'REFUNDED' || !r.rarity) continue
      counts[r.rarity]++
      valueWei += BigInt(r.rewardValueWei ?? '0')
      const quote = r.rewardTokenAddress ? quotes[r.rewardTokenAddress.toLowerCase()] : undefined
      if (quote?.priceUsd != null && r.rewardAmount != null) {
        usd += quote.priceUsd * r.rewardAmount
        usdKnown = true
      }
    }
    return { valueWei, paidWei, usd: usdKnown ? usd : null, counts }
  }, [batch, quotes])

  // A soft tick per reveal, and the big sound once for the rarest pull.
  const heard = useRef(0)
  useEffect(() => {
    if (settled > heard.current) {
      heard.current = settled
      if (settled < size) play('reveal')
    }
  }, [settled, size, play])
  useEffect(() => {
    if (phase !== 'revealing') return
    const best = RARITIES.slice().reverse().find((r) => summary.counts[r] > 0)
    play(best && rarityStyle[best].celebrate ? 'epic' : 'reveal')
  }, [phase, summary.counts, play])

  const visible = size > 0 && phase !== 'idle' && phase !== 'confirming' && phase !== 'error'
  const celebrate = summary.counts.EPIC > 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key={txHash ?? 'batch'}
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn('card-physical card-lit relative w-full overflow-hidden p-5', celebrate && 'border-brand-line')}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="eyebrow">{t('batchTitle', { count: size })}</span>
            <span className="num text-[0.7rem] text-foreground-muted">
              {t('batchProgress', { settled, count: size, delivered })}
            </span>
          </div>

          {/* ------------------------------------------------ summary */}
          <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                {t('batchValue')}
              </div>
              <div className="num mt-1 font-display text-[1.6rem] font-extrabold leading-none tracking-[-0.045em] text-foreground">
                {formatBnb(summary.valueWei)} BNB
              </div>
            </div>
            <div className="num text-right text-[0.78rem] leading-snug text-foreground-secondary">
              {summary.usd != null && <div>{formatUsd(summary.usd, { approx: true })}</div>}
              <div className="text-foreground-muted">{t('batchPaid', { amount: formatBnb(summary.paidWei) })}</div>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {RARITIES.slice()
              .reverse()
              .filter((r) => summary.counts[r] > 0)
              .map((r) => (
                <span key={r} className="inline-flex items-center gap-1">
                  <RarityChip rarity={r} />
                  <span className="num text-[0.72rem] text-foreground-secondary">×{summary.counts[r]}</span>
                </span>
              ))}
          </div>

          {/* ------------------------------------------------ tiles */}
          <ul className="mt-3.5 grid grid-cols-5 gap-1.5">
            {Array.from({ length: size }, (_, i) => (
              <Tile key={batch[i]?.id ?? `pending-${i}`} record={batch[i]} reduce={Boolean(reduce)} />
            ))}
          </ul>

          <p className="mt-3.5 text-[0.78rem] leading-snug text-foreground-secondary">
            {refunded > 0
              ? t('batchRefunded', { count: refunded })
              : done
                ? t('batchDone')
                : deliverySlow
                  ? t('batchSlow')
                  : settled > 0
                    ? t('batchDelivering')
                    : null}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={onSpinAgain}
              disabled={phase === 'settling' || phase === 'submitted'}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-[11px] border border-border bg-surface px-4 text-[0.86rem] font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              {t('spinAgainMany', { count: size })}
            </button>
            {deliverySlow && (
              <Link
                href="/me"
                className="inline-flex h-10 items-center justify-center rounded-[11px] bg-brand px-4 text-[0.86rem] font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
              >
                {t('myBacha')}
              </Link>
            )}
            {txHash && (
              <a
                href={explorer.tx(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-[11px] border border-border bg-surface px-4 text-[0.86rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                {t('viewTx')}
              </a>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function Tile({ record, reduce }: { record: SpinRecord | undefined; reduce: boolean }) {
  const t = useTranslations('play.reveal')
  const revealed = record && record.status !== 'PENDING' && record.status !== 'REFUNDED' && record.rarity
  const token = revealed && record.rewardTokenAddress ? tokenByAddress(record.rewardTokenAddress) : undefined
  const style = revealed ? rarityStyle[record.rarity!] : null
  const arrived = record?.status === 'CLAIMED' || record?.status === 'PAID_BNB'

  return (
    <li
      className={cn(
        'relative flex aspect-[4/5] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[10px] border bg-background px-1',
        revealed ? 'border-border' : 'border-dashed border-border',
      )}
      title={
        revealed && token
          ? `${token.symbol} · ${record.rewardAmount != null ? formatTokenAmount(record.rewardAmount) : ''}`
          : t('pending')
      }
    >
      {revealed && style ? (
        <motion.div
          initial={reduce ? false : { rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-w-0 flex-col items-center gap-1"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: style.bar }} />
          {token ? (
            <TokenMark token={token} size={26} ring={false} />
          ) : (
            <span className="h-[26px] w-[26px] rounded-full bg-surface-hover" />
          )}
          <span className="num max-w-full truncate text-[0.62rem] font-medium text-foreground">
            {token?.symbol ?? '—'}
          </span>
          <span className="num max-w-full truncate text-[0.56rem] text-foreground-muted">
            {record.rewardValueWei ? `${formatBnb(BigInt(record.rewardValueWei), 4)}` : ''}
          </span>
        </motion.div>
      ) : record?.status === 'REFUNDED' ? (
        <span className="text-[0.6rem] text-foreground-muted">↩</span>
      ) : (
        <span aria-hidden className="h-[26px] w-[26px] animate-pulse rounded-full bg-surface-hover" />
      )}
      {arrived && (
        <span
          aria-hidden
          className="absolute right-1 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-[0.5rem] leading-none text-white"
        >
          ✓
        </span>
      )}
    </li>
  )
}
