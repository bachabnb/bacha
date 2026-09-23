'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { ArtImage } from '@/components/brand/ArtImage'
import { NavIcon } from '@/components/site/NavIcon'
import { Button } from '@/components/ui/Button'
import { contractsConfigured } from '@/lib/env'
import type { NavIcon as IconName } from '@/components/site/navigation'

const CHAIN: { key: 'spin' | 'request' | 'randomness' | 'result' | 'payout'; icon: IconName }[] = [
  { key: 'spin', icon: 'machine' },
  { key: 'request', icon: 'steps' },
  { key: 'randomness', icon: 'token' },
  { key: 'result', icon: 'vault' },
  { key: 'payout', icon: 'wallet' },
]

/**
 * The technical footing for the page.
 *
 * Says plainly how a result is produced, and — when contracts are not
 * deployed — says just as plainly that the randomness here is simulated. A
 * fairness section that overstated itself would be worse than none.
 */
export function SpinSettles() {
  const t = useTranslations('play.settles')
  const f = useTranslations('fairness')

  return (
    <section aria-labelledby="spin-settles" className="card-physical overflow-hidden">
      <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 lg:p-8">
        <div className="min-w-0">
          <h2
            id="spin-settles"
            className="font-display text-[1.5rem] font-bold tracking-[-0.035em] text-foreground"
          >
            {t('title')}
          </h2>
          <p className="mt-3 max-w-lg text-[0.9rem] leading-relaxed text-foreground-secondary">
            {t('body')}
          </p>

          <ol className="mt-7 grid gap-3 sm:grid-cols-5">
            {CHAIN.map((step, i) => (
              <li key={step.key} className="relative">
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-border bg-background text-brand">
                    <NavIcon name={step.icon} className="h-[15px] w-[15px]" />
                  </span>
                  {i < CHAIN.length - 1 && (
                    <span aria-hidden className="hidden h-px flex-1 bg-border-strong sm:block" />
                  )}
                </span>
                <span className="mt-2.5 block text-[0.8rem] font-semibold text-foreground">
                  {f(`chain.${step.key}.label`)}
                </span>
                <span className="mt-0.5 block text-[0.72rem] leading-snug text-foreground-muted">
                  {f(`chain.${step.key}.detail`)}
                </span>
              </li>
            ))}
          </ol>

          {!contractsConfigured && (
            <p className="mt-6 rounded-[10px] border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-[0.78rem] leading-relaxed text-warning">
              {t('simulatedNotice')}
            </p>
          )}

          <Button asChild variant="secondary" className="mt-6">
            <Link href="/fairness">{t('verify')}</Link>
          </Button>
        </div>

        <div className="relative mx-auto w-full max-w-[13rem] lg:w-[13rem]">
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[10%] rounded-full" />
          <ArtImage id="fairness-verify" alt="" className="relative" sizes="220px" />
        </div>
      </div>
    </section>
  )
}
