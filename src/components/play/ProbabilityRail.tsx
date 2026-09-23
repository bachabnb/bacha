'use client'

import { useTranslations } from 'next-intl'
import { rarityStyle, type Rarity } from '@/lib/rarity'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The prize distribution, at a size worth reading.
 *
 * One row per rarity with a proportional bar, so a 1% Epic is visibly a
 * sliver rather than a truncated label in a crowded strip. Every label has
 * its own line and never abbreviates.
 */
export function ProbabilityRail({
  segments,
  className,
}: {
  segments: { rarity: Rarity; share: number }[]
  className?: string
}) {
  const t = useTranslations('rarity')
  const live = segments.filter((s) => s.share > 0)
  const max = Math.max(...live.map((s) => s.share), 0.0001)

  return (
    <ul className={cn('space-y-1', className)}>
      {live.map((segment) => {
        const style = rarityStyle[segment.rarity]
        return (
          <li key={segment.rarity} className="flex h-[24px] items-center gap-2.5">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: style.bar }}
            />
            <span className="w-[5.25rem] shrink-0 text-[0.75rem] font-medium text-foreground-secondary">
              {t(segment.rarity)}
            </span>
            <span className="h-[7px] flex-1 overflow-hidden rounded-[3px] bg-surface-sunken">
              <span
                className="block h-full rounded-[3px] transition-[width] duration-500 ease-[var(--ease-physical)]"
                style={{ width: `${(segment.share / max) * 100}%`, backgroundColor: style.bar }}
              />
            </span>
            <span className="num w-[3.5rem] shrink-0 text-right text-[0.8rem] font-semibold text-foreground">
              {formatPercent(segment.share)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
