'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'

const SECTIONS = ['verify', 'how', 'contracts', 'odds', 'math'] as const

/**
 * In-page navigation with scroll-spy.
 *
 * Deliberately a thin rail rather than a second navbar — it sits under the
 * floating header and only exists because this page is long by necessity.
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
      // The band sits below the floating header, so "current" means the
      // section actually under the reader's eye, not one behind the chrome.
      { rootMargin: '-140px 0px -60% 0px', threshold: 0 },
    )

    for (const id of SECTIONS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      aria-label="On this page"
      className="sticky top-[86px] z-30 -mx-4 hidden border-y border-border bg-background/85 px-4 backdrop-blur-xl md:block"
    >
      <ul className="shell-wide flex gap-1 py-2">
        {SECTIONS.map((id) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={cn(
                'inline-block rounded-[8px] px-3 py-1.5 text-[0.8rem] font-medium transition-colors',
                active === id
                  ? 'bg-brand-soft text-brand'
                  : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {t(id)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
