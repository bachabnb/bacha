export const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC'] as const
export type Rarity = (typeof RARITIES)[number]

export function rarityFromIndex(index: number): Rarity {
  return RARITIES[index] ?? 'COMMON'
}

export function rarityIndex(rarity: Rarity): number {
  return RARITIES.indexOf(rarity)
}

/**
 * How each tier looks.
 *
 * Colours resolve through CSS variables so the scale re-tunes per theme — in
 * light mode Epic goes near-black rather than pale yellow, which would vanish
 * on paper. Rarity is never signalled by colour alone: every surface that uses
 * this also renders the label.
 */
export const rarityStyle: Record<
  Rarity,
  {
    labelKey: Rarity
    /** CSS variable reference, for bars and inline styles. */
    bar: string
    chip: string
    capsuleFinish: 'graphite' | 'acrylic' | 'bnb' | 'chrome'
    celebrate: boolean
  }
> = {
  COMMON: {
    labelKey: 'COMMON',
    bar: 'var(--rarity-common)',
    chip: 'bg-surface-hover text-foreground-muted border-border',
    capsuleFinish: 'graphite',
    celebrate: false,
  },
  UNCOMMON: {
    labelKey: 'UNCOMMON',
    bar: 'var(--rarity-uncommon)',
    chip: 'bg-surface-hover text-foreground-secondary border-border-strong',
    capsuleFinish: 'acrylic',
    celebrate: false,
  },
  RARE: {
    labelKey: 'RARE',
    bar: 'var(--rarity-rare)',
    chip: 'bg-brand-soft text-brand border-brand-line',
    capsuleFinish: 'bnb',
    celebrate: false,
  },
  EPIC: {
    labelKey: 'EPIC',
    bar: 'var(--rarity-epic)',
    chip: 'bg-brand-soft text-foreground border-brand-line font-semibold',
    capsuleFinish: 'chrome',
    celebrate: true,
  },
}
