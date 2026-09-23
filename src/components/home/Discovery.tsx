'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { TokenMark } from '@/components/ui/TokenMark'
import { ArtImage } from '@/components/brand/ArtImage'
import type { RewardToken } from '@/lib/tokens'

/**
 * Token discovery.
 *
 * The orbital render ships with empty mounting plates on purpose; the real
 * verified token marks are composited onto them here in HTML, so nothing in
 * the artwork is a hallucinated logo.
 */
export function Discovery({ tokens }: { tokens: RewardToken[] }) {
  const t = useTranslations('discovery')
  const reduce = useReducedMotion()

  // Eight sockets, matching the plates in the render.
  const orbit = tokens.slice(0, 8)
  const positions = [
    { x: 50, y: 4 }, { x: 84, y: 22 }, { x: 93, y: 56 }, { x: 68, y: 86 },
    { x: 32, y: 88 }, { x: 8, y: 58 }, { x: 15, y: 24 }, { x: 50, y: 50 },
  ]

  return (
    <section data-zone="pale" className="canvas-atmosphere section-viewport">
      <div className="shell-wide">
      <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <motion.div
          className="relative order-2 mx-auto w-full max-w-[26rem] lg:order-1 lg:max-w-none"
          initial={reduce ? false : { opacity: 0, scale: 0.93 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span aria-hidden className="atmosphere-glow absolute inset-[6%] rounded-full" />

          <motion.div
            className="art-grounded relative"
            animate={reduce ? {} : { rotate: [0, 1.6, 0, -1.6, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArtImage
              id="token-orbit"
              alt={t('orbitAlt')}
              sizes="(max-width: 1024px) 80vw, 38vw"
            />

            {/* Real marks, seated on the render's blank plates. */}
            <div className="absolute inset-0">
              {orbit.map((token, i) => {
                const pos = positions[i] ?? positions[0]
                const isCore = i === orbit.length - 1 && orbit.length === 8
                return (
                  <motion.span
                    key={token.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.3 + i * 0.07, ease: [0.34, 1.4, 0.64, 1] }}
                  >
                    <TokenMark
                      token={token}
                      size={isCore ? 26 : 30}
                      ring={false}
                      className="shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                    />
                  </motion.span>
                )
              })}
            </div>
          </motion.div>
        </motion.div>

        <div className="order-1 max-w-xl lg:order-2">
          <span className="eyebrow">{t('eyebrow')}</span>
          <h2 className="type-section mt-4 font-display font-extrabold text-foreground">
            {t('titleLead')}
            <br />
            <span className="text-brand">{t('titleAccent')}</span>
          </h2>
          <p className="mt-5 max-w-lg text-[0.98rem] leading-relaxed text-foreground-secondary">
            {t('body')}
          </p>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5">
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                {t('assetsLabel')}
              </dt>
              <dd className="num mt-1.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-brand">
                {tokens.length}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                {t('verifiedLabel')}
              </dt>
              <dd className="num mt-1.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-foreground">
                100%
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                {t('chainLabel')}
              </dt>
              <dd className="mt-1.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-foreground">
                BNB
              </dd>
            </div>
          </dl>

          <Button asChild size="lg" variant="secondary" className="mt-8">
            <Link href="/rewards">{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </div>
    </section>
  )
}
