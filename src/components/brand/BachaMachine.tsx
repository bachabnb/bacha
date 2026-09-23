'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { Capsule, type CapsuleFinish } from './Capsule'
import { cn } from '@/lib/cn'

export type MachineState = 'idle' | 'arming' | 'spinning' | 'revealing' | 'result'

export interface MachineToken {
  id: string
  symbol: string
  logo: string
}

interface BachaMachineProps {
  state?: MachineState
  tokens: MachineToken[]
  /** The capsule that lands in the tray once a spin settles. */
  result?: { logo: string; symbol: string; finish: CapsuleFinish } | null
  className?: string
  /** Shrinks chrome and capsule count for the homepage preview. */
  compact?: boolean
  label?: string
  /** Shown on the tray lip. The tray is where every spin ends up. */
  trayLabel?: string
}

/**
 * The Bacha machine.
 *
 * Built as vector geometry rather than a rendered image so it stays crisp at
 * any size, themes with the rest of the product, and can be driven by real
 * spin state. Reads as a machined object — bevelled chassis, a lit chamber,
 * a dispense chute — not a slot machine.
 */
export function BachaMachine({
  state = 'idle',
  tokens,
  result = null,
  className,
  compact = false,
  label = 'BACHA · UNIT 01',
  trayLabel,
}: BachaMachineProps) {
  const reduce = useReducedMotion()
  const active = state === 'spinning' || state === 'revealing'
  const powered = state !== 'idle'

  const count = compact ? 7 : 11
  const floaters = useMemo(() => buildFloaters(tokens, count), [tokens, count])

  return (
    <div className={cn('relative select-none', className)}>
      {/* studio floor bounce */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 bottom-[-4%] h-[14%] w-[78%] -translate-x-1/2 rounded-[50%] blur-2xl"
        style={{ background: 'radial-gradient(ellipse at center, rgba(240,185,11,0.16), transparent 68%)' }}
      />

      <div className="relative aspect-[0.78/1] w-full">
        <MachineChassis powered={powered} active={active} label={label} settled={state === 'result'} />

        {/* Tray readout — HTML rather than baked lettering, so it translates. */}
        {trayLabel && (
          <div
            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
            style={{ bottom: '4%' }}
          >
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono text-[0.56rem] uppercase tracking-[0.16em] transition-colors duration-300',
                state === 'result'
                  ? 'border-brand-line bg-brand-soft text-brand'
                  : active
                    ? 'border-brand-line/60 bg-brand-soft/60 text-brand'
                    : 'border-border bg-surface/80 text-foreground-muted',
              )}
            >
              {trayLabel}
            </span>
          </div>
        )}

        {/* ---------------- chamber contents ---------------- */}
        <div
          className="absolute overflow-hidden"
          style={{ left: '10%', right: '10%', top: '11.5%', height: '40%', borderRadius: '14% 14% 6% 6% / 10% 10% 4% 4%' }}
        >
          {floaters.map((f, i) => (
            <motion.div
              key={`${f.token.id}-${i}`}
              className="absolute"
              style={{ left: `${f.x}%`, top: `${f.y}%`, zIndex: Math.round(f.depth * 10) }}
              initial={false}
              animate={
                reduce
                  ? { opacity: 0.42 + f.depth * 0.5 }
                  : {
                      y: active ? [0, -14, 6, 0] : [0, -7, 0],
                      x: active ? [0, f.drift, -f.drift * 0.6, 0] : [0, f.drift * 0.35, 0],
                      rotate: active ? [f.tilt, f.tilt + 26, f.tilt - 18, f.tilt] : [f.tilt, f.tilt + 5, f.tilt],
                      opacity: 0.42 + f.depth * 0.5,
                    }
              }
              transition={{
                duration: active ? 1.1 + f.depth * 0.5 : 5.5 + f.depth * 2.5,
                repeat: Infinity,
                ease: active ? 'easeInOut' : 'easeInOut',
                delay: f.delay,
              }}
            >
              <Capsule
                finish={f.finish}
                size={f.size}
                logo={f.token.logo}
                logoAlt={f.token.symbol}
                flat={f.depth < 0.45}
                className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]"
              />
            </motion.div>
          ))}

          {/* chamber lighting: a warm wash from the base of the glass */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: 'linear-gradient(to top, rgba(240,185,11,0.3), transparent 72%)' }}
            animate={reduce ? { opacity: powered ? 0.9 : 0.45 } : { opacity: active ? [0.6, 1, 0.6] : powered ? 0.8 : 0.42 }}
            transition={{ duration: 1.5, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
          />

          {/* glass */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(118deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 26%, transparent 42%, transparent 72%, rgba(255,255,255,0.05) 100%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: 'inset 0 0 44px 10px rgba(0,0,0,0.72), inset 0 2px 0 rgba(255,255,255,0.1)' }}
          />
        </div>

        {/* ---------------- the pull that lands in the tray ---------------- */}
        {result && (
          <motion.div
            className="absolute left-1/2 z-20"
            style={{ top: '18%' }}
            initial={{ y: 0, x: '-50%', scale: 0.7, opacity: 0 }}
            animate={{
              y: reduce ? ['0%', '340%'] : ['0%', '250%', '320%', '338%', '340%'],
              x: '-50%',
              scale: reduce ? 1 : [0.7, 0.95, 1.04, 0.99, 1],
              opacity: 1,
              rotate: reduce ? 0 : [0, 22, -8, 3, 0],
            }}
            transition={{ duration: reduce ? 0.25 : 1.05, ease: [0.4, 0.05, 0.3, 1], times: reduce ? undefined : [0, 0.55, 0.75, 0.9, 1] }}
          >
            <Capsule finish={result.finish} size={compact ? 52 : 74} logo={result.logo} logoAlt={result.symbol} open />
          </motion.div>
        )}

        {/* ---------------- rotating mechanism behind the deck ---------------- */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: '54.5%', width: '17%', aspectRatio: '1' }}
          animate={reduce ? {} : { rotate: active ? 360 : 0 }}
          transition={{ duration: active ? 1.25 : 0, repeat: active ? Infinity : 0, ease: 'linear' }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="h-full w-full">
            <circle cx="32" cy="32" r="29" stroke="rgba(255,255,255,0.09)" strokeWidth="2" />
            <circle cx="32" cy="32" r="21" stroke="rgba(240,185,11,0.32)" strokeWidth="1.5" strokeDasharray="5 9" />
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <rect
                key={deg}
                x="30.5"
                y="4"
                width="3"
                height="8"
                rx="1.5"
                fill={powered ? 'rgba(240,185,11,0.85)' : 'rgba(255,255,255,0.18)'}
                transform={`rotate(${deg} 32 32)`}
              />
            ))}
          </svg>
        </motion.div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- chassis */

