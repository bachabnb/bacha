import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MyBacha } from '@/components/me/MyBacha'
import { getMarketSnapshot } from '@/lib/market'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.me' })
  return { title: t('title'), description: t('description'), robots: { index: false } }
}

export default async function MePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const snapshot = await getMarketSnapshot()
  return <MyBacha quotes={snapshot.quotes} />
}
