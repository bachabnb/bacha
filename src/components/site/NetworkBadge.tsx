'use client'

import { useAccount, useChainId } from 'wagmi'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { BnbChainMark } from '@/components/brand/BnbChain'
import { networkLabel } from '@/lib/chain'
import { publicEnv } from '@/lib/env'

/** Shows which chain the wallet is actually on, not which one we'd prefer. */
export function NetworkBadge({ className }: { className?: string }) {
  const t = useTranslations('wallet')
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const onExpectedChain = !isConnected || chainId === publicEnv.chainId

  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-[9px] border px-2.5 text-[0.76rem] font-medium',
        onExpectedChain
          ? 'border-border bg-surface text-foreground-secondary'
          : 'border-warning/40 bg-warning-soft text-warning',
        className,
      )}
    >
      {onExpectedChain ? (
        <BnbChainMark className="h-[15px] w-[13px]" />
      ) : (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
      )}
      {onExpectedChain ? networkLabel : t('wrongNetwork')}
    </span>
  )
}
