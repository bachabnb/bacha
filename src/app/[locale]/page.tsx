import { setRequestLocale } from 'next-intl/server'
import { Hero } from '@/components/home/Hero'
import { MachinePreview } from '@/components/home/MachinePreview'
import { WhatsInside, type RosterEntry } from '@/components/home/WhatsInside'
import { HowItWorks } from '@/components/home/HowItWorks'
import { TierCards } from '@/components/home/TierCards'
import { LiveDrops } from '@/components/home/LiveDrops'
import { FairnessSection } from '@/components/home/FairnessSection'
import { Discovery } from '@/components/home/Discovery'
import { GachaRebuilt } from '@/components/home/GachaRebuilt'
import { FinalCta } from '@/components/home/FinalCta'
import { getMarketSnapshot, quoteFor } from '@/lib/market'
import { rosterTokens, machines, oddsOf, defaultMachine } from '@/lib/machine'
import { latestSettledSpin } from '@/lib/spin/latest'
import type { MachineToken } from '@/components/brand/BachaMachine'

export const revalidate = 120

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [snapshot, latest] = await Promise.all([getMarketSnapshot(), latestSettledSpin()])
  const roster = rosterTokens()

  const entries: RosterEntry[] = roster.map((token) => ({
    token,
    quote: quoteFor(snapshot, token.address),
    bestOdds: Math.max(...machines.map((m) => oddsOf(m, token.address))),
  }))

  const chamberTokens: MachineToken[] = roster.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    logo: t.logo,
  }))

  // Facts about the machine itself — never invented traction numbers.
  const stats = [
    { key: 'assets', value: String(roster.length) },
    { key: 'machines', value: String(machines.length) },
    { key: 'entries', value: String(machines.reduce((sum, m) => sum + m.prizes.length, 0)) },
    { key: 'rarities', value: '4' },
  ]

  return (
    <>
      <Hero tokens={chamberTokens} machine={defaultMachine} roster={roster} />
      <MachinePreview latest={latest} />
      <WhatsInside roster={entries} />
      <HowItWorks />
      <TierCards />
      <LiveDrops />
      <FairnessSection />
      <Discovery tokens={roster} />
      <GachaRebuilt stats={stats} />
      <FinalCta />
    </>
  )
}