function MachineChassis({
  powered,
  active,
  label,
  settled,
}: {
  powered: boolean
  active: boolean
  label: string
  settled: boolean
}) {
  return (
    <svg viewBox="0 0 400 512" fill="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="m-body" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#1c2027" />
          <stop offset="30%" stopColor="#131619" />
          <stop offset="72%" stopColor="#0d0f13" />
          <stop offset="100%" stopColor="#08090c" />
        </linearGradient>
        {/* Rim light down both flanks — what makes it read as a moulded
            object under a single hard studio light rather than a flat panel. */}
        <linearGradient id="m-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
          <stop offset="6%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="60%" stopColor="rgba(0,0,0,0.18)" />
          <stop offset="95%" stopColor="rgba(255,255,255,0.015)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.09)" />
        </linearGradient>
        <linearGradient id="m-deck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#212630" />
          <stop offset="100%" stopColor="#101318" />
        </linearGradient>
        <radialGradient id="m-glass" cx="0.4" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#1b1f27" />
          <stop offset="70%" stopColor="#0c0e12" />
          <stop offset="100%" stopColor="#07080b" />
        </radialGradient>
        {/* The chute reads as a recess: black at the throat, catching a
            little light where the tray floor turns back toward the viewer. */}
        <linearGradient id="m-chute" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#020304" />
          <stop offset="55%" stopColor="#07090c" />
          <stop offset="88%" stopColor="#15181f" />
          <stop offset="100%" stopColor="#1d222b" />
        </linearGradient>
        <filter id="m-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* chassis */}
      <rect x="18" y="14" width="364" height="478" rx="34" fill="url(#m-body)" />
      <rect x="18" y="14" width="364" height="478" rx="34" fill="url(#m-edge)" />
      <rect x="18.75" y="14.75" width="362.5" height="476.5" rx="33.5" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />
      {/* top lip catching the key light */}
      <rect x="40" y="15.5" width="320" height="1.5" rx="0.75" fill="rgba(255,255,255,0.18)" />

      {/* crown */}
      <rect x="40" y="26" width="320" height="26" rx="13" fill="#0d0f13" opacity="0.8" />
      <circle cx="62" cy="39" r="4" fill={powered ? '#f0b90b' : '#3a3f48'} />
      {powered && <circle cx="62" cy="39" r="8" fill="#f0b90b" opacity="0.28" filter="url(#m-soft)" />}
      <text
        x="78"
        y="43"
        fill="rgba(255,255,255,0.4)"
        fontSize="10.5"
        letterSpacing="3.2"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>

      {/* glass chamber recess */}
      <rect x="40" y="58" width="320" height="206" rx="28" fill="url(#m-glass)" />
      <rect x="40" y="58" width="320" height="206" rx="28" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <rect x="47" y="65" width="306" height="192" rx="23" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

      {/* etched plus-grid on the chassis shoulders */}
      {[[30, 300], [30, 330], [30, 360], [370, 300], [370, 330], [370, 360]].map(([x, y]) => (
        <g key={`${x}-${y}`} opacity="0.2">
          <path d={`M${x - 4} ${y}h8M${x} ${y - 4}v8`} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
        </g>
      ))}

      {/* mid deck */}
      <rect x="40" y="272" width="320" height="78" rx="18" fill="url(#m-deck)" />
      <rect x="40" y="272" width="320" height="78" rx="18" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
      <rect x="54" y="286" width="86" height="7" rx="3.5" fill="rgba(255,255,255,0.07)" />
      <rect x="54" y="300" width="54" height="7" rx="3.5" fill="rgba(255,255,255,0.05)" />

      {/* light strip across the deck */}
      <rect
        x="54"
        y="332"
        width="292"
        height="3"
        rx="1.5"
        fill={active ? '#f0b90b' : powered ? 'rgba(240,185,11,0.55)' : 'rgba(255,255,255,0.09)'}
      />
      {active && <rect x="54" y="330" width="292" height="7" rx="3.5" fill="#f0b90b" opacity="0.4" filter="url(#m-soft)" />}

      {/* dispense chute */}
      <rect x="112" y="360" width="176" height="86" rx="20" fill="url(#m-chute)" />
      <rect x="112" y="360" width="176" height="86" rx="20" stroke="rgba(255,255,255,0.1)" strokeWidth="1.4" />
      {/* throat shadow where the capsule drops in */}
      <rect x="124" y="360" width="152" height="16" rx="8" fill="#000" opacity="0.8" />
      <ellipse cx="200" cy="430" rx="62" ry="9" fill="#000" opacity="0.5" />
      <text
        x="200"
        y="408"
        textAnchor="middle"
        fill="rgba(255,255,255,0.13)"
        fontSize="8.5"
        letterSpacing="4"
        fontFamily="ui-monospace, monospace"
      >
        TRAY
      </text>
      {/* tray floor light — off at rest, sweeping while settling, lit on result */}
      <rect
        x="132"
        y="424"
        width="136"
        height="3"
        rx="1.5"
        fill={settled ? '#f0b90b' : active ? 'rgba(240,185,11,0.55)' : 'rgba(255,255,255,0.07)'}
      />
      {(active || settled) && (
        <rect x="132" y="421" width="136" height="9" rx="4.5" fill="#f0b90b" opacity={settled ? 0.5 : 0.28} filter="url(#m-soft)" />
      )}

      {/* tray lip */}
      <path
        d="M118 432h164c-4 9-13 14-24 14H142c-11 0-20-5-24-14Z"
        fill="#1c1f26"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1.2"
      />

      {/* side vents */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="52" y={378 + i * 14} width="44" height="4" rx="2" fill="rgba(255,255,255,0.055)" />
          <rect x="304" y={378 + i * 14} width="44" height="4" rx="2" fill="rgba(255,255,255,0.055)" />
        </g>
      ))}

      {/* engraved Bacha badge */}
      <g opacity="0.22" transform="translate(186 468) scale(0.9)">
        <rect x="0" y="0" width="28" height="12" rx="6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
        <path d="M8 3h5.2c1.9 0 3.1 1.1 3.1 2.7 0 1.2-.6 2-1.6 2.4 1.3.3 2 1.2 2 2.6 0 1.7-1.3 2.9-3.3 2.9H8V3Z" fill="rgba(255,255,255,0.5)" transform="translate(0 -1.5) scale(0.62)" />
      </g>

      {/* plinth */}
      <rect x="44" y="456" width="312" height="26" rx="13" fill="#0a0c0f" />
      <rect x="44" y="456" width="312" height="26" rx="13" stroke="rgba(255,255,255,0.07)" strokeWidth="1.2" />
      <rect x="150" y="466" width="100" height="6" rx="3" fill="rgba(255,255,255,0.05)" />
    </svg>
  )
}

