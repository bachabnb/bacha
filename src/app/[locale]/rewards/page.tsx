import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { RewardsGrid, type RewardCard } from '@/components/rewards/RewardsGrid'
import { ArtImage } from '@/components/brand/ArtImage'
import { getMarketSnapshot, quoteFor } from '@/lib/market'
import { rosterTokens, machines } from '@/lib/machine'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.rewards' })
  return { title: t('title'), description: t('description') }
}

export const revalidate = 60

export default async function RewardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'rewards.page' })
  const snapshot = await getMarketSnapshot()
  const cards: RewardCard[] = rosterTokens().map((token) => ({
    token,
    quote: quoteFor(snapshot, token.address),
  }))

  return (
    <div className="shell-wide py-14 lg:py-20">
      <header className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1 className="type-hero mt-4 font-display font-extrabold text-foreground">{t('title')}</h1>
          <p className="mt-5 max-w-xl text-[1rem] leading-relaxed text-foreground-secondary">{t('body')}</p>
          <p className="mt-4 max-w-xl text-[0.86rem] leading-relaxed text-foreground-muted">{t('changes')}</p>
        </div>

        <div className="panel relative flex items-center gap-6 overflow-hidden p-6">
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full" />
          <div className="relative w-24 shrink-0">
            <ArtImage id="reward-vault" alt="" sizes="120px" />
          </div>
          <dl className="relative min-w-0 space-y-3">
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{t('assets')}</dt>
              <dd className="num text-[1.3rem] font-semibold text-foreground">{cards.length}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{t('machines')}</dt>
              <dd className="num text-[1.3rem] font-semibold text-foreground">{machines.length}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div id="roster" className="mt-14 scroll-mt-24">
        <RewardsGrid cards={cards} />
      </div>

      <p className="mt-10 max-w-3xl text-[0.78rem] leading-relaxed text-foreground-muted">
        {t('footnote')}
        {snapshot.source === null && ` ${t('priceUnavailable')}`}
      </p>
    </div>
  )
}
