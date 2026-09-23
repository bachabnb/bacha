'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { publicEnv, spinMode, contractsConfigured } from '@/lib/env'
import { isTestnet } from '@/lib/chain'

/**
 * Says out loud what the visitor is looking at.
 *
 * Shown in development, or whenever the machine is running on simulated
 * settlement or a testnet — nobody should have to guess whether a spin was a
 * real mainnet transaction.
 */
export function EnvironmentRibbon() {
  const t = useTranslations('environment')
  const c = useTranslations('common')
  const [dismissed, setDismissed] = useState(false)

  const show = publicEnv.showDevRibbon || spinMode === 'demo' || isTestnet
  if (!show || dismissed) return null

  const kind = !contractsConfigured ? 'demo' : isTestnet ? 'testnet' : 'dev'

  return (
    <div className="relative z-40 border-b border-brand-line bg-brand-soft">
      <div className="shell-wide flex items-center justify-between gap-4 py-2">
        <p className="flex items-center gap-2.5 text-[0.74rem] text-foreground">
          <span className="tag shrink-0">{c(kind)}</span>
          <span className="leading-snug">{t(kind)}</span>
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded px-1.5 py-1 text-[0.7rem] text-foreground-secondary transition-colors hover:text-foreground"
        >
          {t('hide')}
        </button>
      </div>
    </div>
  )
}
