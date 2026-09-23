'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { contractsConfigured } from '@/lib/env'

const KEY = 'bacha:announce-dismissed'

/**
 * Only shown when there is something true to say.
 *
 * Before contracts are deployed there is no "live on BNB Chain" to announce,
 * so this renders nothing and the environment ribbon carries the message
 * instead — a placeholder announcement is worse than no bar at all.
 */
export function AnnouncementBar() {
  const t = useTranslations('announce')
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(KEY) === 'yes')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!contractsConfigured || dismissed) return null

  return (
    <div className="border-b border-border bg-surface">
      <div className="shell-wide flex items-center justify-center gap-3 py-2 text-[0.78rem]">
        <span className="live-dot" />
        <span className="text-foreground-secondary">{t('live')}</span>
        <Link
          href="/play"
          className="font-medium text-brand underline decoration-brand-line underline-offset-4 hover:decoration-brand"
        >
          {t('cta')}
        </Link>
        <button
          onClick={() => {
            try {
              window.localStorage.setItem(KEY, 'yes')
            } catch {
              /* ignore */
            }
            setDismissed(true)
          }}
          aria-label={t('dismiss')}
          className="ml-2 rounded p-1 text-foreground-muted transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