/* ------------------------------------------------------------------ layout */

interface Floater {
  token: MachineToken
  x: number
  y: number
  size: number
  depth: number
  tilt: number
  drift: number
  delay: number
  finish: CapsuleFinish
}

/**
 * Deterministic scatter. A fixed layout beats random placement here — it keeps
 * capsules off each other, reads as a packed chamber, and does not reshuffle
 * on every render.
 */
const SLOTS: [number, number, number][] = [
  [8, 8, 0.95], [46, 3, 0.8], [74, 14, 1], [24, 30, 0.7],
  [58, 33, 0.9], [4, 52, 0.62], [40, 58, 0.78], [76, 50, 0.68],
  [20, 74, 0.55], [56, 78, 0.6], [82, 74, 0.5],
]

const FINISH_CYCLE: CapsuleFinish[] = ['graphite', 'bnb', 'acrylic', 'graphite', 'graphite', 'acrylic', 'bnb', 'graphite']

function buildFloaters(tokens: MachineToken[], count: number): Floater[] {
  if (tokens.length === 0) return []
  return SLOTS.slice(0, count).map(([x, y, depth], i) => ({
    token: tokens[i % tokens.length],
    x,
    y,
    depth,
    size: 26 + depth * 30,
    tilt: ((i * 47) % 40) - 20,
    drift: ((i % 3) + 1) * 3,
    delay: (i % 5) * 0.42,
    finish: FINISH_CYCLE[i % FINISH_CYCLE.length],
  }))
}
