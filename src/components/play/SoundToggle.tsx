'use client'

import { useTranslations } from 'next-intl'
import { useSound } from './SoundProvider'
import { cn } from '@/lib/cn'

export function SoundToggle({ className }: { className?: string }) {
  const t = useTranslations('play')
  const { enabled, toggle } = useSound()

  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? t('soundDisable') : t('soundEnable')}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-[9px] border border-border bg-surface px-2.5',
        'text-[0.76rem] transition-colors hover:border-border-strong hover:bg-surface-hover',
        enabled ? 'text-brand' : 'text-foreground-secondary',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 6h2.2L8.5 3.2v9.6L5.2 10H3V6Z" strokeLinejoin="round" />
        {enabled ? (
          <>
            <path d="M11 6.2a2.6 2.6 0 0 1 0 3.6" strokeLinecap="round" />
            <path d="M12.8 4.5a5 5 0 0 1 0 7" strokeLinecap="round" />
          </>
        ) : (
          <path d="M11 6l3.2 4M14.2 6L11 10" strokeLinecap="round" />
        )}
      </svg>
      {enabled ? t('soundOn') : t('soundOff')}
    </button>
  )
}
