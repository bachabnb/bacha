import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ViewModeProvider, ViewModeToggle } from '@/components/fairness/ViewMode'
import { FairnessNav } from '@/components/fairness/FairnessNav'
import { SpinVerifier } from '@/components/fairness/SpinVerifier'
import { HowProduced } from '@/components/fairness/HowProduced'
import { ContractsPanel } from '@/components/fairness/ContractsPanel'
import { PublishedOdds } from '@/components/fairness/PublishedOdds'
import { RedoTheMaths } from '@/components/fairness/RedoTheMaths'
import { ArtImage } from '@/components/brand/ArtImage'
import { BachaGhostMark } from '@/components/brand/BachaLogo'
import { Button } from '@/components/ui/Button'
import { contractsConfigured } from '@/lib/env'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.fairness' })
  return { title: t('title'), description: t('description') }
}

/**
 * The transparency page.
 *
 * Ordered by what a sceptical visitor needs first: verify a spin, then
 * understand how one is produced, then inspect the contracts, the odds and
 * the arithmetic. The verifier is the page's primary control, not a footnote
 * under the explanation.
 */
export default async function FairnessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'fairness' })

  const chips = [
    t('proof.tableLocked'),
    t('proof.randomnessRecorded'),
    t('proof.resultStored'),
    t('proof.payoutTraceable'),
  ]

  return (
    <ViewModeProvider>
      {/* ------------------------------------------------------------ hero */}
      <section data-zone="warm" className="canvas-atmosphere relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-70" />
        <BachaGhostMark className="right-[-6%] top-[6%] hidden h-[30rem] w-[30rem] lg:block" />

        <div className="shell-wide relative grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-16">
          <div className="max-w-xl">
            <span className="eyebrow">{t('eyebrow')}</span>
            <h1 className="type-hero mt-4 font-display font-extrabold text-foreground">
              {t('hero.title')}
            </h1>
            <p className="mt-5 text-[1rem] leading-relaxed text-foreground-secondary">
              {t('hero.body')}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href="#verify">{t('hero.primary')}</a>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <a href="#contracts">{t('hero.secondary')}</a>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="flex items-center gap-1.5 text-[0.78rem] text-foreground-muted"
                >
                  <svg
                    viewBox="0 0 12 12"
                    className="h-3 w-3 shrink-0 text-brand"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path d="M2.5 6.4 4.8 8.7 9.5 3.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {chip}
                </li>
              ))}
              {!contractsConfigured && (
                <li className="flex items-center gap-1.5 text-[0.78rem] font-medium text-warning">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
                  {t('proof.simulated')}
                </li>
              )}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[17rem] lg:max-w-none">
            <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[10%] rounded-full" />
            <ArtImage
              id="fairness-verify"
              alt={t('artAlt')}
              className="relative"
              sizes="(max-width: 1024px) 55vw, 26vw"
              priority
            />
          </div>
        </div>
      </section>

      <FairnessNav />

      {/* -------------------------------------------------------- content */}
      <div data-zone="pale" className="canvas-atmosphere">
        <div className="shell-wide space-y-20 py-14 lg:space-y-24 lg:py-16">
          <div className="flex justify-end">
            <ViewModeToggle />
          </div>

          <Suspense fallback={<div className="card-physical p-8 text-foreground-secondary">…</div>}>
            <SpinVerifier />
          </Suspense>

          <HowProduced />
          <ContractsPanel />

          {/* The single most important fairness idea on the page. */}
          <section className="card-physical card-lit relative overflow-hidden p-7 lg:p-9">
            <div className="relative max-w-2xl">
              <h2 className="font-display text-[1.75rem] font-extrabold tracking-[-0.04em] text-foreground lg:text-[2.1rem]">
                {t('immutable.title')}
              </h2>
              <p className="mt-4 text-[0.98rem] leading-relaxed text-foreground-secondary">
                {t('immutable.body')}
              </p>
            </div>
          </section>

          <PublishedOdds />
          <RedoTheMaths />

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-10">
            <Button asChild>
              <Link href="/play">{t('cta')}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/docs">{t('nav.how')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </ViewModeProvider>
  )
}
