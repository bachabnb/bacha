'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { rarityStyle, type Rarity } from '@/lib/rarity'
import { formatPercent } from '@/lib/format'

export interface OddsSegment {
  rarity: Rarity
  share: number
}

/**
 * The probability readout.
 *
 * One continuous track split by rarity, with each percentage sitting under its
 * own segment rather than in a separate legend — so the bar and the numbers
 * cannot disagree. Every value comes from the prize table the spin will
 * actually resolve against; nothing here is hardcoded.
 */
export function OddsBar({
  segments,
  className,
  showLabels = true,
  height = 6,
}: {
  segments: OddsSegment[]
  className?: string
  showLabels?: boolean
  height?: number
}) {
  const t = useTranslations('rarity')
  const live = segments.filter((s) => s.share > 0)
  const total = live.reduce((sum, s) => sum + s.share, 0)

  const label = live
    .map((s) => `${t(s.rarity)} ${formatPercent(s.share)}`)
    .join(', ')

  return (
    <div className={cn('w-full', className)}>
      <div className="flex w-full gap-[3px]" style={{ height }} role="img" aria-label={label}>
        {live.map((s) => (
          <div
            key={s.rarity}
            className="rounded-[2px] transition-[flex-grow] duration-500 ease-[var(--ease-physical)]"
            style={{ flexGrow: s.share, backgroundColor: rarityStyle[s.rarity].bar }}
          />
        ))}
      </div>

      {showLabels && (
        <div className="mt-3 flex w-full gap-[3px]">
          {live.map((s) => (
            <div key={s.rarity} className="min-w-0" style={{ flexGrow: s.share, flexBasis: 0 }}>
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-[5px] w-[5px] shrink-0 rounded-[1px]"
                  style={{ backgroundColor: rarityStyle[s.rarity].bar }}
                />
                <span className="num truncate text-[0.72rem] font-medium text-foreground">
                  {formatPercent(s.share / (total || 1))}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[0.62rem] uppercase tracking-[0.12em] text-foreground-muted">
                {t(s.rarity)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
