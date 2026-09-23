'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { BachaMachine, type MachineToken } from '@/components/brand/BachaMachine'
import { BachaGhostMark } from '@/components/brand/BachaLogo'
import { BnbChainMark } from '@/components/brand/BnbChain'
import { TokenMark } from '@/components/ui/TokenMark'
import { Capsule } from '@/components/brand/Capsule'
import { rarityStyle } from '@/lib/rarity'
import { contractsConfigured } from '@/lib/env'
import { formatPercent } from '@/lib/format'
import type { Machine } from '@/lib/machine'
import type { RewardToken } from '@/lib/tokens'

/**
 * The hero as a live machine interface.
 *
 * The machine is the subject and the panels around it are real UI reading real
 * configuration — the odds are the ones a spin resolves against, the price is
 * the configured price, and the token chips are the actual roster. Nothing
 * here is typography baked into an image.
 */
export function Hero({
  tokens,
  machine,
  roster,
}: {
  tokens: MachineToken[]
  machine: Machine
  roster: RewardToken[]
}) {
  const t = useTranslations('hero')
  const reduce = useReducedMotion()

  const proof = [t('meta.rewards'), t('proofOdds'), t('meta.randomness'), t('meta.network')]
  const chips = roster.slice(0, 5)

  return (
    <section data-zone="warm" className="canvas-atmosphere relative overflow-hidden">
      <Backdrop />

      <div className="shell-wide section-viewport-hero relative grid items-center gap-10 lg:grid-cols-12 lg:gap-6">
        {/* ------------------------------------------------------- copy */}
        <div className="relative z-20 lg:col-span-5">
          <motion.span
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[0.72rem] font-medium text-foreground-secondary"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {contractsConfigured ? (
              <span className="live-dot" />
            ) : (
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
            )}
            {t('eyebrow')}
          </motion.span>

          <motion.h1
            className="type-mega mt-5 font-display font-extrabold text-foreground"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            {t('headlineLead')}
            <br />
            <span className="text-brand">{t('headlineAccent')}</span>
          </motion.h1>

          <motion.div
            className="mt-5 max-w-sm space-y-1.5 text-[1rem] leading-relaxed text-foreground-secondary"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <p>{t('lead')}</p>
            <p className="text-foreground">{t('subcopy')}</p>
          </motion.div>

          <motion.div
            className="mt-7 flex flex-wrap items-center gap-3"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Button asChild size="hero">
              <Link href="/play">
                {t('primary')}
                <Arrow />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="hero">
              <Link href="/rewards">{t('secondary')}</Link>
            </Button>
          </motion.div>

          <motion.ul
            className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {proof.map((item, i) => (
              <li key={item} className="flex items-center gap-1.5 text-[0.78rem] text-foreground-muted">
                {i === proof.length - 1 ? (
                  <BnbChainMark className="h-3.5 w-3" />
                ) : (
                  <CheckMark />
                )}
                {item}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ---------------------------------------------------- machine */}
        <motion.div
          className="relative z-10 lg:col-span-7"
          initial={reduce ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[22rem] lg:max-w-[26rem] lg:translate-x-2">
            <CapsuleTrail />
            <BachaMachine tokens={tokens} className="relative z-10" />

            {/* Panels: real UI, deliberately overlapping the object so the
                interface and the hardware read as one thing. */}
            <MachineBadge className="absolute -right-4 top-[4%] z-20 lg:-right-24" />
            <PriceChip machine={machine} className="absolute -left-4 top-[28%] z-20 lg:-left-24" />
            <TokenChips tokens={chips} className="absolute -left-28 bottom-[14%] z-20 hidden xl:flex" />
            <OddsPanel machine={machine} className="absolute -right-4 bottom-[6%] z-20 lg:-right-28" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- panels */

function MachineBadge({ className }: { className?: string }) {
  const t = useTranslations('machinePreview')
  const c = useTranslations('common')
  return (
    <div className={`card-physical px-3.5 py-2.5 ${className ?? ''}`}>
      <div className="text-[0.58rem] uppercase tracking-[0.18em] text-foreground-muted">
        {t('label')}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {contractsConfigured ? (
          <span className="live-dot" />
        ) : (
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-foreground-muted" />
        )}
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-foreground">
          {contractsConfigured ? t('live') : c('demo')}
        </span>
      </div>
    </div>
  )
}

function PriceChip({ machine, className }: { machine: Machine; className?: string }) {
  const t = useTranslations('hero')
  return (
    <div className={`card-physical card-lit px-4 py-3 ${className ?? ''}`}>
      <div className="relative num font-display text-[1.7rem] font-extrabold leading-none tracking-[-0.05em] text-foreground">
        ${machine.referencePriceUsd.toFixed(0)}
      </div>
      <div className="relative mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-foreground-muted">
        {t('perSpin')}
      </div>
    </div>
  )
}

function TokenChips({ tokens, className }: { tokens: RewardToken[]; className?: string }) {
  return (
    <div className={`flex-col gap-1.5 ${className ?? ''}`}>
      {tokens.map((token, i) => (
        <motion.span
          key={token.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 + i * 0.07 }}
          className="card-physical inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5"
        >
          <TokenMark token={token} size={20} ring={false} />
          <span className="num text-[0.7rem] text-foreground-secondary">{token.symbol}</span>
        </motion.span>
      ))}
    </div>
  )
}

function OddsPanel({ machine, className }: { machine: Machine; className?: string }) {
  const t = useTranslations('hero')
  const r = useTranslations('rarity')

  return (
    <div className={`card-physical w-[13.5rem] p-4 ${className ?? ''}`}>
      <div className="text-[0.58rem] uppercase tracking-[0.18em] text-foreground-muted">
        {t('currentOdds')}
      </div>
      <dl className="mt-3 space-y-1.5">
        {machine.rarityShare.map((share, i) => {
          const rarity = (['COMMON', 'UNCOMMON', 'RARE', 'EPIC'] as const)[i]
          return (
            <div key={rarity} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-[1px]"
                style={{ backgroundColor: rarityStyle[rarity].bar }}
              />
              <dt className="flex-1 truncate text-[0.7rem] text-foreground-secondary">{r(rarity)}</dt>
              <dd className="num text-[0.72rem] font-medium text-foreground">
                {formatPercent(share)}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/**
 * A capsule travelling from the chamber down toward the tray.
 *
 * One capsule, on a long loop — enough to suggest the machine is running
 * without turning the hero into an animation reel.
 */
function CapsuleTrail() {
  const reduce = useReducedMotion()
  if (reduce) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <motion.div
        className="absolute left-1/2 top-[20%]"
        animate={{
          y: ['0%', '180%', '250%', '250%'],
          x: ['-50%', '-50%', '-50%', '-50%'],
          opacity: [0, 1, 1, 0],
          rotate: [0, 40, 70, 70],
        }}
        transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 3.5, ease: [0.4, 0.05, 0.3, 1] }}
      >
        <Capsule finish="bnb" size={26} flat />
      </motion.div>
    </div>
  )
}

function CheckMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 6.4 4.8 8.7 9.5 3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Construction lines, node points and an oversized B behind the content. */
function Backdrop() {
  const nodes = [
    [9, 22], [21, 70], [33, 12], [46, 86], [59, 26], [72, 62], [88, 16], [94, 76], [14, 92],
  ]

  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines" />
      <BachaGhostMark className="left-[-10%] top-1/2 hidden h-[30rem] w-[30rem] -translate-y-1/2 lg:block" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to top, var(--background), transparent)' }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {nodes.map(([x, y], i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full"
            style={{ left: `${x}%`, top: `${y}%`, background: 'var(--grid-mark)' }}
          />
        ))}
      </div>
    </>
  )
}
