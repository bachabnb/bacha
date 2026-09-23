'use client'

import { useAccount, useChainId } from 'wagmi'
import { useTranslations } from 'next-intl'
import { BnbChainMark } from '@/components/brand/BnbChain'
import { networkLabel } from '@/lib/chain'
import { publicEnv, contractsConfigured } from '@/lib/env'
import { cn } from '@/lib/cn'

/**
 * Network chip.
 *
 * States what chain the wallet is actually on, and shows the live indicator
 * only when there is something live to indicate — with no contracts deployed
 * there is nothing running, so the dot stays off rather than lying.
 */
export function NetworkChip({ className, showLive = true }: { className?: string; showLive?: boolean }) {
  const t = useTranslations('wallet')
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const correct = !isConnected || chainId === publicEnv.chainId

  return (
    <span
      className={cn(
        'inline-flex h-[38px] items-center gap-2 rounded-[11px] border px-3 text-[0.8rem] font-medium',
        correct
          ? 'border-border bg-surface text-foreground-secondary'
          : 'border-warning/40 bg-warning-soft text-warning',
        className,
      )}
    >
      {correct ? (
        <BnbChainMark className="h-[16px] w-[14px]" />
      ) : (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
      )}
      <span className="whitespace-nowrap">{correct ? networkLabel : t('wrongNetwork')}</span>
      {correct && showLive && contractsConfigured && <span className="live-dot ml-0.5" />}
    </span>
  )
}
