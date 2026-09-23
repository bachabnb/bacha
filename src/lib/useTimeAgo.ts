'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

/**
 * Relative time, translated and self-updating.
 *
 * The first render deliberately matches what the server produced, and the tick
 * starts afterwards — otherwise a feed rendered on the server and hydrated a
 * second later would report two different times and warn.
 */
export function useTimeAgo(timestampMs: number, tickMs = 15_000): string {
  const t = useTranslations('common')
  const [now, setNow] = useState(timestampMs)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [tickMs])

  const seconds = Math.max(0, Math.floor((now - timestampMs) / 1000))
  if (seconds < 5) return t('justNow')
  if (seconds < 60) return t('secondsAgo', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hoursAgo', { count: hours })
  return t('daysAgo', { count: Math.floor(hours / 24) })
}
