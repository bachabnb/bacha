import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { ArtImage } from '@/components/brand/ArtImage'
import { getMarketSnapshot } from '@/lib/market'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.activity' })
  return { title: t('title'), description: t('description') }
}

export const revalidate = 30

export default async function ActivityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'activity' })
  const snapshot = await getMarketSnapshot()

  return (
    <div className="shell-wide py-14 lg:py-20">
      <header className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div className="max-w-2xl">
          <span className="eyebrow">{t('page.eyebrow')}</span>
          <h1 className="type-hero mt-4 font-display font-extrabold text-foreground">{t('page.title')}</h1>
          <p className="mt-5 text-[1rem] leading-relaxed text-foreground-secondary">{t('page.body')}</p>
        </div>
        <div className="relative mx-auto w-full max-w-[20rem] lg:max-w-none">
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[14%] rounded-full" />
          <ArtImage id="activity-rail" alt={t('railAlt')} className="relative" sizes="(max-width: 1024px) 60vw, 26vw" />
        </div>
      </header>

      <div className="mt-12">
        <ActivityFeed quotes={snapshot.quotes} />
      </div>
    </div>
  )
}
