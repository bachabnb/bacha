'use client'

import { useAccount, useBalance, useChainId } from 'wagmi'
import { useTranslations } from 'next-intl'
import { TierSelector } from './TierSelector'
import { ProbabilityRail } from './ProbabilityRail'
import { TokenMark } from '@/components/ui/TokenMark'
import { ConnectButton, SwitchNetworkButton } from '@/components/site/ConnectButton'
import { rarityBreakdown, type Machine } from '@/lib/machine'
import { rarityStyle, type Rarity } from '@/lib/rarity'
import { tokenByAddress } from '@/lib/tokens'
import { publicEnv, spinMode, contractsConfigured } from '@/lib/env'
import { networkLabel } from '@/lib/chain'
import { formatBnb, shortHash, formatTokenAmount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { SpinPhase } from '@/lib/spin/useSpin'

interface ControlConsoleProps {
  machine: Machine
  onSelectMachine: (id: string) => void
  phase: SpinPhase
  txHash: string | null
  error: string | null
  onSpin: () => void
  onReset: () => void
}

/**
 * The console beside the machine.
 *
 * One decision (which machine), one action (spin), and a readout of everything
 * that decision implies — price, odds, what can come out, and how the result
 * will be produced. Everything shown is read from the machine's actual prize
 * table.
 */
export function ControlConsole({
  machine,
  onSelectMachine,
  phase,
  txHash,
  error,
  onSpin,
  onReset,
}: ControlConsoleProps) {
  const t = useTranslations('play.console')
  const s = useTranslations('play.states')
  const w = useTranslations('wallet')
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: balance } = useBalance({ address, chainId: publicEnv.chainId })

  const wrongNetwork = isConnected && chainId !== publicEnv.chainId
  const insufficient = Boolean(balance && balance.value < machine.priceWei)
  const busy = phase === 'confirming' || phase === 'submitted' || phase === 'settling'

  const drops = dedupeTokens(machine)

  return (
    <div className="card-physical play-console flex flex-col">
      <TierSelector active={machine.id} onSelect={onSelectMachine} disabled={busy} />

      {/* ------------------------------------------------------- price */}
      <div>
        <div className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
          {t('title')}
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-[2.3rem] font-extrabold leading-[0.88] tracking-[-0.055em] text-foreground">
            ${machine.referencePriceUsd.toFixed(0)}
          </span>
          <span className="num text-[0.9rem] text-foreground-secondary">
            ≈ {machine.priceBnb} BNB
          </span>
        </div>
        <p className="mt-1.5 text-[0.72rem] leading-snug text-foreground-muted">
          {t('payNote', { amount: machine.priceBnb })}
        </p>
      </div>

      {/* -------------------------------------------------------- facts */}
      <dl className="grid grid-cols-4 gap-x-3 border-t border-border pt-3.5">
        <Fact label={t('rewards')} value={String(drops.length)} />
        <Fact label={t('network')} value={networkLabel.replace('BNB Chain', 'BNB')} />
        <Fact
          label={t('fairness')}
          value={contractsConfigured ? t('vrf') : t('simulated')}
          tone={contractsConfigured ? 'brand' : 'muted'}
        />
        <Fact
          label={t('treasury')}
          value={
            contractsConfigured ? t('healthy') : spinMode === 'demo' ? t('demoTreasury') : t('notDeployed')
          }
          tone={contractsConfigured ? 'brand' : 'muted'}
        />
      </dl>

      {/* --------------------------------------------------- distribution */}
      <div className="border-t border-border pt-3.5">
        <div className="mb-2.5 text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
          {t('distribution')}
        </div>
        <ProbabilityRail segments={rarityBreakdown(machine)} />
      </div>

      {/* -------------------------------------------------- possible drops */}
      <div className="border-t border-border pt-3.5">
        <div className="mb-2 text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
          {t('possibleDrops')}
        </div>
        {/* A dense chip grid: nine assets in three rows rather than nine rows. */}
        <ul className="grid grid-cols-3 gap-1">
          {drops.map((drop) => (
            <li key={drop.token.id}>
              <span
                className="flex h-[28px] items-center gap-1.5 rounded-[8px] border border-border bg-background pl-0.5 pr-1.5"
                title={`${drop.token.name} · ${formatTokenAmount(drop.minAmount)}–${formatTokenAmount(drop.maxAmount)}`}
              >
                <TokenMark token={drop.token} size={19} ring={false} />
                <span className="num truncate text-[0.68rem] text-foreground-secondary">
                  {drop.token.symbol}
                </span>
                <span
                  aria-hidden
                  className="ml-auto h-1.5 w-1.5 shrink-0 rounded-[1px]"
                  style={{ backgroundColor: rarityStyle[drop.bestRarity].bar }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* -------------------------------------------------------- action */}
      <div>
        {!isConnected ? (
          <>
            <ConnectButton className="w-full" size="lg" />
            <p className="mt-2 text-center text-[0.76rem] text-foreground-muted">
              {t('connectPrompt')}
            </p>
          </>
        ) : wrongNetwork ? (
          <>
            <SwitchNetworkButton className="w-full" />
            <p className="mt-2 text-center text-[0.76rem] text-foreground-muted">{t('switchPrompt')}</p>
          </>
        ) : (
          <SpinButton
            machine={machine}
            phase={phase}
            insufficient={insufficient}
            onSpin={onSpin}
            onReset={onReset}
          />
        )}

        {isConnected && !wrongNetwork && balance && (
          <p className="num mt-2 text-center text-[0.74rem] text-foreground-muted">
            {w('balance')} {formatBnb(balance.value)} BNB
          </p>
        )}
      </div>

      {/* -------------------------------------------------------- status */}
      {(txHash || error || busy) && (
        <div className="space-y-2">
          {phase === 'confirming' && <StatusLine>{s('waitingSignature')}</StatusLine>}
          {txHash && (
            <StatusLine label={s('submitted')}>
              <span className="num">{shortHash(txHash)}</span>
            </StatusLine>
          )}
          {phase === 'settling' && <StatusLine pulse>{s('waitingRandomness')}</StatusLine>}
          {error && (
            <p
              role="alert"
              className="rounded-[9px] border border-danger/25 bg-danger-soft px-3 py-2.5 text-[0.78rem] leading-relaxed text-danger"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- button */

function SpinButton({
  machine,
  phase,
  insufficient,
  onSpin,
  onReset,
}: {
  machine: Machine
  phase: SpinPhase
  insufficient: boolean
  onSpin: () => void
  onReset: () => void
}) {
  const t = useTranslations('play.actions')
  const c = useTranslations('play.console')

  const base =
    'inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[13px] text-[0.98rem] font-semibold ' +
    'transition-[background-color,transform,box-shadow] duration-150 ease-[var(--ease-physical)] ' +
    'disabled:pointer-events-none disabled:opacity-50'

  const primary =
    'bg-brand text-brand-foreground shadow-[var(--shadow-brand)] hover:bg-brand-hover ' +
    'hover:-translate-y-px active:translate-y-[2px] active:bg-brand-pressed active:shadow-none'

  if (phase === 'confirming') {
    return (
      <button disabled className={cn(base, primary)}>
        {t('confirmInWallet')}
      </button>
    )
  }
  if (phase === 'submitted' || phase === 'settling' || phase === 'revealing') {
    return (
      <button disabled className={cn(base, primary)}>
        <Spinner />
        {phase === 'submitted' ? t('submitting') : t('running')}
      </button>
    )
  }
  if (phase === 'error') {
    return (
      <button
        onClick={onReset}
        className={cn(base, 'border border-border bg-surface text-foreground hover:bg-surface-hover')}
      >
        {t('tryAgain')}
      </button>
    )
  }
  if (insufficient) {
    return (
      <div>
        <button disabled className={cn(base, primary)}>
          {t('notEnough')}
        </button>
        <p className="mt-2.5 text-center text-[0.76rem] text-foreground-muted">
          {t('notEnoughHint', { amount: machine.priceBnb })}
        </p>
      </div>
    )
  }
  return (
    <button onClick={onSpin} className={cn(base, primary)}>
      {c('spinLabel', { label: machine.label, price: `$${machine.referencePriceUsd.toFixed(0)}` })}
    </button>
  )
}

/* -------------------------------------------------------------- bits */

function Fact({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'brand' | 'muted'
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 truncate text-[0.86rem] font-semibold',
          tone === 'brand' ? 'text-brand' : tone === 'muted' ? 'text-foreground-secondary' : 'text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function StatusLine({
  label,
  children,
  pulse,
}: {
  label?: string
  children: React.ReactNode
  pulse?: boolean
}) {
  return (
    <div
      aria-live="polite"
      className="flex items-center justify-between gap-3 rounded-[9px] border border-border bg-surface px-3 py-2.5 text-[0.78rem]"
    >
      <span className="flex items-center gap-2 text-foreground-secondary">
        {pulse && <span className="live-dot" />}
        {label ?? children}
      </span>
      {label && <span className="truncate text-foreground">{children}</span>}
    </div>
  )
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** One entry per distinct asset, carrying its best rarity and amount range. */
function dedupeTokens(machine: Machine) {
  const map = new Map<
    string,
    { token: NonNullable<ReturnType<typeof tokenByAddress>>; bestRarity: Rarity; minAmount: number; maxAmount: number }
  >()
  const order = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3 } as const

  for (const prize of machine.prizes) {
    const token = tokenByAddress(prize.token)
    if (!token) continue
    const existing = map.get(token.id)
    if (!existing) {
      map.set(token.id, {
        token,
        bestRarity: prize.rarity,
        minAmount: prize.amount,
        maxAmount: prize.amount,
      })
      continue
    }
    if (order[prize.rarity] > order[existing.bestRarity]) existing.bestRarity = prize.rarity
    existing.minAmount = Math.min(existing.minAmount, prize.amount)
    existing.maxAmount = Math.max(existing.maxAmount, prize.amount)
  }
  return [...map.values()]
}
