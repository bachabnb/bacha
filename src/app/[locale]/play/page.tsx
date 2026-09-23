import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PlayClient } from '@/components/play/PlayClient'
import { getMarketSnapshot } from '@/lib/market'
import { latestSettledSpin } from '@/lib/spin/latest'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.play' })
  return { title: t('title'), description: t('description') }
}

export const revalidate = 60

export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'common' })
  const [snapshot, latest] = await Promise.all([getMarketSnapshot(), latestSettledSpin()])

  return (
    <Suspense
      fallback={<div className="shell-wide py-20 text-foreground-secondary">{t('loading')}</div>}
    >
      <PlayClient quotes={snapshot.quotes} latest={latest} />
    </Suspense>
  )
}
