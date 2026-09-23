'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/cn'

type Mode = 'simple' | 'technical'

const ViewModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({
  mode: 'simple',
  setMode: () => {},
})

const KEY = 'bacha:fairness-view'

/**
 * Simple or technical.
 *
 * The default is simple so a normal visitor is not met with request ids and
 * event signatures, but nothing is hidden behind it — technical mode reveals
 * more detail on the same records, it does not reveal different records.
 */
export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('simple')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY)
      if (stored === 'technical') setModeState('technical')
    } catch {
      /* storage can be blocked */
    }
  }, [])

  const setMode = useCallback((next: Mode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])
  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
}

export function useViewMode() {
  return useContext(ViewModeContext)
}

export function ViewModeToggle({ className }: { className?: string }) {
  const t = useTranslations('fairness.view')
  const { mode, setMode } = useViewMode()
  const reduce = useReducedMotion()

  const options: Mode[] = ['simple', 'technical']

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className={cn('inline-flex rounded-[10px] border border-border bg-surface p-[3px]', className)}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          onClick={() => setMode(option)}
          className={cn(
            'relative min-h-[30px] rounded-[7px] px-3 text-[0.76rem] font-medium transition-colors',
            mode === option ? 'text-brand-foreground' : 'text-foreground-secondary hover:text-foreground',
          )}
        >
          {mode === option && (
            <motion.span
              layoutId="view-mode-pill"
              className="absolute inset-0 rounded-[7px] bg-brand"
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }}
            />
          )}
          <span className="relative">{t(option)}</span>
        </button>
      ))}
    </div>
  )
}
