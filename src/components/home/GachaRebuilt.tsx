'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { SectionHeader } from './SectionHeader'
import { ArtImage } from '@/components/brand/ArtImage'
import { hasArt } from '@/lib/art'

/**
 * "An old idea, moved onchain."
 *
 * Previously this section carried licensed photography. It has been replaced
 * with a single wide isometric scene in the same hardware language as the rest
 * of the product — a photograph, however well licensed, broke the illusion
 * that every object on this page comes from one manufacturer.
 *
 * The four-stage caption underneath is HTML rather than lettering baked into
 * the render, so it translates and stays legible at any size.
 */
export function GachaRebuilt({ stats }: { stats: { key: string; value: string }[] }) {
  const t = useTranslations('story')
  const reduce = useReducedMotion()

  const stages = ['coin', 'mechanism', 'randomness', 'token'] as const

  return (
    <section data-zone="pale" className="canvas-atmosphere relative overflow-hidden section-viewport">
      <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-70" />

      <div className="shell-wide relative">
        <SectionHeader
          index="08"
          eyebrow={t('eyebrow')}
          title={
            <>
              {t('titleLead')}
              <br />
              <span className="text-brand">{t('titleAccent')}</span>
            </>
          }
        >
          {t('body')}
        </SectionHeader>

        {/* The scene, deliberately wide and allowed to dominate the section. */}
        <motion.div
          className="relative mt-8 lg:mt-10"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-x-[8%] inset-y-[-8%] rounded-[50%]" />
          {hasArt('gacha-rebuilt') && (
            <ArtImage
              id="gacha-rebuilt"
              alt={t('sceneAlt')}
              className="relative mx-auto w-full max-w-2xl"
              sizes="(max-width: 1024px) 92vw, 48vw"
            />
          )}

          {/* The rail the scene sits on, continued in HTML across the stages. */}
          <div className="relative mx-auto mt-2 max-w-2xl">
            <div
              aria-hidden
              className="absolute left-0 right-0 top-[13px] hidden h-px sm:block"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--border-strong) 10%, var(--brand-line) 50%, var(--border-strong) 90%, transparent)',
              }}
            />
            <ol className="relative grid grid-cols-4 gap-3">
              {stages.map((stage, i) => (
                <li key={stage} className="flex flex-col items-center text-center">
                  <span
                    className="relative flex h-[26px] w-[26px] items-center justify-center rounded-full border border-border bg-surface text-[0.6rem] font-medium text-brand"
                    aria-hidden
                  >
                    0{i + 1}
                  </span>
                  <span className="mt-3 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-foreground">
                    {t(`stages.${stage}.label`)}
                  </span>
                  <span className="mt-1.5 hidden max-w-[12rem] text-[0.74rem] leading-relaxed text-foreground-muted sm:block">
                    {t(`stages.${stage}.detail`)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </motion.div>

        <dl className="mx-auto mt-10 flex max-w-3xl flex-wrap items-baseline justify-center gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.key} className="flex items-baseline gap-2.5">
              <dt className="num font-display text-[1.45rem] font-extrabold leading-none tracking-[-0.045em] text-brand">
                {stat.value}
              </dt>
              <dd className="text-[0.74rem] uppercase tracking-[0.13em] text-foreground-secondary">
                {t(`stats.${stat.key}`)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
