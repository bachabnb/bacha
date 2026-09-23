'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { Button } from '@/components/ui/Button'
import { tokenByAddress } from '@/lib/tokens'
import { oddsOf, type Machine } from '@/lib/machine'
import { formatUsd, formatPercent, formatTokenAmount } from '@/lib/format'
import type { MarketQuote } from '@/lib/market'
import type { Rarity } from '@/lib/rarity'

const ORDER = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3 } as const

/**
 * Everything this particular machine can drop.
 *
 * Scoped to the selected machine rather than the whole roster, because on this
 * page the question is "what can come out of the thing in front of me".
 */
export function InsideMachine({
  machine,
  quotes,
}: {
  machine: Machine
  quotes: Record<string, MarketQuote>
}) {
  const t = useTranslations('play.inside')

  const entries = buildEntries(machine)

  return (
    <section aria-labelledby="inside-machine">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="inside-machine"
            className="font-display text-[1.5rem] font-bold tracking-[-0.035em] text-foreground"
          >
            {t('title', { label: machine.label })}
          </h2>
          <p className="mt-2 max-w-lg text-[0.88rem] leading-relaxed text-foreground-secondary">
            {t('body')}
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/rewards">{t('viewAll')}</Link>
        </Button>
      </div>

      <ul className="grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const quote = quotes[entry.token.address.toLowerCase()]
          return (
            <li key={entry.token.id} className="bg-surface p-4">
              <div className="flex items-start gap-3">
                <TokenMark token={entry.token} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="num text-[0.92rem] font-semibold text-foreground">
                      {entry.token.symbol}
                    </span>
                    <span className="num text-[0.76rem] text-foreground-secondary">
                      {quote?.priceUsd != null ? formatUsd(quote.priceUsd) : '—'}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[0.74rem] text-foreground-muted">
                    {entry.token.name}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                <RarityChip rarity={entry.bestRarity} />
                <span className="num text-[0.72rem] text-foreground-muted">
                  {formatTokenAmount(entry.minAmount)}
                  {entry.maxAmount !== entry.minAmount && `–${formatTokenAmount(entry.maxAmount)}`}
                </span>
                <span className="num text-[0.74rem] font-medium text-brand">
                  {formatPercent(oddsOf(machine, entry.token.address))}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function buildEntries(machine: Machine) {
  const map = new Map<
    string,
    {
      token: NonNullable<ReturnType<typeof tokenByAddress>>
      bestRarity: Rarity
      minAmount: number
      maxAmount: number
    }
  >()

  for (const prize of machine.prizes) {
    const token = tokenByAddress(prize.token)
    if (!token) continue
    const existing = map.get(token.id)
    if (!existing) {
      map.set(token.id, {
        token,
        bestRarity: prize.rarity,
        minAmount: prize.amount,
        maxAmount: prize.amount,
      })
      continue
    }
    if (ORDER[prize.rarity] > ORDER[existing.bestRarity]) existing.bestRarity = prize.rarity
    existing.minAmount = Math.min(existing.minAmount, prize.amount)
    existing.maxAmount = Math.max(existing.maxAmount, prize.amount)
  }

  return [...map.values()].sort((a, b) => ORDER[b.bestRarity] - ORDER[a.bestRarity])
}
