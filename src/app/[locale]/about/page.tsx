import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link, locales } from '@/i18n/routing'
import { ArtImage } from '@/components/brand/ArtImage'
import { BachaGhostMark } from '@/components/brand/BachaLogo'
import { Button } from '@/components/ui/Button'
import { LivePanel } from '@/components/whitepaper/LivePanel'
import { cn } from '@/lib/cn'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.about' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}/about` },
  }
}

const PRINCIPLES = ['published', 'frozen', 'outside', 'solvent', 'plain'] as const
const NEVER = ['returns', 'token', 'fake', 'ticker', 'custody', 'darkpattern'] as const
const BUILT = ['chain', 'contracts', 'randomness', 'rewards'] as const

/**
 * About.
 *
 * Positioned as the page a sceptic reads before the whitepaper: why this
 * shape, what we hold ourselves to, and what we refuse to do. There is
 * deliberately no team section and no origin-story mythology — nothing here
 * asks to be believed that cannot be checked against the contracts.
 *
 * Deployment status comes from the same live panel the fairness page and the
 * paper use, so "where the project stands" cannot go stale.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'about' })

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section
        data-zone="warm"
        className="canvas-atmosphere section-viewport-hero relative flex items-center overflow-hidden border-b border-border"
      >
        <BachaGhostMark className="brand-ghost pointer-events-none absolute -right-[6%] top-[8%] w-[34rem]" />
        <div aria-hidden className="construction-lines pointer-events-none absolute inset-0 opacity-60" />

        <div className="shell-wide relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="max-w-xl">
            <span className="eyebrow">{t('eyebrow')}</span>
            <h1 className="type-section mt-4 font-display font-extrabold tracking-[-0.035em] text-foreground">
              {t('hero.titleLead')}
              <br />
              <span className="text-brand">{t('hero.titleAccent')}</span>
            </h1>
            <p className="mt-6 max-w-lg text-[1.02rem] leading-relaxed text-foreground-secondary">
              {t('hero.body')}
            </p>
          </div>

          <div className="art-grounded relative mx-auto w-full max-w-[24rem] lg:max-w-none">
            <span aria-hidden className="atmosphere-glow absolute inset-[10%] rounded-full" />
            <ArtImage
              id="gacha-rebuilt"
              alt={t('hero.artAlt')}
              className="relative"
              sizes="(max-width: 1024px) 70vw, 36vw"
              priority
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- why */}
      <Section zone="pale" index={t('why.index')} title={t('why.title')}>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <p className="text-[1rem] leading-relaxed text-foreground-secondary">{t('why.body')}</p>
          <p className="text-[1rem] leading-relaxed text-foreground-secondary">{t('why.body2')}</p>
        </div>
      </Section>

      {/* ------------------------------------------------------ principles */}
      <Section zone="cool" index={t('principles.index')} title={t('principles.title')} lede={t('principles.body')}>
        <ol className="grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((key, i) => (
            <li key={key} className="flex flex-col bg-surface px-6 py-6">
              <span className="num text-[0.68rem] text-brand">0{i + 1}</span>
              <h3 className="mt-3 font-display text-[1.08rem] font-bold tracking-[-0.025em] text-foreground">
                {t(`principles.items.${key}.title`)}
              </h3>
              <p className="mt-2 text-[0.87rem] leading-relaxed text-foreground-secondary">
                {t(`principles.items.${key}.body`)}
              </p>
            </li>
          ))}
          {/* Five items never fill a 2- or 3-column row, and the gap would
              otherwise show the container's border colour as a grey block. */}
          <li aria-hidden className="hidden bg-surface sm:block" />
        </ol>
      </Section>

      {/* ----------------------------------------------------------- never */}
      <Section zone="pale" index={t('never.index')} title={t('never.title')} lede={t('never.body')}>
        <ul className="grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2">
          {NEVER.map((key) => (
            <li key={key} className="flex items-start gap-3.5 bg-surface px-6 py-5">
              {/* A struck-through mark: this is the "will not" list. */}
              <svg
                viewBox="0 0 18 18"
                aria-hidden
                className="mt-0.5 h-[17px] w-[17px] shrink-0 text-foreground-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="9" cy="9" r="6.6" />
                <path d="M5.4 12.6 12.6 5.4" strokeLinecap="round" />
              </svg>
              <span className="text-[0.9rem] leading-relaxed text-foreground-secondary">
                {t(`never.items.${key}`)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ----------------------------------------------------------- built */}
      <Section zone="cool" index={t('built.index')} title={t('built.title')} lede={t('built.body')}>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-14">
          {/* Sized by height: the exploded strip is three times taller than wide. */}
          <div className="relative mx-auto h-[clamp(17rem,38vh,26rem)]">
            <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[8%] rounded-full" />
            <ArtImage
              id="machine-exploded"
              alt={t('built.artAlt')}
              className="relative mx-auto h-full w-auto"
              sizes="(max-width: 1024px) 34vw, 13rem"
            />
          </div>

          <dl className="grid gap-px overflow-hidden rounded-[16px] border border-border bg-border">
            {BUILT.map((key) => (
              <div key={key} className="bg-surface px-6 py-5">
                <dt className="text-[0.6rem] uppercase tracking-[0.18em] text-foreground-muted">
                  {t(`built.rows.${key}.label`)}
                </dt>
                <dd className="mt-2 text-[0.92rem] leading-relaxed text-foreground-secondary">
                  {t(`built.rows.${key}.value`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* ---------------------------------------------------------- status */}
      <Section zone="pale" index={t('status.index')} title={t('status.title')} lede={t('status.body')}>
        <LivePanel kind="deployment" />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Callout title={t('status.auditTitle')} body={t('status.auditBody')} />
          <Callout title={t('status.tokenTitle')} body={t('status.tokenBody')} />
        </div>
      </Section>

      {/* ------------------------------------------------------------- cta */}
      <section data-zone="brand" className="border-t border-border">
        <div className="shell-wide flex flex-col items-start gap-8 py-20 lg:flex-row lg:items-center lg:justify-between lg:py-24">
          <div className="max-w-xl">
            <h2 className="type-section font-display font-extrabold text-foreground">{t('cta.title')}</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-foreground-secondary">{t('cta.body')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/whitepaper">{t('cta.paper')}</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/fairness">{t('cta.verify')}</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/play">{t('cta.play')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

function Section({
  zone,
  index,
  title,
  lede,
  children,
}: {
  zone: 'warm' | 'cool' | 'pale'
  index: string
  title: string
  lede?: string
  children: React.ReactNode
}) {
  return (
    <section data-zone={zone} className={cn('border-b border-border')}>
      <div className="shell-wide py-20 lg:py-24">
        <span className="num text-[0.66rem] uppercase tracking-[0.2em] text-foreground-muted">{index}</span>
        <h2 className="type-section mt-3 max-w-2xl font-display font-extrabold tracking-[-0.035em] text-foreground">
          {title}
        </h2>
        {lede && (
          <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-foreground-secondary">{lede}</p>
        )}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

function Callout({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-5 py-4">
      <p className="text-[0.92rem] font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-[0.86rem] leading-relaxed text-foreground-secondary">{body}</p>
    </div>
  )
}
