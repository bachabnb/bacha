'use client'

import Image from 'next/image'
import { useId } from 'react'
import { cn } from '@/lib/cn'

export type CapsuleFinish = 'graphite' | 'acrylic' | 'bnb' | 'chrome'

interface FinishSpec {
  /** top dome, bottom shell */
  dome: [string, string, string]
  shell: [string, string, string]
  rim: string
  seam: string
  inner: string
  glow: string | null
}

/**
 * Four materials, one form. Graphite is the everyday capsule, acrylic reads as
 * translucent plastic, bnb is the yellow house capsule, and chrome is reserved
 * for Epic so a rare pull looks physically different rather than just badged.
 */
const FINISHES: Record<CapsuleFinish, FinishSpec> = {
  graphite: {
    dome: ['#3a3f48', '#272b32', '#1a1d22'],
    shell: ['#24272d', '#1a1d22', '#121419'],
    rim: 'rgba(255,255,255,0.16)',
    seam: 'rgba(0,0,0,0.7)',
    inner: '#0e1013',
    glow: null,
  },
  acrylic: {
    dome: ['rgba(214,222,235,0.42)', 'rgba(150,163,183,0.2)', 'rgba(90,100,118,0.14)'],
    shell: ['#2b3038', '#20242b', '#161920'],
    rim: 'rgba(255,255,255,0.32)',
    seam: 'rgba(255,255,255,0.14)',
    inner: 'rgba(12,15,20,0.72)',
    glow: null,
  },
  bnb: {
    dome: ['#ffe680', '#f8ce3c', '#e0a808'],
    shell: ['#c99a06', '#a37c05', '#6b5204'],
    rim: 'rgba(255,248,225,0.55)',
    seam: 'rgba(60,44,2,0.55)',
    inner: '#2a2002',
    glow: 'rgba(240,185,11,0.45)',
  },
  chrome: {
    dome: ['#ffffff', '#cfd6e2', '#8d97a8'],
    shell: ['#e8edf5', '#a9b3c3', '#5f6979'],
    rim: 'rgba(255,255,255,0.9)',
    seam: 'rgba(60,66,78,0.6)',
    inner: '#1b1f26',
    glow: 'rgba(255,240,190,0.5)',
  },
}

interface CapsuleProps {
  finish?: CapsuleFinish
  size?: number
  /** Token logo shown through the dome. */
  logo?: string | null
  logoAlt?: string
  /** Splits the capsule apart, for the reveal. */
  open?: boolean
  className?: string
  /** Turns off the specular sweep on decorative instances. */
  flat?: boolean
}

export function Capsule({
  finish = 'graphite',
  size = 96,
  logo,
  logoAlt = '',
  open = false,
  className,
  flat = false,
}: CapsuleProps) {
  const id = useId().replace(/:/g, '')
  const f = FINISHES[finish]
  const w = size
  const h = size * 1.12

  return (
    <div
      className={cn('relative inline-block', className)}
      style={{ width: w, height: h }}
      aria-hidden={logo ? undefined : true}
    >
      <svg
        viewBox="0 0 100 112"
        width={w}
        height={h}
        fill="none"
        className="overflow-visible"
        role={logo ? 'img' : undefined}
        aria-label={logo ? `${logoAlt} capsule` : undefined}
      >
        <defs>
          <linearGradient id={`dome-${id}`} x1="0.18" y1="0" x2="0.86" y2="1">
            <stop offset="0%" stopColor={f.dome[0]} />
            <stop offset="52%" stopColor={f.dome[1]} />
            <stop offset="100%" stopColor={f.dome[2]} />
          </linearGradient>
          <linearGradient id={`shell-${id}`} x1="0.2" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor={f.shell[0]} />
            <stop offset="55%" stopColor={f.shell[1]} />
            <stop offset="100%" stopColor={f.shell[2]} />
          </linearGradient>
          <radialGradient id={`spec-${id}`} cx="0.3" cy="0.22" r="0.55">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.68" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`clipTop-${id}`}>
            <path d="M50 3c24.3 0 42 17.4 42 39.6V54H8V42.6C8 20.4 25.7 3 50 3Z" />
          </clipPath>
        </defs>

        {f.glow && (
          <ellipse cx="50" cy="58" rx="46" ry="48" fill={f.glow} opacity="0.3" style={{ filter: 'blur(14px)' }} />
        )}

        {/* lower shell */}
        <g style={{ transform: open ? 'translateY(7px)' : 'none', transition: 'transform 420ms var(--ease-physical)' }}>
          <path
            d="M8 58v11.4C8 91.6 25.7 109 50 109s42-17.4 42-39.6V58H8Z"
            fill={`url(#shell-${id})`}
          />
          <path
            d="M8 58v11.4C8 91.6 25.7 109 50 109s42-17.4 42-39.6V58H8Z"
            fill="none"
            stroke={f.rim}
            strokeWidth="0.9"
            strokeOpacity="0.5"
          />
          {/* inner shadow where the two halves meet */}
          <rect x="8" y="58" width="84" height="7" fill="#000" opacity="0.32" />
        </g>

        {/* The contents sit between the halves, the way a real capsule works:
            visible through the dome, and fully exposed once it splits. */}
        {logo && (
          <foreignObject x="26" y="20" width="48" height="48" style={{ overflow: 'visible' }}>
            <div className="flex h-full w-full items-center justify-center">
              <Image
                src={logo}
                alt={logoAlt}
                width={48}
                height={48}
                className="rounded-full"
                style={{
                  filter: open
                    ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.75))'
                    : 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
                  transition: 'all 420ms var(--ease-physical)',
                }}
                unoptimized
              />
            </div>
          </foreignObject>
        )}

        {/* upper dome */}
        <g
          style={{
            transform: open ? 'translateY(-16px) rotate(-7deg)' : 'none',
            transformOrigin: '50px 40px',
            transition: 'transform 420ms var(--ease-physical)',
          }}
        >
          <path
            d="M50 3c24.3 0 42 17.4 42 39.6V54H8V42.6C8 20.4 25.7 3 50 3Z"
            fill={`url(#dome-${id})`}
            /* A capsule holding something shows it: the dome thins out so the
               contents read through it, exactly as moulded plastic would. */
            opacity={logo && !open ? 0.46 : 1}
          />
          {!flat && (
            <g clipPath={`url(#clipTop-${id})`}>
              <ellipse cx="34" cy="24" rx="26" ry="19" fill={`url(#spec-${id})`} />
              <path
                d="M22 44c0-13 11-24 25-26"
                stroke="#ffffff"
                strokeOpacity="0.42"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          )}
          <path
            d="M50 3c24.3 0 42 17.4 42 39.6V54H8V42.6C8 20.4 25.7 3 50 3Z"
            fill="none"
            stroke={f.rim}
            strokeWidth="1"
          />
          {/* seam lip */}
          <rect x="8" y="50" width="84" height="4" rx="1.4" fill={f.seam} opacity="0.75" />
        </g>
      </svg>
    </div>
  )
}

/**
 * Flat, cheap capsule for decoration — bullets, empty states, section marks.
 * No gradients or clip paths, so dozens can render without cost.
 */
export function CapsuleGlyph({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg viewBox="0 0 24 27" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 1.5c5.8 0 10 4.2 10 9.6v5.4c0 5.4-4.2 9.6-10 9.6S2 21.9 2 16.5v-5.4C2 5.7 6.2 1.5 12 1.5Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        opacity={filled ? 1 : 0.9}
      />
      <path d="M2 13.2h20" stroke={filled ? '#0b0e11' : 'currentColor'} strokeWidth="1.6" opacity="0.85" />
    </svg>
  )
}
