import type { Machine } from '@/lib/machine'

export interface NavItem {
  /** Dot-path into the `nav.groups.*` namespace. */
  key: string
  href: string
  external?: boolean
  icon: NavIcon
  /** Values interpolated into the translated description. */
  values?: Record<string, string>
}

export type NavIcon =
  | 'machine'
  | 'quick'
  | 'boost'
  | 'max'
  | 'wallet'
  | 'vault'
  | 'activity'
  | 'token'
  | 'shield'
  | 'steps'
  | 'contract'
  | 'docs'
  | 'info'
  | 'chain'
  | 'faq'
  | 'community'

export interface NavGroup {
  /** Key into `nav.*` for the trigger label. */
  key: 'play' | 'explore' | 'transparency' | 'about'
  items: NavItem[]
  /** Only the Play menu carries the live machine panel. */
  showcase?: boolean
}

/**
 * The navigation model.
 *
 * Kept as data rather than markup so the desktop mega menu and the mobile
 * sheet render the same structure — there is no second copy of the IA to drift.
 * Tier prices are injected at call time so the menu always shows the real
 * configured price rather than a hardcoded one.
 */
export function buildNavigation(machines: Machine[]): NavGroup[] {
  const price = (id: string) => {
    const machine = machines.find((m) => m.id === id)
    return machine ? `$${machine.referencePriceUsd.toFixed(0)}` : '—'
  }

  return [
    {
      key: 'play',
      showcase: true,
      items: [
        { key: 'bacha', href: '/play', icon: 'machine' },
        { key: 'quick', href: '/play?machine=quick', icon: 'quick', values: { price: price('quick') } },
        { key: 'boost', href: '/play?machine=boost', icon: 'boost', values: { price: price('boost') } },
        { key: 'max', href: '/play?machine=max', icon: 'max', values: { price: price('max') } },
        { key: 'me', href: '/me', icon: 'wallet' },
      ],
    },
    {
      key: 'explore',
      items: [
        { key: 'rewards', href: '/rewards', icon: 'vault' },
        { key: 'activity', href: '/activity', icon: 'activity' },
        { key: 'tokens', href: '/rewards#roster', icon: 'token' },
      ],
    },
    {
      key: 'transparency',
      items: [
        { key: 'fairness', href: '/fairness', icon: 'shield' },
        { key: 'howItWorks', href: '/fairness#randomness', icon: 'steps' },
        { key: 'contracts', href: '/fairness#contracts', icon: 'contract' },
        { key: 'docs', href: '/docs', icon: 'docs' },
      ],
    },
    {
      key: 'about',
      items: [
        { key: 'bacha', href: '/docs#about', icon: 'info' },
        { key: 'bnb', href: 'https://www.bnbchain.org', external: true, icon: 'chain' },
        { key: 'faq', href: '/docs#faq', icon: 'faq' },
        { key: 'community', href: 'https://x.com/bachabnb', external: true, icon: 'community' },
      ],
    },
  ]
}
