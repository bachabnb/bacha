'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeApi {
  /** What the person chose. */
  preference: ThemePreference
  /** What is actually on screen right now. */
  theme: ResolvedTheme
  setPreference: (next: ThemePreference) => void
  /** Flips between light and dark, leaving `system` behind. */
  toggle: () => void
}

const ThemeContext = createContext<ThemeApi>({
  preference: 'dark',
  theme: 'dark',
  setPreference: () => {},
  toggle: () => {},
})

export const THEME_STORAGE_KEY = 'bacha:theme'

/**
 * Theme state.
 *
 * The actual `data-theme` attribute is written by the blocking script in
 * `ThemeScript` before first paint, so there is never a flash and nothing
 * theme-dependent is rendered differently on server and client. This provider
 * only reads back what that script decided and handles changes afterwards.
 */
/** Light is the primary theme; dark is an opt-in. */
const DEFAULT_PREFERENCE: ThemePreference = 'light'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_PREFERENCE)
  const [theme, setTheme] = useState<ResolvedTheme>('light')

  // Adopt whatever the pre-paint script applied. Also *re-applies* it: if that
  // script was ever stripped or blocked, this is what keeps the attribute and
  // the stored preference from disagreeing.
  useEffect(() => {
    const stored = readStoredPreference()
    const resolved = resolve(stored)
    setPreferenceState(stored)
    setTheme(resolved)
    if (document.documentElement.getAttribute('data-theme') !== resolved) {
      applyTheme(resolved)
    }
  }, [])

  // Follow the OS while the preference is `system`.
  useEffect(() => {
    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next: ResolvedTheme = media.matches ? 'dark' : 'light'
      setTheme(next)
      applyTheme(next)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      // `system` is stored explicitly rather than cleared: an absent value now
      // means "never chose", which resolves to light, not to the OS setting.
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage can be blocked; the choice still applies for this session.
    }
    const resolved = resolve(next)
    setTheme(resolved)
    applyTheme(resolved)
  }, [])

  const toggle = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setPreference])

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
    return DEFAULT_PREFERENCE
  } catch {
    return DEFAULT_PREFERENCE
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Writes the attribute, briefly disabling the colour transition so the switch
 * lands at once instead of every element smearing at its own rate.
 */
function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.setAttribute('data-theme-switching', '')
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  window.setTimeout(() => root.removeAttribute('data-theme-switching'), 60)
}
