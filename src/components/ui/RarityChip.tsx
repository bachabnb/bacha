'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { rarityStyle, type Rarity } from '@/lib/rarity'

export function RarityChip({ rarity, className }: { rarity: Rarity; className?: string }) {
  const t = useTranslations('rarity')
  const style = rarityStyle[rarity]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-[3px] font-mono text-[0.6rem] font-medium uppercase tracking-[0.12em]',
        style.chip,
        className,
      )}
    >
      {/* A dot as well as the label, so rarity never depends on colour alone. */}
      <span
        aria-hidden
        className="h-1 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: style.bar }}
      />
      {t(rarity)}
    </span>
  )
}
