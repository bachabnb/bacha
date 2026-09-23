'use client'

import * as Popover from '@radix-ui/react-popover'
import { useTranslations, useLocale } from 'next-intl'
import { useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePathname, useRouter, locales, localeMeta, type Locale } from '@/i18n/routing'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/cn'

/**
 * Language selector.
 *
 * Switching preserves the current route — next-intl's navigation helpers map
 * the pathname across locales, so a person reading /zh-CN/fairness lands on
 * /en/fairness rather than being dropped at the homepage.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const t = useTranslations('nav')
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const reduce = useReducedMotion()

  function choose(next: Locale) {
    setOpen(false)
    if (next === locale) return
    startTransition(() => {
      router.replace(
        // @ts-expect-error — dynamic params are passed straight through
        { pathname, params },
        { locale: next },
      )
    })
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t('languageSelect')}
          disabled={pending}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-surface px-2.5',
            'text-[0.78rem] font-medium text-foreground-secondary transition-colors',
            'hover:border-border-strong hover:bg-surface-hover hover:text-foreground',
            'disabled:opacity-50',
            className,
          )}
        >
          <GlobeIcon />
          <span>{localeMeta[locale].label}</span>
        </button>
      </Popover.Trigger>

      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild align="end" sideOffset={8} collisionPadding={16}>
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="z-50 w-[11.5rem] overflow-hidden rounded-[12px] border border-border bg-surface-raised p-1.5 shadow-[var(--shadow-lg)]"
              >
                <p className="px-2.5 pb-1.5 pt-1 text-[0.62rem] uppercase tracking-[0.16em] text-foreground-muted">
                  {t('language')}
                </p>
                {locales.map((option) => (
                  <button
                    key={option}
                    onClick={() => choose(option)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors',
                      option === locale
                        ? 'bg-brand-soft text-foreground'
                        : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    <span className="text-[0.86rem] font-medium">{localeMeta[option].label}</span>
                    <span className="text-[0.7rem] text-foreground-muted">{localeMeta[option].english}</span>
                  </button>
                ))}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M2 8h12M8 1.8c1.7 1.8 2.6 3.9 2.6 6.2S9.7 12.4 8 14.2C6.3 12.4 5.4 10.3 5.4 8S6.3 3.6 8 1.8Z" />
    </svg>
  )
}
