'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { Capsule } from '@/components/brand/Capsule'
import { RarityChip } from '@/components/ui/RarityChip'
import { TokenMark } from '@/components/ui/TokenMark'
import { useSound } from './SoundProvider'
import { rarityStyle } from '@/lib/rarity'
import { tokenByAddress } from '@/lib/tokens'
import { formatTokenAmount, formatUsd, shortHash } from '@/lib/format'
import { explorer } from '@/lib/chain'
import { spinMode } from '@/lib/env'
import type { SpinRecord } from '@/lib/spin/types'
import type { SpinPhase } from '@/lib/spin/useSpin'
import { cn } from '@/lib/cn'

/**
 * The result, delivered where the capsule landed.
 *
 * A card that slides out beside the tray rather than a modal dropped over the
 * page — the reward should feel like it came out of the machine, not like the
 * app interrupted itself. The rarity scale changes the capsule finish and the
 * lighting; only Epic earns particles, and they stay restrained.
 */
export function ResultCard({
  spin,
  phase,
  valueUsd,
  onSpinAgain,
  onClaim,
}: {
  spin: SpinRecord | null
  phase: SpinPhase
  valueUsd: number | null
  onSpinAgain: () => void
  onClaim: () => void
}) {
  const t = useTranslations('play.reveal')
  const reduce = useReducedMotion()
  const { play } = useSound()

  const visible =
    !!spin && (phase === 'revealing' || phase === 'settled' || phase === 'claiming' || phase === 'claimed')
  const rarity = spin?.rarity ?? 'COMMON'
  const style = rarityStyle[rarity]
  const token = spin?.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined

  useEffect(() => {
    if (phase === 'revealing') play(style.celebrate ? 'epic' : 'reveal')
  }, [phase, style.celebrate, play])

  return (
    <AnimatePresence>
      {visible && spin && (
        <motion.aside
          key={spin.id}
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'card-physical card-lit relative w-full overflow-hidden p-5',
            style.celebrate && 'border-brand-line',
          )}
        >
          {style.celebrate && !reduce && <Particles color={style.bar} />}

          <div className="relative flex items-start gap-4">
            <motion.div
              initial={reduce ? false : { scale: 0.6, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.08, duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
              className="shrink-0"
            >
              <Capsule
                finish={style.capsuleFinish}
                size={style.celebrate ? 76 : 66}
                logo={token?.logo}
                logoAlt={token?.symbol ?? ''}
                open
              />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">{t('youPulled')}</span>
                <RarityChip rarity={rarity} />
              </div>

              <motion.div
                className="num mt-2 font-display text-[1.75rem] font-extrabold leading-none tracking-[-0.045em] text-foreground"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.4 }}
              >
                {spin.rewardAmount != null
                  ? formatTokenAmount(spin.rewardAmount, token?.symbol ?? '')
                  : '—'}
              </motion.div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {valueUsd != null && (
                  <span className="num text-[0.86rem] text-foreground-secondary">
                    {formatUsd(valueUsd, { approx: true })}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[0.82rem] text-foreground-muted">
                  {token && <TokenMark token={token} size={16} ring={false} />}
                  {token?.name ?? t('unknownAsset')}
                </span>
              </div>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2">
            {spin.status === 'SETTLED' && (
              <button
                onClick={onClaim}
                disabled={phase === 'claiming'}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[11px] bg-brand px-4 text-[0.86rem] font-semibold text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                {phase === 'claiming' ? t('claiming') : t('claim')}
              </button>
            )}
            <button
              onClick={onSpinAgain}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-[11px] border border-border bg-surface px-4 text-[0.86rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              {t('spinAgain')}
            </button>
            {spin.txHash ? (
              <a
                href={explorer.tx(spin.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-[11px] border border-border bg-surface px-4 text-[0.86rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                {t('viewTx')}
              </a>
            ) : (
              <Link
                href={`/fairness?spin=${spin.id}`}
                className="inline-flex h-10 items-center justify-center rounded-[11px] border border-border bg-surface px-4 text-[0.86rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                {t('verify')}
              </Link>
            )}
          </div>

          <dl className="relative mt-4 space-y-1 border-t border-border pt-3.5 text-[0.72rem]">
            <Row label={t('spin')} value={`#${spin.id}`} />
            {spin.randomWord && (
              <Row
                label={t('randomWord')}
                value={shortHash(`0x${BigInt(spin.randomWord).toString(16)}`, 8, 6)}
              />
            )}
            <Row
              label={t('settlement')}
              value={spinMode === 'demo' ? t('settlementDemo') : t('settlementVrf')}
            />
          </dl>

          {spinMode === 'demo' && (
            <p className="relative mt-3 text-[0.7rem] leading-relaxed text-foreground-muted">
              {t('demoNote')}
            </p>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="num truncate text-foreground-secondary">{value}</dd>
    </div>
  )
}

/** Restrained particles, reserved for Epic. Short-lived and few. */
function Particles({ color }: { color: string }) {
  const pieces = Array.from({ length: 14 }, (_, i) => ({
    x: 8 + ((i * 41) % 84),
    delay: (i % 5) * 0.05,
    size: 3 + (i % 3),
  }))

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-full"
          style={{ left: `${p.x}%`, width: p.size, height: p.size, backgroundColor: color }}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: ['0%', '320%'], opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
