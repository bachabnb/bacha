'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArtImage } from '@/components/brand/ArtImage'
import { useViewMode } from './ViewMode'
import { contractsConfigured } from '@/lib/env'
import { cn } from '@/lib/cn'

type StepKey = 'submit' | 'lock' | 'randomness' | 'record' | 'payout'

/**
 * Each step maps to a band of the exploded machine, as a fraction of its
 * height. Selecting a step lights that band — so the explanation and the
 * hardware are the same object, not a paragraph beside a picture.
 */
const STEPS: { key: StepKey; band: [number, number] }[] = [
  { key: 'submit', band: [0.74, 0.94] },
  { key: 'lock', band: [0.5, 0.72] },
  { key: 'randomness', band: [0.26, 0.5] },
  { key: 'record', band: [0.1, 0.28] },
  { key: 'payout', band: [0.86, 1.0] },
]

export function HowProduced() {
  const t = useTranslations('fairness.how')
  const { mode } = useViewMode()
  const [active, setActive] = useState<StepKey>('submit')
  const reduce = useReducedMotion()

  const band = STEPS.find((s) => s.key === active)?.band ?? [0, 1]

  return (
    <section id="how" className="scroll-mt-28">
      <SectionLabel index="02" />
      <h2 className="type-section mt-3 font-display font-extrabold text-foreground">{t('title')}</h2>
      <p className="mt-3 max-w-xl text-[0.98rem] leading-relaxed text-foreground-secondary">
        {t('body')}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:items-start lg:gap-14">
        {/* ------------------------------------------------- the machine */}
        <div className="relative mx-auto w-full max-w-[13rem] lg:sticky lg:top-28 lg:max-w-none">
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[8%] rounded-full" />
          <div className="relative">
            <ArtImage id="machine-exploded" alt="" sizes="(max-width: 1024px) 45vw, 18vw" />

            {/* The lit band, tracking the selected step. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-x-[-6%] rounded-[22px]"
              animate={{
                top: `${band[0] * 100}%`,
                height: `${(band[1] - band[0]) * 100}%`,
              }}
              transition={reduce ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background:
                  'radial-gradient(ellipse at center, var(--brand-soft), transparent 72%)',
                boxShadow: 'inset 0 0 0 1px var(--brand-line)',
              }}
            />

            {/* The vertical technical line that recurs across this page. */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[6%] bottom-[6%] w-px -translate-x-1/2"
              style={{
                background:
                  'linear-gradient(to bottom, transparent, var(--brand-line) 18%, var(--brand-line) 82%, transparent)',
              }}
            />
          </div>
        </div>

        {/* --------------------------------------------------- the steps */}
        <ol className="grid gap-px overflow-hidden rounded-[16px] border border-border bg-border">
          {STEPS.map((step, i) => {
            const selected = step.key === active
            return (
              <li key={step.key} className="bg-surface">
                <button
                  onClick={() => setActive(step.key)}
                  aria-expanded={selected}
                  className={cn(
                    'w-full px-6 py-5 text-left transition-colors lg:px-7',
                    selected ? 'bg-brand-soft' : 'hover:bg-surface-hover',
                  )}
                >
                  <div className="flex items-baseline gap-4">
                    <span
                      className={cn(
                        'num shrink-0 text-[0.72rem] font-medium',
                        selected ? 'text-brand' : 'text-foreground-muted',
                      )}
                    >
                      0{i + 1}
                    </span>
                    <h3 className="font-display text-[1.18rem] font-bold tracking-[-0.03em] text-foreground">
                      {t(`steps.${step.key}.title`)}
                    </h3>
                  </div>
                  <p className="mt-2 max-w-xl pl-[2.2rem] text-[0.88rem] leading-relaxed text-foreground-secondary">
                    {t(`steps.${step.key}.body`)}
                  </p>

                  <AnimatePresence initial={false}>
                    {selected && mode === 'technical' && (
                      <motion.div
                        initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="num mt-3 ml-[2.2rem] max-w-xl rounded-[10px] border border-border bg-background px-3.5 py-3 text-[0.76rem] leading-relaxed text-foreground-secondary">
                          {t(`steps.${step.key}.technical`)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {!contractsConfigured && (
        <p className="mt-6 max-w-2xl rounded-[10px] border border-border bg-surface px-4 py-3 text-[0.8rem] leading-relaxed text-foreground-muted">
          {t('simulatedNote')}
        </p>
      )}
    </section>
  )
}

export function SectionLabel({ index, className }: { index: string; className?: string }) {
  return (
    <span className={cn('num text-[0.66rem] uppercase tracking-[0.2em] text-foreground-muted', className)}>
      {index}
    </span>
  )
}
