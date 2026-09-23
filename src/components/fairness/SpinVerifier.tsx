'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { RarityChip } from '@/components/ui/RarityChip'
import { TokenMark } from '@/components/ui/TokenMark'
import { machineById, selectPrize } from '@/lib/machine'
import { tokenByAddress } from '@/lib/tokens'
import { shortAddress, shortHash, formatTokenAmount, formatBnb } from '@/lib/format'
import { explorer } from '@/lib/chain'
import type { SpinRecord } from '@/lib/spin/types'
import { cn } from '@/lib/cn'

type Status = 'idle' | 'loading' | 'found' | 'missing'

/**
 * Paste a spin id, get its whole life story — and, crucially, an independent
 * re-derivation of the outcome.
 *
 * The check below runs the same weighted walk the contract runs, in the
 * browser, against the prize table the spin was stamped with. If our number
 * and the chain's number disagree, this says so.
 */
export function SpinVerifier() {
  const t = useTranslations('fairness.verifier')
  const params = useSearchParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [spin, setSpin] = useState<SpinRecord | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const lookup = useCallback(async (id: string) => {
    const trimmed = id.trim().replace(/^#/, '')
    if (!trimmed) return
    setStatus('loading')
    setMessage(null)
    try {
      const res = await fetch(`/api/spins/${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setStatus('missing')
        setSpin(null)
        setMessage(body.error ?? null)
        return
      }
      const body = (await res.json()) as { spin: SpinRecord }
      setSpin(body.spin)
      setStatus('found')
    } catch {
      setStatus('missing')
      setSpin(null)
      setMessage(null)
    }
  }, [])

  useEffect(() => {
    const preset = params.get('spin')
    if (preset) {
      setQuery(preset)
      void lookup(preset)
    }
  }, [params, lookup])

  return (
    <div className="panel-raised p-6 lg:p-8">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void lookup(query)
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="sr-only" htmlFor="spin-id">
          {t('label')}
        </label>
        <input
          id="spin-id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputMode="numeric"
          placeholder={t('placeholder')}
          className="num h-12 flex-1 rounded-[10px] border border-border-strong bg-black/40 px-4 text-[0.92rem] text-foreground placeholder:text-foreground-muted focus:border-brand-line focus:outline-none"
        />
        <Button type="submit" size="lg" disabled={status === 'loading' || !query.trim()}>
          {status === 'loading' ? t('checking') : t('submit')}
        </Button>
      </form>

      {status === 'missing' && (
        <p className="mt-5 rounded-[8px] border border-border bg-surface px-4 py-3 text-[0.84rem] text-foreground-secondary">
          {message ?? t('notFound')}
        </p>
      )}

      {status === 'found' && spin && <VerificationReport spin={spin} />}

      {status === 'idle' && (
        <p className="mt-5 text-[0.82rem] leading-relaxed text-foreground-muted">{t('idle')}</p>
      )}
    </div>
  )
}

function VerificationReport({ spin }: { spin: SpinRecord }) {
  const t = useTranslations('fairness.verifier')
  const s = useTranslations('status')
  const c = useTranslations('common')
  const machine = machineById(spin.machineId)
  const token = spin.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined

  // Independent re-derivation.
  const recomputed =
    machine && spin.randomWord ? selectPrize(machine, BigInt(spin.randomWord)) : null
  const matches =
    recomputed && spin.rewardTokenAddress
      ? recomputed.prize.token.toLowerCase() === spin.rewardTokenAddress.toLowerCase() &&
        recomputed.prize.amountUnits === spin.rewardAmountUnits
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-[1.3rem] font-bold tracking-[-0.035em] text-foreground">
          {t('spinTitle', { id: spin.id })}
        </h3>
        <div className="flex items-center gap-2">
          {spin.rarity && <RarityChip rarity={spin.rarity} />}
          <span className="tag tag-neutral">{s(spin.status)}</span>
          <span className={cn('tag', spin.mode === 'demo' && 'tag-neutral')}>
            {spin.mode === 'demo' ? c('simulated') : c('onchain')}
          </span>
        </div>
      </div>

      {spin.status === 'PENDING' ? (
        <p className="mt-5 rounded-[10px] border border-warning/25 bg-warning-soft px-4 py-3 text-[0.84rem] leading-relaxed text-warning">
          {t('pending')}
        </p>
      ) : (
        <div
          className={cn(
            'mt-5 flex items-start gap-3 rounded-[10px] border px-4 py-3.5',
            matches ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft',
          )}
        >
          <span className={cn('mt-0.5 shrink-0', matches ? 'text-success' : 'text-danger')}>
            {matches ? <CheckIcon /> : <CrossIcon />}
          </span>
          <div className="min-w-0">
            <p className={cn('text-[0.88rem] font-medium', matches ? 'text-success' : 'text-danger')}>
              {matches ? t('matched') : t('mismatched')}
            </p>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-foreground-secondary">
              {matches
                ? t('matchedDetail', {
                    version: spin.machineVersion,
                    index: String(recomputed?.index ?? ''),
                  })
                : t('mismatchedDetail')}
            </p>
          </div>
        </div>
      )}

      <dl className="mt-7 grid gap-px overflow-hidden rounded-[12px] border border-border bg-surface-hover sm:grid-cols-2">
        <Field label={t('fields.wallet')}>
          {spin.mode === 'onchain' ? (
            <a href={explorer.address(spin.player)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              {shortAddress(spin.player, 6, 6)}
            </a>
          ) : (
            shortAddress(spin.player, 6, 6)
          )}
        </Field>
        <Field label={t('fields.machine')}>{machine?.label ?? `T${spin.tierId}`}</Field>
        <Field label={t('fields.version')}>{spin.machineVersion}</Field>
        <Field label={t('fields.tableHash')}>{shortHash(spin.prizeTableHash, 8, 6)}</Field>
        <Field label={t('fields.paid')}>{formatBnb(BigInt(spin.paymentWei), 5)} BNB</Field>
        <Field label={t('fields.vrfRequest')}>
          {spin.requestId ? shortHash(spin.requestId, 8, 4) : t('fields.notRequested')}
        </Field>
        <Field label={t('fields.randomWord')}>
          {spin.randomWord
            ? shortHash(`0x${BigInt(spin.randomWord).toString(16)}`, 10, 8)
            : t('fields.pendingValue')}
        </Field>
        <Field label={t('fields.prizeEntry')}>{spin.prizeIndex != null ? `#${spin.prizeIndex}` : '—'}</Field>
        <Field label={t('fields.spinTx')}>
          {spin.txHash ? (
            <a href={explorer.tx(spin.txHash)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              {shortHash(spin.txHash)}
            </a>
          ) : (
            t('fields.simulated')
          )}
        </Field>
        <Field label={t('fields.payoutTx')}>
          {spin.claimTxHash ? (
            <a href={explorer.tx(spin.claimTxHash)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              {shortHash(spin.claimTxHash)}
            </a>
          ) : spin.status === 'CLAIMED' ? (
            t('fields.simulated')
          ) : (
            t('fields.notClaimed')
          )}
        </Field>
      </dl>

      {token && spin.rewardAmount != null && (
        <div className="mt-5 flex items-center gap-4 rounded-[12px] border border-border bg-surface p-5">
          <TokenMark token={token} size={44} />
          <div className="min-w-0">
            <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
              {t('fields.reward')}
            </div>
            <div className="num mt-1 text-[1.1rem] font-semibold text-foreground">
              {formatTokenAmount(spin.rewardAmount, token.symbol)}
            </div>
            <div className="num mt-0.5 text-[0.7rem] text-foreground-muted">
              {t('fields.baseUnits', {
                units: spin.rewardAmountUnits ?? '',
                decimals: token.decimals,
              })}
            </div>
          </div>
          <a
            href={explorer.token(token.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="num ml-auto shrink-0 text-[0.74rem] text-foreground-secondary underline decoration-white/20 underline-offset-4 hover:text-foreground"
          >
            {shortAddress(token.address)}
          </a>
        </div>
      )}
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <dt className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{label}</dt>
      <dd className="num mt-1.5 truncate text-[0.84rem] text-foreground-secondary">{children}</dd>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  )
}
