'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ViewModeToggle } from './ViewMode'
import { cn } from '@/lib/cn'

const SECTIONS = ['verify', 'how', 'contracts', 'odds', 'math'] as const

/**
 * In-page navigation with scroll-spy.
 *
 * Built as a floating rail rather than a full-bleed bar. The header above it
 * is an inset floating panel, so an edge-to-edge strip welded to its underside
 * read as two stacked navbars. This sits in the same gutter, wears the same
 * shell, and keeps an honest gap below the header.
 *
 * The detail-level toggle lives here too. It used to sit in its own row above
 * the verifier, where this rail passed over and clipped it on scroll.
 */
export function FairnessNav() {
  const t = useTranslations('fairness.nav')
  const [active, setActive] = useState<string>('verify')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      // Offset past the header and this rail, so "current" means the section
      // under the reader's eye rather than one hidden behind chrome.
      { rootMargin: '-172px 0px -58% 0px', threshold: 0 },
    )

    for (const id of SECTIONS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="pointer-events-none sticky top-[92px] z-30 hidden px-4 py-3 sm:px-6 md:block lg:px-8">
      <div className="mx-auto flex w-full max-w-[1450px] items-center justify-between gap-4">
        <nav
          aria-label="On this page"
          className="header-shell header-shell-raised pointer-events-auto flex items-center gap-0.5 rounded-[15px] border p-[5px] backdrop-blur-xl"
        >
          {SECTIONS.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? 'page' : undefined}
              className={cn(
                'rounded-[10px] px-3.5 py-[0.45rem] text-[0.82rem] font-medium transition-colors',
                active === id
                  ? 'bg-brand-soft text-brand'
                  : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {t(id)}
            </a>
          ))}
        </nav>

        <ViewModeToggle className="header-shell header-shell-raised pointer-events-auto hidden rounded-[15px] p-[5px] backdrop-blur-xl lg:inline-flex" />
      </div>
    </div>
  )
}
