import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { getWhitepaper } from '@/content/whitepaper'
import type { Locale } from '@/i18n/routing'

/** Chapters worth surfacing on the homepage — the ones a sceptic opens first. */
const FEATURED = ['randomness', 'prize-tables', 'vault', 'security', 'risks', 'economics']

/**
 * The whitepaper, on the homepage.
 *
 * Deliberately not a full-viewport section: the page's other bands are each a
 * composition to stop on, and a list of chapter links is not. It reads as a
 * shelf — here is the document, here is what is in it, open it.
 *
 * Chapter titles come from the paper itself rather than from the message
 * dictionary, so a renamed chapter cannot leave a stale link label behind.
 */
export async function WhitepaperSection({ locale }: { locale: string }) {
  const t = await getTranslations('home.whitepaper')
  const doc = getWhitepaper(locale as Locale)
  const featured = FEATURED.map((id) => doc.chapters.find((c) => c.id === id)).filter(
    (c): c is NonNullable<typeof c> => Boolean(c),
  )

  return (
    <section data-zone="pale" className="border-y border-border">
      <div className="shell-wide py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="max-w-md">
            <span className="eyebrow">{t('eyebrow')}</span>
            <h2 className="type-section mt-4 font-display font-extrabold text-foreground">
              {doc.title}
            </h2>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-foreground-secondary">
              {t('body')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/whitepaper">{t('cta')}</Link>
              </Button>
              <span className="num text-[0.74rem] text-foreground-muted">
                {t('meta', { chapters: doc.chapters.length, version: doc.version })}
              </span>
            </div>
          </div>

          <ul className="grid gap-px self-start overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2">
            {featured.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/whitepaper#${chapter.id}`}
                  className="group flex h-full flex-col bg-surface px-5 py-4 transition-colors hover:bg-surface-hover"
                >
                  <span className="num text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                    {chapter.index}
                  </span>
                  <span className="mt-2 font-display text-[1rem] font-bold tracking-[-0.02em] text-foreground">
                    {chapter.title}
                  </span>
                  {chapter.lede && (
                    <span className="mt-1 text-[0.78rem] leading-snug text-foreground-muted">
                      {chapter.lede}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
