'use client'

import { useTranslations } from 'next-intl'
import { useTimeAgo } from '@/lib/useTimeAgo'
import { networkLabel } from '@/lib/chain'
import { contractsConfigured } from '@/lib/env'
import type { Machine } from '@/lib/machine'
import type { SpinRecord } from '@/lib/spin/types'
import { cn } from '@/lib/cn'

/**
 * A quiet instrument row beneath the stage.
 *
 * Real values only — pool health reads Demo when nothing is deployed rather
 * than claiming Healthy, and "last drop" shows nothing at all until a spin has
 * actually settled.
 */
export function MachineStatusRow({
  machine,
  rewardCount,
  latest,
  className,
}: {
  machine: Machine
  rewardCount: number
  latest: SpinRecord | null
  className?: string
}) {
  const t = useTranslations('play.status')
  const s = useTranslations('play.stage')

  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-5',
        className,
      )}
    >
      <Cell label={t('machine')}>
        <span className="flex items-center gap-2">
          {contractsConfigured ? <span className="live-dot" /> : null}
          <span className="num">{machine.label}</span>
          <span
            className={cn(
              'rounded-[4px] border px-1 py-px font-mono text-[0.54rem] uppercase tracking-[0.12em]',
              contractsConfigured
                ? 'border-success/35 bg-success-soft text-success'
                : 'border-border-strong text-foreground-muted',
            )}
          >
            {contractsConfigured ? s('live') : s('demo')}
          </span>
        </span>
      </Cell>
      <Cell label={t('pool')}>
        <span className={contractsConfigured ? 'text-success' : 'text-foreground-secondary'}>
          {contractsConfigured ? t('healthy') : t('demo')}
        </span>
      </Cell>
      <Cell label={t('rewards')}>
        <span className="num">{rewardCount}</span>
      </Cell>
      <Cell label={t('lastDrop')}>
        {latest ? <LastDrop timestamp={latest.settledAt ?? latest.requestedAt} /> : <span>{t('none')}</span>}
      </Cell>
      <Cell label={t('network')} className="col-span-2 sm:col-span-1">
        <span className="num truncate">{networkLabel}</span>
      </Cell>
    </dl>
  )
}

function LastDrop({ timestamp }: { timestamp: number }) {
  return <span className="num">{useTimeAgo(timestamp)}</span>
}

function Cell({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-surface px-4 py-3', className)}>
      <dt className="text-[0.58rem] uppercase tracking-[0.16em] text-foreground-muted">{label}</dt>
      <dd className="mt-1.5 truncate text-[0.82rem] font-medium text-foreground">{children}</dd>
    </div>
  )
}
