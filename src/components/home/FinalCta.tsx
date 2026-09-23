'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { ArtImage } from '@/components/brand/ArtImage'
import { BachaGhostMark } from '@/components/brand/BachaLogo'

export function FinalCta() {
  const t = useTranslations('cta')
  const reduce = useReducedMotion()

  return (
    <section data-zone="brand" className="canvas-atmosphere relative overflow-hidden border-t border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-60" />
      <BachaGhostMark className="left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2" />
      <div
        aria-hidden
        className="atmosphere-glow pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />

      <div className="shell-wide section-viewport relative items-center text-center">
        <motion.div
          className="art-grounded relative w-[11rem] lg:w-[14rem]"
          initial={reduce ? false : { opacity: 0, y: 26, scale: 0.9 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={reduce ? {} : { y: [0, -12, 0], rotate: [-1.5, 1.5, -1.5] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArtImage id="cta-capsule" alt={t('capsuleAlt')} sizes="200px" />
          </motion.div>
        </motion.div>

        <h2 className="type-hero mt-12 font-display font-extrabold text-foreground text-balance">
          {t('titleLead')}
          <br />
          <span className="text-brand">{t('titleAccent')}</span>
        </h2>

        <p className="mt-6 max-w-md text-[1rem] leading-relaxed text-foreground-secondary">{t('body')}</p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="hero">
            <Link href="/play">{t('primary')}</Link>
          </Button>
          <Button asChild variant="secondary" size="hero">
            <Link href="/rewards">{t('secondary')}</Link>
          </Button>
        </div>

        <p className="mt-8 max-w-sm text-[0.74rem] leading-relaxed text-foreground-muted">{t('risk')}</p>
      </div>
    </section>
  )
}
