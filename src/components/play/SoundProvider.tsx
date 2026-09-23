'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type Cue = 'arm' | 'spin' | 'drop' | 'reveal' | 'epic' | 'click'

interface SoundApi {
  enabled: boolean
  toggle: () => void
  play: (cue: Cue) => void
}

const SoundContext = createContext<SoundApi>({ enabled: false, toggle: () => {}, play: () => {} })

const STORAGE_KEY = 'bacha:sound'

/**
 * Sound is off until someone asks for it, and the preference sticks.
 *
 * Cues are synthesised with the Web Audio API rather than shipped as files —
 * a handful of short machine noises, no download, and nothing to license.
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'on')
    } catch {
      // Storage can be blocked; silence is a fine default.
    }
  }, [])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const play = useCallback(
    (cue: Cue) => {
      if (!enabled) return
      try {
        if (!ctxRef.current) {
          const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          ctxRef.current = new Ctor()
        }
        const ctx = ctxRef.current
        if (!ctx) return
        if (ctx.state === 'suspended') void ctx.resume()
        renderCue(ctx, cue)
      } catch {
        /* audio is a nicety, never a failure path */
      }
    },
    [enabled],
  )

  const value = useMemo(() => ({ enabled, toggle, play }), [enabled, toggle, play])
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound() {
  return useContext(SoundContext)
}

function renderCue(ctx: AudioContext, cue: Cue) {
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.connect(ctx.destination)

  const tone = (freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now + start)
    env.gain.setValueAtTime(0.0001, now + start)
    env.gain.exponentialRampToValueAtTime(gain, now + start + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
    osc.connect(env).connect(master)
    osc.start(now + start)
    osc.stop(now + start + dur + 0.05)
  }

  switch (cue) {
    case 'click':
      tone(880, 0, 0.05, 0.05, 'square')
      break
    case 'arm':
      tone(220, 0, 0.16, 0.07, 'triangle')
      tone(330, 0.06, 0.16, 0.05, 'triangle')
      break
    case 'spin':
      tone(140, 0, 0.5, 0.04, 'sawtooth')
      tone(210, 0.05, 0.45, 0.03, 'sawtooth')
      break
    case 'drop':
      tone(520, 0, 0.07, 0.09, 'square')
      tone(300, 0.08, 0.14, 0.07, 'triangle')
      break
    case 'reveal':
      tone(523.25, 0, 0.22, 0.07)
      tone(659.25, 0.09, 0.24, 0.06)
      break
    case 'epic':
      tone(523.25, 0, 0.3, 0.08)
      tone(659.25, 0.1, 0.3, 0.075)
      tone(783.99, 0.2, 0.36, 0.07)
      tone(1046.5, 0.32, 0.5, 0.065)
      break
  }
}
