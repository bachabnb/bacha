'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { NavIcon } from './NavIcon'
import { buildNavigation, type NavGroup } from './navigation'
import { machines, rosterTokens } from '@/lib/machine'
import { art } from '@/lib/art'
import { cn } from '@/lib/cn'

/**
 * Desktop navigation.
 *
 * Hover opens a shared floating panel that morphs between groups rather than
 * mounting a new one per item, which is what stops the flicker when the
 * pointer travels along the nav. Closing is delayed slightly so moving
 * diagonally from a trigger down into the panel does not dismiss it.
 */
export function MegaMenu({ className }: { className?: string }) {
  const t = useTranslations('nav')
  const groups = buildNavigation(machines)
  const [active, setActive] = useState<NavGroup['key'] | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const open = useCallback((key: NavGroup['key']) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setActive(key)
  }, [])

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setActive(null), 140)
  }, [])

  const closeNow = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setActive(null)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeNow()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeNow])

  // Any focus leaving the nav closes the panel, so keyboard use never strands it open.
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (!containerRef.current?.contains(e.target as Node)) closeNow()
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [closeNow])

  const activeGroup = groups.find((g) => g.key === active) ?? null

  return (
    // The panel is anchored to this container's lower edge, so the container
    // is stretched to the header's full height by the caller. Sized to the
    // buttons instead, the panel opened partway up inside the header shell.
    <div
      ref={containerRef}
      className={cn('relative flex items-center', className)}
      onMouseLeave={scheduleClose}
    >
      <nav aria-label="Main" className="flex items-center gap-0.5">
        {groups.map((group) => {
          const isOpen = active === group.key
          return (
            <button
              key={group.key}
              type="button"
              aria-expanded={isOpen}
              aria-haspopup="true"
              onMouseEnter={() => open(group.key)}
              onFocus={() => open(group.key)}
              onClick={() => (isOpen ? closeNow() : open(group.key))}
              className={cn(
                'relative rounded-[9px] px-3.5 py-2 text-[0.86rem] font-medium transition-colors',
                isOpen
                  ? 'bg-surface-hover text-foreground'
                  : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {t(group.key)}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-3.5 bottom-1 h-px origin-left bg-brand transition-transform duration-200 ease-[var(--ease-physical)]',
                  isOpen ? 'scale-x-100' : 'scale-x-0',
                )}
              />
            </button>
          )
        })}
      </nav>

      <AnimatePresence>
        {activeGroup && (
          <motion.div
            key="panel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => open(activeGroup.key)}
            className="absolute left-0 top-full z-50 pt-2.5"
          >
            <div
              className={cn(
                'overflow-hidden rounded-[16px] border border-border bg-surface-raised shadow-[var(--shadow-lg)]',
                activeGroup.showcase ? 'w-[40rem]' : 'w-[22rem]',
              )}
            >
              <div className={cn('grid', activeGroup.showcase && 'grid-cols-[1.75fr_1fr]')}>
                <ul className="p-2.5">
                  {activeGroup.items.map((item) => {
                    const base = `groups.${activeGroup.key}.${item.key}`
                    const content = (
                      <>
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-surface text-foreground-secondary transition-colors group-hover:border-brand-line group-hover:text-brand">
                          <NavIcon name={item.icon} className="h-[17px] w-[17px]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[0.87rem] font-medium text-foreground">
                            {t(`${base}.title`)}
                          </span>
                          <span className="mt-0.5 block text-[0.76rem] leading-snug text-foreground-muted">
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
                            onClick={closeNow}
                            className="group flex gap-3 rounded-[10px] p-2.5 transition-colors hover:bg-surface-hover"
                          >
                            {content}
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={closeNow}
                            className="group flex gap-3 rounded-[10px] p-2.5 transition-colors hover:bg-surface-hover"
                          >
                            {content}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {activeGroup.showcase && <MachineShowcase />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The right-hand panel: what the machine actually holds right now. */
function MachineShowcase() {
  const t = useTranslations('nav.status')
  const assets = rosterTokens().length

  return (
    <div className="relative flex flex-col justify-between border-l border-border bg-surface p-5">
      <div className="relative mx-auto aspect-square w-full max-w-[9rem]">
        <Image
          src={art('machine-menu')}
          alt=""
          fill
          sizes="160px"
          className="object-contain"
          aria-hidden
        />
      </div>

      <div>
        <span className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-[0.66rem] font-medium uppercase tracking-[0.16em] text-foreground-secondary">
            {t('label')}
          </span>
        </span>
        <ul className="mt-3 space-y-1 text-[0.74rem] text-foreground-muted">
          <li className="num">{t('assets', { count: assets })}</li>
          <li className="num">{t('tiers', { count: machines.length })}</li>
          <li className="num">{t('network')}</li>
        </ul>
      </div>
    </div>
  )
}
