'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { SectionLabel } from './HowProduced'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { machines, rarityBreakdown, machineConfigGeneratedAt } from '@/lib/machine'
import { tokenByAddress } from '@/lib/tokens'
import { RARITIES, rarityStyle, type Rarity } from '@/lib/rarity'
import { formatPercent, formatTokenAmount, formatUsd, shortAddress, shortHash } from '@/lib/format'
import { explorer } from '@/lib/chain'
import { useViewMode } from './ViewMode'
import { cn } from '@/lib/cn'

type Filter = 'ALL' | Rarity

/**
 * Published odds, one machine at a time.
 *
 * Rendering all three tables at once was the single biggest cause of this
 * page's length, and the repetition made none of them easier to read. A
 * selector keeps the density of a data terminal without the scroll.
 */
export function PublishedOdds() {
  const t = useTranslations('fairness.odds')
  const r = useTranslations('rarity')
  const { mode } = useViewMode()
  const reduce = useReducedMotion()

  const [machineId, setMachineId] = useState(machines[0].id)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [copied, setCopied] = useState(false)

  const machine = machines.find((m) => m.id === machineId) ?? machines[0]
  const rows = useMemo(
    () => (filter === 'ALL' ? machine.prizes : machine.prizes.filter((p) => p.rarity === filter)),
    [machine, filter],
  )

  const distinctAssets = new Set(machine.prizes.map((p) => p.token.toLowerCase())).size

  /** The exact payload an operator would publish, so it can be checked offline. */
  const json = useMemo(
    () =>
      JSON.stringify(
        {
          machine: machine.label,
          totalWeight: machine.totalWeight,
          prizeTableHash: machine.localTableHash,
          prizes: machine.prizes.map((p) => ({
            token: p.token,
            symbol: p.symbol,
            decimals: p.decimals,
            amount: p.amountUnits,
            weight: p.weight,
            rarity: RARITIES.indexOf(p.rarity),
            probability: p.weight / machine.totalWeight,
          })),
        },
        null,
        2,
      ),
    [machine],
  )

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard can be blocked */
    }
  }

  return (
    <section id="odds" className="scroll-mt-28">
      <SectionLabel index="04" />
      <h2 className="type-section mt-3 font-display font-extrabold text-foreground">{t('title')}</h2>
      <p className="mt-3 max-w-xl text-[0.98rem] leading-relaxed text-foreground-secondary">
        {t('body')}
      </p>

      {/* ------------------------------------------------ machine selector */}
      <div className="mt-8 inline-flex rounded-[11px] border border-border bg-surface p-1">
        {machines.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMachineId(m.id)
              setFilter('ALL')
            }}
            aria-pressed={m.id === machineId}
            className={cn(
              'relative min-h-[36px] rounded-[8px] px-5 text-[0.86rem] font-semibold transition-colors',
              m.id === machineId ? 'text-brand-foreground' : 'text-foreground-secondary hover:text-foreground',
            )}
          >
            {m.id === machineId && (
              <motion.span
                layoutId="odds-machine"
                className="absolute inset-0 rounded-[8px] bg-brand"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 36 }}
              />
            )}
            <span className="relative">{m.label}</span>
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- header */}
      <div className="mt-5 card-physical overflow-hidden">
        <dl className="grid gap-px border-b border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          <Meta label={t('spin')} value={`$${machine.referencePriceUsd.toFixed(0)}`} />
          <Meta label={t('version')} value={machine.id === machines[0].id ? 'v1' : 'v1'} />
          <Meta label={t('assets')} value={String(distinctAssets)} />
          <Meta label={t('published')} value={machineConfigGeneratedAt} />
          <Meta label={t('totalWeight')} value={machine.totalWeight.toLocaleString()} />
          <Meta
            label={t('estimatedValue')}
            value={formatUsd(machine.expectedValueUsd, { approx: true })}
            tone="brand"
          />
        </dl>

        {/* ------------------------------------------------------- toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex flex-wrap gap-1.5" role="group">
            {(['ALL', ...RARITIES] as Filter[]).map((option) => {
              const count =
                option === 'ALL'
                  ? machine.prizes.length
                  : machine.prizes.filter((p) => p.rarity === option).length
              if (count === 0) return null
              return (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={cn(
                    'rounded-[8px] border px-2.5 py-1.5 text-[0.74rem] font-medium transition-colors',
                    filter === option
                      ? 'border-brand-line bg-brand-soft text-brand'
                      : 'border-border bg-background text-foreground-secondary hover:text-foreground',
                  )}
                >
                  {option === 'ALL' ? t('filterAll') : r(option)}
                  <span className="num ml-1.5 text-[0.66rem] opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={copyJson}
            className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-border bg-background px-3 text-[0.76rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {copied ? t('copied') : t('copyJson')}
          </button>
        </div>

        {/* --------------------------------------------------------- table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[46rem] text-left">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                <th className="px-5 py-3 font-normal">{t('columns.token')}</th>
                <th className="px-5 py-3 font-normal">{t('columns.amount')}</th>
                <th className="px-5 py-3 font-normal">{t('columns.rarity')}</th>
                <th className="px-5 py-3 text-right font-normal">{t('columns.weight')}</th>
                <th className="px-5 py-3 text-right font-normal">{t('columns.probability')}</th>
                {mode === 'technical' && (
                  <th className="px-5 py-3 font-normal">{t('columns.address')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((prize, i) => {
                const token = tokenByAddress(prize.token)
                return (
                  <tr
                    key={`${prize.token}-${i}`}
                    className="border-t border-border transition-colors hover:bg-surface-hover"
                  >
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3" title={token?.name}>
                        {token && <TokenMark token={token} size={30} />}
                        <span className="num text-[0.88rem] font-medium text-foreground">
                          {prize.symbol}
                        </span>
                      </span>
                    </td>
                    <td className="num px-5 py-3.5 text-[0.88rem] text-foreground-secondary">
                      {formatTokenAmount(prize.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <RarityChip rarity={prize.rarity} />
                    </td>
                    <td className="num px-5 py-3.5 text-right text-[0.86rem] text-foreground-secondary">
                      {prize.weight.toLocaleString()}
                    </td>
                    <td className="num px-5 py-3.5 text-right text-[0.98rem] font-semibold text-foreground">
                      {formatPercent(prize.weight / machine.totalWeight)}
                    </td>
                    {mode === 'technical' && (
                      <td className="num px-5 py-3.5 text-[0.72rem]">
                        <a
                          href={explorer.token(prize.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground-muted underline decoration-border underline-offset-4 hover:text-foreground"
                        >
                          {shortAddress(prize.token, 6, 4)}
                        </a>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ---------------------------------------------- mobile card rows */}
        <ul className="sm:hidden">
          {rows.map((prize, i) => {
            const token = tokenByAddress(prize.token)
            return (
              <li key={`${prize.token}-${i}`} className="border-t border-border px-5 py-4">
                <div className="flex items-center gap-3">
                  {token && <TokenMark token={token} size={30} />}
                  <div className="min-w-0 flex-1">
                    <div className="num text-[0.9rem] font-medium text-foreground">{prize.symbol}</div>
                    <div className="num mt-0.5 text-[0.76rem] text-foreground-muted">
                      {formatTokenAmount(prize.amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[1rem] font-semibold text-foreground">
                      {formatPercent(prize.weight / machine.totalWeight)}
                    </div>
                    <div className="mt-1">
                      <RarityChip rarity={prize.rarity} />
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          <span className="num text-[0.7rem] text-foreground-muted">
            {t('tableHash')} {shortHash(machine.localTableHash, 10, 8)}
          </span>
          <span className="text-[0.7rem] text-foreground-muted">{t('estimatedNote')}</span>
        </div>
      </div>

      {/* --------------------------------------------- distribution recap */}
      <div className="mt-4 flex flex-wrap gap-3">
        {rarityBreakdown(machine)
          .filter((s) => s.share > 0)
          .map((s) => (
            <span
              key={s.rarity}
              className="inline-flex items-center gap-2 rounded-[9px] border border-border bg-surface px-3 py-2"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: rarityStyle[s.rarity].bar }}
              />
              <span className="text-[0.78rem] text-foreground-secondary">{r(s.rarity)}</span>
              <span className="num text-[0.82rem] font-semibold text-foreground">
                {formatPercent(s.share)}
              </span>
            </span>
          ))}
      </div>

      {/* ------------------------------------------------- version history */}
      <div className="mt-6 card-physical p-5">
        <h3 className="text-[0.62rem] uppercase tracking-[0.18em] text-foreground-muted">
          {t('history.title')}
        </h3>
        <ol className="mt-3 space-y-2">
          <li className="flex items-center justify-between gap-4 rounded-[10px] border border-brand-line bg-brand-soft px-3.5 py-2.5">
            <span className="num text-[0.84rem] font-medium text-foreground">v1</span>
            <span className="text-[0.76rem] text-brand">{t('history.current')}</span>
            <span className="num text-[0.76rem] text-foreground-muted">{machineConfigGeneratedAt}</span>
          </li>
        </ol>
        <p className="mt-3 text-[0.76rem] text-foreground-muted">{t('history.onlyVersion')}</p>
      </div>
    </section>
  )
}

function Meta({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'brand'
}) {
  return (
    <div className="bg-surface px-5 py-3.5">
      <dt className="text-[0.58rem] uppercase tracking-[0.16em] text-foreground-muted">{label}</dt>
      <dd
        className={cn(
          'num mt-1.5 truncate text-[0.92rem] font-semibold',
          tone === 'brand' ? 'text-brand' : 'text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
