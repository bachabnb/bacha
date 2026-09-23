'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { useViewMode } from './ViewMode'
import { machineById, selectPrize } from '@/lib/machine'
import { tokenByAddress } from '@/lib/tokens'
import { shortAddress, shortHash, formatTokenAmount, formatBnb } from '@/lib/format'
import { explorer } from '@/lib/chain'
import type { SpinRecord } from '@/lib/spin/types'
import { cn } from '@/lib/cn'

type Status = 'idle' | 'loading' | 'found' | 'notFound' | 'unreachable'

/**
 * The verification console.
 *
 * Takes a spin id or a transaction hash — the two things somebody actually
 * has — and returns the whole record plus an *independent* re-derivation of
 * the outcome, computed in the browser from the prize table the spin was
 * stamped with. If our number and the chain's number disagree, it says so
 * rather than quietly showing the recorded one.
 */
export function SpinVerifier() {
  const t = useTranslations('fairness.verifier')
  const params = useSearchParams()
  const { mode } = useViewMode()
  const reduce = useReducedMotion()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [spin, setSpin] = useState<SpinRecord | null>(null)

  const lookup = useCallback(async (value: string) => {
    const trimmed = value.trim().replace(/^#/, '')
    if (!trimmed) return
    setStatus('loading')
    try {
      const res = await fetch(`/api/spins/${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setSpin(null)
        setStatus(body.error === 'unreachable' ? 'unreachable' : 'notFound')
        return
      }
      const body = (await res.json()) as { spin: SpinRecord }
      setSpin(body.spin)
      setStatus('found')
    } catch {
      setSpin(null)
      setStatus('unreachable')
    }
  }, [])

  const loadLatestSpin = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/spins/latest', { cache: 'no-store' })
      if (!res.ok) {
        setStatus('notFound')
        return
      }
      const body = (await res.json()) as { spin: SpinRecord }
      setSpin(body.spin)
      setQuery(body.spin.id)
      setStatus('found')
    } catch {
      setStatus('unreachable')
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
    <section id="verify" className="scroll-mt-28">
      <div className="card-physical card-lit overflow-hidden">
        <div className="relative border-b border-border p-6 lg:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-[1.5rem] font-bold tracking-[-0.035em] text-foreground">
              {t('title')}
            </h2>
            <p className="text-[0.8rem] text-foreground-muted">{t('hint')}</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void lookup(query)
            }}
            className="mt-5 flex flex-col gap-2.5 sm:flex-row"
          >
            <label className="sr-only" htmlFor="spin-query">
              {t('placeholder')}
            </label>
            <input
              id="spin-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('placeholder')}
              spellCheck={false}
              autoComplete="off"
              className="num h-[52px] flex-1 rounded-[12px] border border-border bg-background px-4 text-[0.95rem] text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'loading' || !query.trim()}
              className="inline-flex h-[52px] items-center justify-center rounded-[12px] bg-brand px-7 text-[0.95rem] font-semibold text-brand-foreground shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {status === 'loading' ? t('checking') : t('submit')}
            </button>
          </form>

          <button
            onClick={() => void loadLatestSpin()}
            className="mt-3 text-[0.8rem] text-foreground-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground"
          >
            {t('useLatest')}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div key="idle" {...fade(reduce)} className="p-6 lg:p-7">
              <p className="text-[0.86rem] leading-relaxed text-foreground-muted">
                {t('states.notFoundHint')}
              </p>
            </motion.div>
          )}

          {(status === 'notFound' || status === 'unreachable') && (
            <motion.div key={status} {...fade(reduce)} className="p-6 lg:p-7">
              <Notice
                tone="warning"
                title={t(status === 'notFound' ? 'states.notFound' : 'states.unreachable')}
                body={t(status === 'notFound' ? 'states.notFoundHint' : 'states.unreachableHint')}
              />
            </motion.div>
          )}

          {status === 'found' && spin && (
            <motion.div key={spin.id} {...fade(reduce)}>
              <ProofCard spin={spin} technical={mode === 'technical'} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function fade(reduce: boolean | null) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  }
}

/* --------------------------------------------------------------- report */

function ProofCard({ spin, technical }: { spin: SpinRecord; technical: boolean }) {
  const t = useTranslations('fairness.verifier')
  const s = useTranslations('status')
  const machine = machineById(spin.machineId)
  const token = spin.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined

  // Independent re-derivation from the table this spin was stamped with.
  const recomputed = machine && spin.randomWord ? selectPrize(machine, BigInt(spin.randomWord)) : null
  const matches =
    recomputed && spin.rewardTokenAddress
      ? recomputed.prize.token.toLowerCase() === spin.rewardTokenAddress.toLowerCase() &&
        recomputed.prize.amountUnits === spin.rewardAmountUnits
      : null

  const pending = spin.status === 'PENDING'

  return (
    <div className="p-6 lg:p-7">
      {/* ------------------------------------------------------ verdict */}
      {pending ? (
        <Notice tone="warning" title={t('states.pending')} body={t('states.pendingHint')} />
      ) : matches ? (
        <Notice
          tone="success"
          title={t('recomputed.matched')}
          body={t('recomputed.matchedDetail', {
            version: spin.machineVersion,
            index: String(recomputed?.index ?? ''),
          })}
        />
      ) : (
        <Notice
          tone="danger"
          title={t('recomputed.mismatched')}
          body={t('recomputed.mismatchedDetail')}
        />
      )}

      {spin.mode === 'demo' && (
        <p className="mt-3 rounded-[10px] border border-border bg-background px-3.5 py-2.5 text-[0.78rem] text-foreground-muted">
          {t('states.simulated')}
        </p>
      )}

      {/* ------------------------------------------------------- reward */}
      {token && spin.rewardAmount != null && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[12px] border border-border bg-background p-5">
          <TokenMark token={token} size={44} />
          <div className="min-w-0">
            <div className="text-[0.6rem] uppercase tracking-[0.15em] text-foreground-muted">
              {t('fields.reward')}
            </div>
            <div className="num mt-1 text-[1.25rem] font-semibold text-foreground">
              {formatTokenAmount(spin.rewardAmount, token.symbol)}
            </div>
          </div>
          {spin.rarity && <RarityChip rarity={spin.rarity} className="ml-auto" />}
        </div>
      )}

      {/* -------------------------------------------------------- facts */}
      <dl className="mt-5 grid gap-px overflow-hidden rounded-[12px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('fields.spin')} value={`#${spin.id}`} />
        <Field label={t('fields.status')} value={s(spin.status)} />
        <Field
          label={t('fields.player')}
          value={shortAddress(spin.player, 6, 6)}
          href={spin.mode === 'onchain' ? explorer.address(spin.player) : undefined}
        />
        <Field label={t('fields.machine')} value={machine?.label ?? `T${spin.tierId}`} />
        <Field label={t('fields.version')} value={spin.machineVersion} />
        <Field label={t('fields.paid')} value={`${formatBnb(BigInt(spin.paymentWei), 5)} BNB`} />
        {technical && (
          <>
            <Field label={t('fields.tableHash')} value={shortHash(spin.prizeTableHash, 8, 6)} />
            <Field
              label={t('fields.request')}
              value={spin.requestId ? shortHash(spin.requestId, 8, 4) : '—'}
            />
            <Field
              label={t('fields.randomWord')}
              value={
                spin.randomWord
                  ? shortHash(`0x${BigInt(spin.randomWord).toString(16)}`, 10, 8)
                  : '—'
              }
            />
            <Field
              label={t('fields.prizeEntry')}
              value={spin.prizeIndex != null ? `#${spin.prizeIndex}` : '—'}
            />
          </>
        )}
      </dl>

      {/* ------------------------------------------------------ actions */}
      {spin.mode === 'onchain' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {spin.txHash && <LinkButton href={explorer.tx(spin.txHash)}>{t('actions.result')}</LinkButton>}
          {spin.claimTxHash && (
            <LinkButton href={explorer.tx(spin.claimTxHash)}>{t('actions.payout')}</LinkButton>
          )}
        </div>
      )}

      <Timeline spin={spin} />
    </div>
  )
}

/* ------------------------------------------------------------- timeline */

function Timeline({ spin }: { spin: SpinRecord }) {
  const t = useTranslations('fairness.verifier.timeline')

  const settled = spin.status !== 'PENDING'
  const claimed = spin.status === 'CLAIMED'

  const steps = [
    { key: 'payment', state: 'done' as const, at: spin.requestedAt, detail: t('paymentDetail') },
    {
      key: 'locked',
      state: 'done' as const,
      at: spin.requestedAt,
      detail: t('lockedDetail', { version: spin.machineVersion }),
    },
    {
      key: 'requested',
      state: (spin.requestId ? 'done' : 'active') as 'done' | 'active',
      at: spin.requestedAt,
      detail: t('requestedDetail'),
    },
    {
      key: 'returned',
      state: (settled ? 'done' : 'active') as 'done' | 'active',
      at: spin.settledAt,
      detail: t('returnedDetail'),
    },
    {
      key: 'calculated',
      state: (settled ? 'done' : 'waiting') as 'done' | 'waiting',
      at: spin.settledAt,
      detail: t('calculatedDetail'),
    },
    {
      key: 'payout',
      state: (claimed ? 'done' : settled ? 'active' : 'waiting') as 'done' | 'active' | 'waiting',
      at: claimed ? spin.settledAt : null,
      detail: t('payoutDetail'),
    },
  ]

  return (
    <div className="mt-7">
      <h3 className="text-[0.62rem] uppercase tracking-[0.18em] text-foreground-muted">
        {t('title')}
      </h3>

      <ol className="relative mt-4">
        {/* The recurring yellow line: input → randomness → output. */}
        <span
          aria-hidden
          className="absolute left-[11px] top-2 bottom-2 w-px"
          style={{ background: 'linear-gradient(to bottom, var(--brand-line), var(--border))' }}
        />
        {steps.map((step) => (
          <li key={step.key} className="relative flex gap-4 pb-4 last:pb-0">
            <StepDot state={step.state} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[0.86rem] font-medium text-foreground">{t(step.key)}</span>
                <span className="num text-[0.7rem] text-foreground-muted">
                  {step.at ? new Date(step.at).toLocaleString() : t(step.state)}
                </span>
              </div>
              <p className="mt-0.5 text-[0.78rem] text-foreground-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** State is carried by the glyph as well as the colour, never colour alone. */
function StepDot({ state }: { state: 'done' | 'active' | 'waiting' }) {
  return (
    <span
      className={cn(
        'relative z-10 mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border',
        state === 'done' && 'border-success/40 bg-success-soft text-success',
        state === 'active' && 'border-brand-line bg-brand-soft text-brand',
        state === 'waiting' && 'border-border bg-surface text-foreground-muted',
      )}
    >
      {state === 'done' ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.2 4.7 8.4 9.5 3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : state === 'active' ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full border border-current" />
      )}
    </span>
  )
}

/* ----------------------------------------------------------------- bits */

function Notice({
  tone,
  title,
  body,
}: {
  tone: 'success' | 'warning' | 'danger'
  title: string
  body: string
}) {
  const style = {
    success: 'border-success/30 bg-success-soft text-success',
    warning: 'border-warning/30 bg-warning-soft text-warning',
    danger: 'border-danger/30 bg-danger-soft text-danger',
  }[tone]

  return (
    <div className={cn('flex items-start gap-3 rounded-[12px] border px-4 py-3.5', style)}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {tone === 'success' ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 4.5v4M8 11v.5" strokeLinecap="round" />
            <circle cx="8" cy="8" r="6.4" />
          </svg>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[0.88rem] font-medium">{title}</p>
        <p className="mt-1 text-[0.78rem] leading-relaxed text-foreground-secondary">{body}</p>
      </div>
    </div>
  )
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-[0.6rem] uppercase tracking-[0.15em] text-foreground-muted">{label}</dt>
      <dd className="num mt-1 truncate text-[0.84rem] text-foreground">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 items-center rounded-[10px] border border-border bg-surface px-3.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
    >
      {children}
    </a>
  )
}
