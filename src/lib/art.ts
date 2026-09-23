import manifest from '@data/art-manifest.json'

/**
 * Art lookup.
 *
 * The manifest is produced by the generation pipeline and mirrored into
 * `data/` so it can be imported without reaching into `public/`. Every
 * consumer must tolerate a missing asset — the site has to run with no art
 * pack at all — which is why `hasArt` exists and `art()` degrades to a
 * transparent pixel rather than throwing.
 */

interface ArtVariant {
  width: number
  height: number
  file: string
  bytes: number
}

interface ArtAsset {
  id: string
  display: string
  variants: ArtVariant[]
  intrinsicWidth: number
  intrinsicHeight: number
  aspectRatio: string
  section: string
  transparentBackground: boolean
}

const assets = (manifest.assets ?? {}) as unknown as Record<string, ArtAsset>

export type ArtId =
  | 'hero-machine'
  | 'hero-environment'
  | 'machine-exploded'
  | 'machine-menu'
  | 'tier-quick'
  | 'tier-boost'
  | 'tier-max'
  | 'capsule-yellow'
  | 'capsule-black'
  | 'capsule-chrome'
  | 'capsule-cluster'
  | 'cta-capsule'
  | 'step-connect'
  | 'step-spin'
  | 'step-reveal'
  | 'fairness-verify'
  | 'activity-rail'
  | 'token-orbit'
  | 'gacha-rebuilt'
  | 'proof-core'
  | 'reward-vault'

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export function art(id: ArtId): string {
  return assets[id]?.display ?? TRANSPARENT_PIXEL
}

export function hasArt(id: ArtId): boolean {
  return Boolean(assets[id]?.display)
}

export function artMeta(id: ArtId): ArtAsset | undefined {
  return assets[id]
}

/** Intrinsic box, so layouts can reserve space and avoid shift. */
export function artSize(id: ArtId): { width: number; height: number } {
  const asset = assets[id]
  return asset
    ? { width: asset.intrinsicWidth, height: asset.intrinsicHeight }
    : { width: 1, height: 1 }
}
