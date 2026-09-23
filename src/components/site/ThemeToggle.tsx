'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { useTheme, type ThemePreference } from '@/lib/theme/ThemeProvider'
import { cn } from '@/lib/cn'

/**
 * A segmented control rather than a switch.
 *
 * Three states are what the system actually has — light, system, dark — and
 * showing them makes `system` discoverable instead of hidden behind a toggle
 * that silently abandons it on first click.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('nav')
  const { preference, setPreference } = useTheme()
  const reduce = useReducedMotion()

  const options: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: t('themeLight'), icon: <SunIcon /> },
    { value: 'system', label: t('themeSystem'), icon: <SystemIcon /> },
    { value: 'dark', label: t('themeDark'), icon: <MoonIcon /> },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t('theme')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[11px] border border-border bg-surface p-[3px]',
        className,
      )}
    >
      {options.map((option) => {
        const active = preference === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setPreference(option.value)}
            className={cn(
              'relative inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] transition-colors',
              active ? 'text-brand-foreground' : 'text-foreground-muted hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-[8px] bg-brand"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }}
              />
            )}
            <span className="relative flex">{option.icon}</span>
          </button>
        )
      })}
    </div>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="9" r="3.2" />
      <path
        d="M9 1.8v1.5M9 14.7v1.5M16.2 9h-1.5M3.3 9H1.8M14.1 3.9l-1.1 1.1M5 13l-1.1 1.1M14.1 14.1L13 13M5 5 3.9 3.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M15.2 10.6A6.6 6.6 0 0 1 7.4 2.8a6.6 6.6 0 1 0 7.8 7.8Z" strokeLinejoin="round" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.2" y="3.4" width="13.6" height="9.4" rx="1.8" />
      <path d="M6.6 15.4h4.8" strokeLinecap="round" />
      <path d="M9 3.4v9.4" />
      <path d="M2.2 8.1h6.8" opacity="0.45" />
    </svg>
  )
}
