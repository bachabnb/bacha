'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { ArtImage } from '@/components/brand/ArtImage'
import { rarityStyle } from '@/lib/rarity'
import { machines, rarityBreakdown, type Machine } from '@/lib/machine'
import type { ArtId } from '@/lib/art'
import { cn } from '@/lib/cn'

const ART: Record<string, ArtId> = { bacha: 'tier-boost', quick: 'tier-quick', boost: 'tier-boost', max: 'tier-max' }

/**
 * Machine selection as physical modules rather than tabs.
 *
 * Each one carries its own machine, its price and a miniature of its rarity
 * profile — so choosing is a comparison between products, not a filter. The
 * selected module depresses slightly and lights up, the way a real selector
 * would.
 *
 * With a single machine there is no choice to present, so this renders
 * nothing rather than a one-option radio group. The console reclaims the
 * height, which is why `--selector-h` is only spent here.
 */
export function TierSelector({
  active,
  onSelect,
  disabled,
}: {
  active: string
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  const t = useTranslations('play.selector')
  const reduce = useReducedMotion()

  if (machines.length < 2) return null

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className={cn('grid gap-2', machines.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}
    >
      {machines.map((machine) => {
        const selected = machine.id === active
        return (
          <button
            key={machine.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t('select', { label: machine.label })}
            disabled={disabled}
            onClick={() => onSelect(machine.id)}
            className={cn(
              'group relative flex h-[var(--selector-h)] flex-col items-center justify-center overflow-hidden rounded-[13px] border px-2 py-2.5 text-center',
              'transition-[border-color,background-color,transform,box-shadow] duration-200 ease-[var(--ease-physical)]',
              'disabled:pointer-events-none disabled:opacity-50',
              selected
                ? 'border-brand-line bg-brand-soft translate-y-px shadow-[inset_0_2px_6px_rgba(0,0,0,0.18)]'
                : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
            )}
          >
            {selected && (
              <motion.span
                layoutId="tier-glow"
                aria-hidden
                className="atmosphere-glow pointer-events-none absolute inset-x-0 -top-6 h-20"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
              />
            )}

            <span className="relative h-11 w-auto">
              <ArtImage
                id={ART[machine.id] ?? 'tier-quick'}
                alt=""
                className="h-11 w-auto"
                sizes="80px"
                fadeIn={false}
              />
            </span>

            <span
              className={cn(
                'relative mt-1.5 font-display text-[0.88rem] font-extrabold tracking-[-0.03em]',
                selected ? 'text-brand' : 'text-foreground',
              )}
            >
              {machine.label}
            </span>
            <span className="num relative text-[0.76rem] font-semibold text-foreground">
              ${machine.referencePriceUsd.toFixed(0)}
            </span>

            <span className="relative mt-1.5 flex w-full gap-[2px]" aria-hidden>
              {rarityBreakdown(machine)
                .filter((s) => s.share > 0)
                .map((s) => (
                  <span
                    key={s.rarity}
                    className="h-[3px] rounded-[1px]"
                    style={{ flexGrow: s.share, backgroundColor: rarityStyle[s.rarity].bar }}
                  />
                ))}
            </span>

            <span className="num relative mt-1 text-[0.6rem] text-foreground-muted">
              {t('rewards', { count: distinctAssets(machine) })}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function distinctAssets(machine: Machine): number {
  return new Set(machine.prizes.map((p) => p.token.toLowerCase())).size
}
