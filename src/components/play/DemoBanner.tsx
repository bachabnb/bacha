'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { contractsConfigured } from '@/lib/env'
import { isTestnet } from '@/lib/chain'

/**
 * A status strip, not an error.
 *
 * It has to be impossible to miss — somebody about to spend money should know
 * whether this is real — but it reads as an instrument label rather than a
 * warning, because nothing is wrong.
 */
export function DemoBanner() {
  const t = useTranslations('play.demoBanner')
  if (contractsConfigured && !isTestnet) return null

  return (
    <div className="flex min-h-[38px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[11px] border border-brand-line bg-brand-soft px-3.5 py-2">
      <span className="tag shrink-0">{t('label')}</span>
      <span className="text-[0.8rem] text-foreground-secondary">{t('body')}</span>
      <Link
        href="/fairness"
        className="ml-auto shrink-0 text-[0.8rem] font-medium text-brand underline decoration-brand-line underline-offset-4 hover:decoration-brand"
      >
        {t('learnMore')}
      </Link>
    </div>
  )
}
