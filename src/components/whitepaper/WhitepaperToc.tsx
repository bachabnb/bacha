'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'

export interface TocEntry {
  id: string
  index: string
  title: string
}

/**
 * Contents rail with scroll-spy.
 *
 * Twenty-two chapters is more than fits a viewport, so the rail scrolls
 * independently and keeps the active entry in view as the reader moves. On
 * narrow screens the same data becomes a collapsible panel above the text
 * rather than a second column that would halve the measure.
 */
export function WhitepaperToc({ entries }: { entries: TocEntry[] }) {
  const t = useTranslations('whitepaper')
  const [active, setActive] = useState(entries[0]?.id ?? '')
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)

  // Scroll-spy by reading line rather than IntersectionObserver.
  //
  // Chapters abut exactly, so when one ends where the next begins both are
  // "intersecting" any observer band and the choice between them comes down
  // to tie-breaking. Asking which chapter the reading line is inside has one
  // answer and no edge case.
  //
  // Offsets are measured once and re-measured only when the document resizes,
  // so the scroll handler is arithmetic with no layout reads. It also runs
  // synchronously rather than inside requestAnimationFrame, which a browser
  // is free to throttle when the tab is not painting.
  useEffect(() => {
    const READING_LINE = 140
    let offsets: { id: string; top: number }[] = []

    const remeasure = () => {
      offsets = entries
        .map((entry) => {
          const el = document.getElementById(entry.id)
          return el ? { id: entry.id, top: el.getBoundingClientRect().top + window.scrollY } : null
        })
        .filter((v): v is { id: string; top: number } => v !== null)
      update()
    }

    const update = () => {
      const line = window.scrollY + READING_LINE
      let current = offsets[0]?.id ?? ''
      for (const offset of offsets) {
        if (offset.top <= line) current = offset.id
      }
      // The final chapter can be shorter than the gap between the reading
      // line and the bottom of the page, so it would never light up.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = offsets[offsets.length - 1]?.id ?? current
      }
      setActive(current)
    }

    remeasure()
    window.addEventListener('scroll', update, { passive: true })

    // Art and fonts land after first paint and move every offset below them.
    const observer = new ResizeObserver(remeasure)
    observer.observe(document.documentElement)

    return () => {
      window.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [entries])

  // Keep the active entry visible inside the rail's own scroll area.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const current = list.querySelector<HTMLElement>(`[data-id="${active}"]`)
    if (!current) return
    const { offsetTop, offsetHeight } = current
    const top = offsetTop - list.clientHeight / 2 + offsetHeight / 2
    list.scrollTo({ top, behavior: 'smooth' })
  }, [active])

  const current = entries.find((e) => e.id === active)

  return (
    <>
      {/* ------------------------------------------------- mobile disclosure */}
      <div className="lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-border bg-surface px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[0.6rem] uppercase tracking-[0.18em] text-foreground-muted">
              {t('contents')}
            </span>
            <span className="mt-0.5 block truncate text-[0.86rem] font-medium text-foreground">
              {current ? `${current.index} · ${current.title}` : t('contents')}
            </span>
          </span>
          <span
            aria-hidden
            className={cn('shrink-0 text-foreground-muted transition-transform', open && 'rotate-180')}
          >
            ▾
          </span>
        </button>

        {open && (
          <ol className="mt-2 max-h-[60vh] overflow-y-auto rounded-[12px] border border-border bg-surface p-1.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex gap-3 rounded-[9px] px-3 py-2 text-[0.84rem] transition-colors',
                    entry.id === active
                      ? 'bg-brand-soft text-brand'
                      : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
                  )}
                >
                  <span className="num shrink-0 text-[0.72rem] opacity-70">{entry.index}</span>
                  <span>{entry.title}</span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ----------------------------------------------------- desktop rail */}
      <nav
        aria-label={t('contents')}
        className="hidden lg:sticky lg:top-[7rem] lg:block lg:self-start print:hidden"
      >
        <p className="px-3 text-[0.6rem] uppercase tracking-[0.18em] text-foreground-muted">
          {t('contents')}
        </p>
        <ol
          ref={listRef}
          className="mt-3 max-h-[calc(100svh-12rem)] overflow-y-auto pr-1 [scrollbar-width:thin]"
        >
          {entries.map((entry) => (
            <li key={entry.id} data-id={entry.id}>
              <a
                href={`#${entry.id}`}
                aria-current={entry.id === active ? 'true' : undefined}
                className={cn(
                  'flex gap-2.5 rounded-[9px] px-3 py-[0.42rem] text-[0.8rem] leading-snug transition-colors',
                  entry.id === active
                    ? 'bg-brand-soft font-medium text-brand'
                    : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
                )}
              >
                <span className="num shrink-0 text-[0.68rem] opacity-60">{entry.index}</span>
                <span>{entry.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
