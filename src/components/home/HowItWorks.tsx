'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { SectionHeader } from './SectionHeader'
import { ArtImage } from '@/components/brand/ArtImage'
import type { ArtId } from '@/lib/art'

const STEPS: { key: 'connect' | 'spin' | 'reveal'; index: string; art: ArtId }[] = [
  { key: 'connect', index: '01', art: 'step-connect' },
  { key: 'spin', index: '02', art: 'step-spin' },
  { key: 'reveal', index: '03', art: 'step-reveal' },
]

/**
 * Three steps, each carrying its own object.
 *
 * A faint rule threads behind the illustrations on desktop so the three read
 * as one sequence rather than three unrelated cards.
 */
export function HowItWorks() {
  const t = useTranslations('howItWorks')
  const reduce = useReducedMotion()

  return (
    <section data-zone="cool" className="canvas-atmosphere relative border-y border-border bg-background-secondary section-viewport">
      <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-70" />

      <div className="shell-wide relative">
        <SectionHeader index="04" eyebrow={t('eyebrow')} title={t('title')} />

        <div className="relative mt-14 lg:mt-20">
          {/* the thread */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-[7.5rem] hidden h-px lg:block"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--border-strong) 14%, var(--brand-line) 50%, var(--border-strong) 86%, transparent)',
            }}
          />

          <ol className="relative grid gap-12 lg:grid-cols-3 lg:gap-8">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.key}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center text-center lg:items-start lg:text-left"
              >
                <div className="art-grounded relative flex h-[15rem] w-full max-w-[15rem] items-center justify-center">
                  <span
                    aria-hidden
                    className="atmosphere-glow absolute inset-0 rounded-full opacity-70"
                    style={{ scale: '0.8' }}
                  />
                  <ArtImage
                    id={step.art}
                    alt=""
                    className="relative max-h-full w-auto"
                    sizes="(max-width: 1024px) 60vw, 22vw"
                  />
                </div>

                <div className="mt-7 flex items-baseline gap-3">
                  <span aria-hidden className="index-numeral text-[2rem]">
                    {step.index}
                  </span>
                  <h3 className="font-display text-[1.6rem] font-bold tracking-[-0.035em] text-foreground">
                    {t(`${step.key}.title`)}
                  </h3>
                </div>
                <p className="mt-3 max-w-xs text-[0.92rem] leading-relaxed text-foreground-secondary lg:max-w-sm">
                  {t(`${step.key}.body`)}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
