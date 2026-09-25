import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { locales, type Locale } from '@/i18n/routing'
import { Blocks } from '@/components/whitepaper/Blocks'
import { WhitepaperToc } from '@/components/whitepaper/WhitepaperToc'
import { PrintButton } from '@/components/whitepaper/PrintButton'
import { BachaGhostMark } from '@/components/brand/BachaLogo'
import { getWhitepaper } from '@/content/whitepaper'
import { machineConfigGeneratedAt } from '@/lib/machine'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.whitepaper' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}/whitepaper` },
  }
}

/**
 * The whitepaper.
 *
 * A reading page, not a marketing page: one column at a comfortable measure,
 * a contents rail that tracks position, and no section that competes with the
 * text for attention. Every factual claim about the deployment comes from a
 * `live` block rather than the prose, so the paper cannot outrun the product.
 */
export default async function WhitepaperPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'whitepaper' })
  const doc = getWhitepaper(locale as Locale)
  const entries = doc.chapters.map((c) => ({ id: c.id, index: c.index, title: c.title }))

  const updated = new Date(machineConfigGeneratedAt).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div data-zone="pale" className="relative">
      <BachaGhostMark className="brand-ghost pointer-events-none absolute right-[-4%] top-[-2%] w-[26rem] print:hidden" />

      <div className="shell-wide relative pb-24 pt-10 lg:pt-14">
        {/* --------------------------------------------------------- masthead */}
        <header className="border-b border-border pb-10">
          <p className="num text-[0.64rem] uppercase tracking-[0.2em] text-foreground-muted">
            {t('eyebrow')}
          </p>
          <h1 className="type-section mt-4 max-w-3xl font-display font-extrabold tracking-[-0.035em] text-foreground">
            {doc.title}
          </h1>
          <p className="mt-5 max-w-2xl text-[1.02rem] leading-relaxed text-foreground-secondary">
            {doc.subtitle}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <PrintButton label={t('print')} />
            <Link
              href="/fairness"
              className="rounded-[11px] border border-border bg-surface px-4 py-2.5 text-[0.84rem] font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground print:hidden"
            >
              {t('readFairness')}
            </Link>
            <span className="num ml-auto text-[0.72rem] text-foreground-muted">
              {t('version', { version: doc.version })} · {updated}
            </span>
          </div>
        </header>

        {/* ------------------------------------------------- contents + body */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14 print:block">
          <WhitepaperToc entries={entries} />

          <article className="wp-prose min-w-0">
            {doc.chapters.map((chapter) => (
              <section key={chapter.id} id={chapter.id} className="wp-chapter">
                <p className="num text-[0.66rem] uppercase tracking-[0.2em] text-foreground-muted">
                  {chapter.index}
                </p>
                <h2 className="wp-h2">{chapter.title}</h2>
                {chapter.lede && <p className="wp-lede">{chapter.lede}</p>}
                <Blocks blocks={chapter.blocks} />
              </section>
            ))}

            <p className="mt-16 print:hidden">
              <a
                href="#main"
                className="num text-[0.78rem] text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                ↑ {t('backToTop')}
              </a>
            </p>
          </article>
        </div>
      </div>
    </div>
  )
}
