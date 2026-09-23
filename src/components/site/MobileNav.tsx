'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, usePathname, useRouter, locales, localeMeta, type Locale } from '@/i18n/routing'
import { useParams } from 'next/navigation'
import { NavIcon } from './NavIcon'
import { buildNavigation } from './navigation'
import { ConnectButton } from './ConnectButton'
import { NetworkBadge } from './NetworkBadge'
import { useTheme } from '@/lib/theme/ThemeProvider'
import { machines } from '@/lib/machine'
import { cn } from '@/lib/cn'

/**
 * Mobile navigation.
 *
 * A full-height sheet with accordion sections rather than a squeezed mega
 * menu — the desktop panel's two-column showcase has no place at 375px.
 * Everything a person needs to change (theme, language, network, wallet)
 * collects at the bottom, within thumb reach.
 */
export function MobileNav() {
  const t = useTranslations('nav')
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>('play')
  const groups = buildNavigation(machines)
  const reduce = useReducedMotion()

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={t('openMenu')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface text-foreground-secondary transition-colors hover:text-foreground lg:hidden"
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
          </svg>
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: '2%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: '2%' }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col bg-background lg:hidden"
              >
                <Dialog.Title className="sr-only">{t('menu')}</Dialog.Title>

                <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-border px-5">
                  <span className="text-[0.68rem] uppercase tracking-[0.2em] text-foreground-muted">
                    {t('menu')}
                  </span>
                  <Dialog.Close
                    aria-label={t('close')}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-foreground-secondary"
                  >
                    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                    </svg>
                  </Dialog.Close>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                  {groups.map((group) => {
                    const isOpen = expanded === group.key
                    return (
                      <div key={group.key} className="border-b border-border last:border-0">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : group.key)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-4 px-1 py-4 text-left"
                        >
                          <span className="font-display text-[1.28rem] font-bold tracking-[-0.03em] text-foreground">
                            {t(group.key)}
                          </span>
                          <svg
                            viewBox="0 0 16 16"
                            className={cn(
                              'h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200',
                              isOpen && 'rotate-180',
                            )}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M4 6.5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.ul
                              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="pb-3">
                                {group.items.map((item) => {
                                  const base = `groups.${group.key}.${item.key}`
                                  const body = (
                                    <>
                                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-foreground-secondary">
                                        <NavIcon name={item.icon} className="h-5 w-5" />
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block text-[0.95rem] font-medium text-foreground">
                                          {t(`${base}.title`)}
                                        </span>
                                        <span className="mt-0.5 block text-[0.8rem] text-foreground-muted">
                                          {t(`${base}.description`, item.values ?? {})}
                                        </span>
                                      </span>
                                    </>
                                  )
                                  return (
                                    <li key={item.key}>
                                      {item.external ? (
                                        <a
                                          href={item.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={() => setOpen(false)}
                                          className="flex min-h-[3.5rem] items-center gap-3.5 rounded-[12px] px-1 py-2.5 active:bg-surface-hover"
                                        >
                                          {body}
                                        </a>
                                      ) : (
                                        <Link
                                          href={item.href}
                                          onClick={() => setOpen(false)}
                                          className="flex min-h-[3.5rem] items-center gap-3.5 rounded-[12px] px-1 py-2.5 active:bg-surface-hover"
                                        >
                                          {body}
                                        </Link>
                                      )}
                                    </li>
                                  )
                                })}
                              </div>
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>

                <div className="shrink-0 space-y-4 border-t border-border bg-surface px-5 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.74rem] uppercase tracking-[0.15em] text-foreground-muted">
                      {t('theme')}
                    </span>
                    <MobileThemeChoice />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.74rem] uppercase tracking-[0.15em] text-foreground-muted">
                      {t('language')}
                    </span>
                    <MobileLanguageChoice onPick={() => setOpen(false)} />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <NetworkBadge />
                  </div>

                  <ConnectButton className="w-full justify-center" />
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

function MobileThemeChoice() {
  const t = useTranslations('nav')
  const { preference, setPreference } = useTheme()
  const options = [
    { value: 'light' as const, label: t('themeLight') },
    { value: 'dark' as const, label: t('themeDark') },
    { value: 'system' as const, label: t('themeSystem') },
  ]

  return (
    <div className="flex rounded-[10px] border border-border bg-background p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setPreference(option.value)}
          aria-pressed={preference === option.value}
          className={cn(
            'min-h-[2.25rem] rounded-[7px] px-3 text-[0.78rem] font-medium transition-colors',
            preference === option.value
              ? 'bg-brand text-brand-foreground'
              : 'text-foreground-secondary',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function MobileLanguageChoice({ onPick }: { onPick: () => void }) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()

  return (
    <div className="flex rounded-[10px] border border-border bg-background p-1">
      {locales.map((option) => (
        <button
          key={option}
          onClick={() => {
            onPick()
            if (option !== locale) {
              // @ts-expect-error — dynamic params pass straight through
              router.replace({ pathname, params }, { locale: option })
            }
          }}
          aria-pressed={option === locale}
          className={cn(
            'min-h-[2.25rem] rounded-[7px] px-3.5 text-[0.82rem] font-medium transition-colors',
            option === locale ? 'bg-brand text-brand-foreground' : 'text-foreground-secondary',
          )}
        >
          {localeMeta[option].label}
        </button>
      ))}
    </div>
  )
}
