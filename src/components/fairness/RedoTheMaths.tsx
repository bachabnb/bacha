'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SectionLabel } from './HowProduced'
import { ArtImage } from '@/components/brand/ArtImage'
import { RarityChip } from '@/components/ui/RarityChip'
import { machines, selectPrize } from '@/lib/machine'
import { formatPercent, formatTokenAmount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * A fixed random word, so the worked example is stable and anyone can
 * reproduce it byte for byte against the published table.
 */
const EXAMPLE_WORD = 827361504928374615n

/**
 * The selection algorithm, and a worked example against a real table.
 *
 * The pseudocode below mirrors `BachaGame._selectPrize` line for line. The
 * example uses a fixed random word run through the machine's actual published
 * weights, so the cumulative bands shown are the real ones rather than round
 * numbers chosen to look tidy.
 */
export function RedoTheMaths() {
  const t = useTranslations('fairness.math')
  const o = useTranslations('fairness.odds')
  const [machineId, setMachineId] = useState(machines[0].id)
  const [copied, setCopied] = useState(false)

  const machine = machines.find((m) => m.id === machineId) ?? machines[0]

  const { roll, chosen, bands } = useMemo(() => {
    const total = BigInt(machine.totalWeight)
    const r = Number(EXAMPLE_WORD % total)
    const { index } = selectPrize(machine, EXAMPLE_WORD)

    let cumulative = 0
    const b = machine.prizes.map((prize, i) => {
      const from = cumulative
      cumulative += prize.weight
      return { i, prize, from, to: cumulative - 1 }
    })
    return { roll: r, chosen: index, bands: b }
  }, [machine])

  const code = `roll = randomWord % totalWeight
cumulative = 0

for entry in prizes:            # in published order
    cumulative += entry.weight
    if roll < cumulative:
        return entry            # exactly one prize, always`

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard can be blocked */
    }
  }

  return (
    <section id="math" className="scroll-mt-[11rem]">
      <SectionLabel index="05" />
      <h2 className="type-section mt-3 font-display font-extrabold text-foreground">{t('title')}</h2>
      <p className="mt-3 max-w-xl text-[0.98rem] leading-relaxed text-foreground-secondary">
        {t('body')}
      </p>

      <div className="mt-9 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start lg:gap-10">
        <div className="min-w-0">
          {/* ------------------------------------------------- algorithm */}
          <div className="card-physical overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <span className="num text-[0.66rem] uppercase tracking-[0.16em] text-foreground-muted">
                BachaGame._selectPrize
              </span>
              <button
                onClick={copyCode}
                className="inline-flex h-7 items-center rounded-[8px] border border-border bg-background px-2.5 text-[0.72rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                {copied ? o('copied') : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto bg-surface-sunken p-5 text-[0.8rem] leading-relaxed text-foreground-secondary">
              <code>{code}</code>
            </pre>
          </div>

          {/* --------------------------------------------- worked example */}
          <div className="card-physical mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <span className="tag">{t('example')}</span>
              <div className="inline-flex rounded-[9px] border border-border bg-background p-[3px]">
                {machines.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMachineId(m.id)}
                    aria-pressed={m.id === machineId}
                    className={cn(
                      'rounded-[6px] px-2.5 py-1 text-[0.72rem] font-medium transition-colors',
                      m.id === machineId
                        ? 'bg-brand text-brand-foreground'
                        : 'text-foreground-secondary hover:text-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              <p className="text-[0.84rem] text-foreground-secondary">
                {t('exampleBody', { machine: machine.label })}
              </p>

              <dl className="mt-4 grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-3">
                <Cell label={t('randomWord')} value={EXAMPLE_WORD.toString()} mono />
                <Cell label={t('totalWeight')} value={machine.totalWeight.toLocaleString()} mono />
                <Cell label={t('selection')} value={roll.toLocaleString()} mono tone="brand" />
              </dl>

              {/* Cumulative bands, with the one containing the roll marked. */}
              <ul className="mt-5 space-y-1.5">
                {bands.map((band) => {
                  const hit = band.i === chosen
                  return (
                    <li
                      key={band.i}
                      className={cn(
                        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[9px] border px-3 py-2 text-[0.78rem]',
                        hit
                          ? 'border-brand-line bg-brand-soft'
                          : 'border-border bg-background',
                      )}
                    >
                      <span className="num w-[8.5rem] shrink-0 text-foreground-muted">
                        {band.from.toLocaleString()}–{band.to.toLocaleString()}
                      </span>
                      <span className="num flex-1 truncate font-medium text-foreground">
                        {formatTokenAmount(band.prize.amount, band.prize.symbol)}
                      </span>
                      <RarityChip rarity={band.prize.rarity} />
                      <span className="num w-[3.5rem] shrink-0 text-right text-foreground-secondary">
                        {formatPercent(band.prize.weight / machine.totalWeight)}
                      </span>
                      {hit && (
                        <span className="num shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-brand">
                          ← {t('lands')}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-[0.78rem] leading-relaxed text-foreground-muted">
            {t('note')}
          </p>
        </div>

        {/* ------------------------------------------------------- art */}
        <div className="relative mx-auto w-full max-w-[20rem] lg:sticky lg:top-28 lg:max-w-none">
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[10%] rounded-full" />
          <ArtImage id="proof-core" alt={t('artAlt')} className="relative" sizes="(max-width: 1024px) 70vw, 30vw" />
        </div>
      </div>
    </section>
  )
}

function Cell({
  label,
  value,
  mono,
  tone = 'default',
}: {
  label: string
  value: string
  mono?: boolean
  tone?: 'default' | 'brand'
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-[0.58rem] uppercase tracking-[0.16em] text-foreground-muted">{label}</dt>
      <dd
        className={cn(
          'mt-1 truncate text-[0.84rem] font-medium',
          mono && 'num',
          tone === 'brand' ? 'text-brand' : 'text-foreground',
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}
