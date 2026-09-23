'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * The official Bacha mark.
 *
 * Lives at `public/brand/bacha-logo.png` so it can be replaced without
 * touching code. If that file is missing the vector fallback renders instead,
 * so the product never shows a broken logo — but the supplied artwork is the
 * canonical mark and should always be present in a real deployment.
 */
export const LOGO_SRC = '/brand/bacha-logo-256.webp'

/** Sized variants, so the header does not download a 512px mark. */
const LOGO_SRCSET = '/brand/bacha-logo-64.webp 64w, /brand/bacha-logo-128.webp 128w, /brand/bacha-logo-256.webp 256w, /brand/bacha-logo-512.webp 512w'

export function BachaIcon({ className, seam = true }: { className?: string; seam?: boolean }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <span className={cn('relative inline-block shrink-0', className)}>
        {/* Plain <img>: the variants are already optimised and sized, so
            routing them back through the image optimiser buys nothing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC}
          srcSet={LOGO_SRCSET}
          sizes="(max-width: 640px) 40px, 56px"
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
          decoding="async"
          draggable={false}
        />
      </span>
    )
  }

  return <BachaIconFallback className={className} seam={seam} />
}

/**
 * Vector stand-in: a capsule silhouette with a B knocked out of it. Same idea
 * as the supplied mark — capsule body, seam broken at the midline, B in the
 * counter-space — drawn flat so it holds at favicon sizes and in one colour.
 */
export function BachaIconFallback({ className, seam = true }: { className?: string; seam?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('shrink-0', className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="
          M10.4 1.6h11.2c4.86 0 8.8 3.94 8.8 8.8v11.2c0 4.86-3.94 8.8-8.8 8.8H10.4c-4.86 0-8.8-3.94-8.8-8.8V10.4c0-4.86 3.94-8.8 8.8-8.8Z
          M10 7h8.2c3.2 0 5.2 1.9 5.2 4.6 0 2-1 3.4-2.7 4 2.1.5 3.3 2.1 3.3 4.4 0 2.9-2.1 5-5.6 5H10V7Z
          M13.6 10.2v3.9h4c1.5 0 2.3-.7 2.3-2s-.8-1.9-2.3-1.9h-4Z
          M13.6 17.6v4.2h4.4c1.6 0 2.4-.7 2.4-2.1s-.8-2.1-2.4-2.1h-4.4Z
        "
      />
      {seam && (
        <>
          <rect x="1.6" y="15.2" width="7.2" height="1.6" rx="0.8" fill="currentColor" opacity="0.35" />
          <rect x="24.4" y="15.2" width="6" height="1.6" rx="0.8" fill="currentColor" opacity="0.35" />
        </>
      )}
    </svg>
  )
}

/**
 * The lockup. Sized to be an anchor rather than a favicon — the mark is one of
 * the few things that has to be recognisable at a glance on every screen.
 */
export function BachaWordmark({
  className,
  iconClassName,
  wordmarkClassName,
  showIcon = true,
}: {
  className?: string
  iconClassName?: string
  wordmarkClassName?: string
  showIcon?: boolean
}) {
  return (
    <span className={cn('inline-flex select-none items-center gap-2.5', className)}>
      {showIcon && <BachaIcon className={cn('h-10 w-[33px] text-brand', iconClassName)} />}
      <span
        className={cn(
          'font-display text-[1.45rem] font-extrabold leading-none tracking-[-0.05em] text-foreground',
          wordmarkClassName,
        )}
      >
        BACHA
      </span>
    </span>
  )
}

/** The B alone, oversized and faint, used as a background device. */
export function BachaGhostMark({ className }: { className?: string }) {
  return <BachaIconFallback className={cn('brand-ghost', className)} seam={false} />
}
