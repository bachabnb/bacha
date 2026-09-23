'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { ArtImage } from '@/components/brand/ArtImage'
import { NavIcon } from '@/components/site/NavIcon'
import type { NavIcon as IconName } from '@/components/site/navigation'

const CHAIN: { key: 'spin' | 'request' | 'randomness' | 'result' | 'payout'; icon: IconName }[] = [
  { key: 'spin', icon: 'machine' },
  { key: 'request', icon: 'steps' },
  { key: 'randomness', icon: 'token' },
  { key: 'result', icon: 'vault' },
  { key: 'payout', icon: 'wallet' },
]

/**
 * The fairness pitch.
 *
 * Copy and CTA on the left, the verification instrument on the right, and the
 * five-step chain running underneath both — horizontal on desktop, stacked on
 * mobile, connected by a rule so it reads as a pipeline either way.
 */
export function FairnessSection() {
  const t = useTranslations('fairness')
  const reduce = useReducedMotion()

  return (
    <section data-zone="cool" className="canvas-atmosphere relative overflow-hidden border-y border-border bg-background-secondary section-viewport">
      <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-60" />

      <div className="shell-wide relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="max-w-xl">
            <span className="eyebrow">{t('eyebrow')}</span>
            <h2 className="type-section mt-4 font-display font-extrabold text-foreground">
              {t('titleLead')}
              <br />
              <span className="text-brand">{t('titleAccent')}</span>
            </h2>
            <p className="mt-5 max-w-lg text-[0.98rem] leading-relaxed text-foreground-secondary">
              {t('body')}
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/fairness">{t('cta')}</Link>
            </Button>
          </div>

          <motion.div
            className="art-grounded relative mx-auto w-full max-w-[23rem] lg:max-w-none"
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <span aria-hidden className="atmosphere-glow absolute inset-[10%] rounded-full" />
            <ArtImage
              id="fairness-verify"
              alt={t('artAlt')}
              className="relative"
              sizes="(max-width: 1024px) 70vw, 34vw"
            />
          </motion.div>
        </div>

        <ol className="relative mt-16 grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {CHAIN.map((step, i) => (
            <li key={step.key} className="relative bg-background-secondary p-5 lg:p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border bg-surface text-brand">
                  <NavIcon name={step.icon} className="h-[15px] w-[15px]" />
                </span>
                <span className="num text-[0.66rem] text-foreground-muted">0{i + 1}</span>
                {i < CHAIN.length - 1 && (
                  <svg
                    viewBox="0 0 14 14"
                    className="ml-auto hidden h-3.5 w-3.5 text-brand-line lg:block"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden
                  >
                    <path d="M2 7h10M8.5 3.5 12 7l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <h3 className="mt-4 font-display text-[1.05rem] font-bold tracking-[-0.03em] text-foreground">
                {t(`chain.${step.key}.label`)}
              </h3>
              <p className="mt-1.5 text-[0.8rem] leading-relaxed text-foreground-muted">
                {t(`chain.${step.key}.detail`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
