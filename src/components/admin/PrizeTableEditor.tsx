'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { OddsBar } from '@/components/ui/OddsBar'
import { TokenMark } from '@/components/ui/TokenMark'
import { Card, Metric, StatusPill } from './AdminPrimitives'
import { rewardTokens, tokenByAddress } from '@/lib/tokens'
import { machines } from '@/lib/machine'
import { RARITIES, rarityIndex } from '@/lib/rarity'
import { previewTable, fundableSpins, type DraftPrize } from '@/lib/admin/preview'
import { numberToUnits, unitsToNumber, formatTokenAmount, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'

interface Row extends DraftPrize {
  /** Whole-token input value, kept alongside the exact base units. */
  amountInput: string
}

/**
 * Prize-table editor.
 *
 * Amounts are authored in whole tokens but stored as exact base units, so a
 * float never reaches a published table. Every check the contract performs is
 * mirrored here, and publishing is blocked until the draft would actually
 * succeed onchain — an operator should not learn about a bad table from a
 * reverted transaction.
 */
export function PrizeTableEditor({ vaultBalances }: { vaultBalances: Record<string, string> }) {
  const tokens = rewardTokens()
  const [rows, setRows] = useState<Row[]>(() => seedFrom('quick'))

  const preview = useMemo(
    () => previewTable(rows.map(({ token, amountUnits, weight, rarity }) => ({ token, amountUnits, weight, rarity }))),
    [rows],
  )

  const spinsFundable = useMemo(
    () => fundableSpins(preview.perSpinLiability, vaultBalances),
    [preview.perSpinLiability, vaultBalances],
  )

  function update(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, ...patch }
        if (patch.amountInput !== undefined || patch.token !== undefined) {
          const token = tokenByAddress(next.token)
          const parsed = Number(next.amountInput)
          next.amountUnits =
            token && Number.isFinite(parsed) && parsed > 0
              ? numberToUnits(parsed, token.decimals).toString()
              : '0'
        }
        return next
      }),
    )
  }

  function addRow() {
    const token = tokens[0]
    setRows((current) => [
      ...current,
      {
        token: token.address,
        amountInput: '1',
        amountUnits: numberToUnits(1, token.decimals).toString(),
        weight: 100,
        rarity: 0,
      },
    ])
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr] xl:items-start">
      <Card
        title="Draft table"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={addRow}>
              Add entry
            </Button>
            <div className="flex items-center gap-3">
              {machines.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setRows(seedFrom(m.id))}
                  className="text-[0.76rem] text-foreground-muted underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  Load {m.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-[0.82rem]">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                <th className="pb-3 font-normal">Asset</th>
                <th className="pb-3 font-normal">Amount</th>
                <th className="pb-3 font-normal">Base units</th>
                <th className="pb-3 font-normal">Weight</th>
                <th className="pb-3 font-normal">Chance</th>
                <th className="pb-3 font-normal">Rarity</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const token = tokenByAddress(row.token)
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        {token && <TokenMark token={token} size={22} />}
                        <select
                          value={row.token}
                          onChange={(e) => update(i, { token: e.target.value })}
                          aria-label={`Entry ${i + 1} asset`}
                          className="h-8 rounded-[7px] border border-border bg-surface px-2 text-[0.8rem] text-foreground focus:border-brand focus:outline-none"
                        >
                          {tokens.map((t) => (
                            <option key={t.address} value={t.address}>
                              {t.symbol}
                            </option>
                          ))}
                        </select>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        value={row.amountInput}
                        onChange={(e) => update(i, { amountInput: e.target.value })}
                        inputMode="decimal"
                        aria-label={`Entry ${i + 1} amount`}
                        className="num h-8 w-28 rounded-[7px] border border-border bg-surface px-2 text-[0.8rem] text-foreground focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="num py-2.5 pr-3 text-[0.68rem] text-foreground-muted">
                      {row.amountUnits}
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        value={row.weight}
                        onChange={(e) => update(i, { weight: Number(e.target.value) || 0 })}
                        inputMode="numeric"
                        aria-label={`Entry ${i + 1} weight`}
                        className="num h-8 w-20 rounded-[7px] border border-border bg-surface px-2 text-[0.8rem] text-foreground focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="num py-2.5 pr-3 text-foreground">
                      {preview.totalWeight > 0 ? formatPercent(row.weight / preview.totalWeight) : '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={row.rarity}
                        onChange={(e) => update(i, { rarity: Number(e.target.value) })}
                        aria-label={`Entry ${i + 1} rarity`}
                        className="h-8 rounded-[7px] border border-border bg-surface px-2 text-[0.8rem] text-foreground focus:border-brand focus:outline-none"
                      >
                        {RARITIES.map((r) => (
                          <option key={r} value={rarityIndex(r)}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setRows((c) => c.filter((_, idx) => idx !== i))}
                        aria-label={`Remove entry ${i + 1}`}
                        className="rounded p-1 text-foreground-muted transition-colors hover:text-danger"
                      >
                        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" strokeLinecap="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Validation">
          <div className="grid grid-cols-2 gap-5">
            <Metric
              label="Total weight"
              value={preview.totalWeight.toLocaleString()}
              hint="Any total is valid — chances are shares of it"
            />
            <Metric label="Entries" value={preview.prizeCount} />
            <Metric label="Distinct assets" value={preview.distinctAssets} />
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
                Publishable
              </div>
              <div className="mt-2">
                <StatusPill status={preview.valid ? 'HEALTHY' : 'UNFUNDED'} />
              </div>
            </div>
          </div>

          {preview.problems.length > 0 && (
            <ul className="mt-5 space-y-1.5 rounded-[10px] border border-danger/25 bg-danger-soft p-3 text-[0.78rem] text-danger">
              {preview.problems.map((problem, i) => (
                <li key={i}>{problem}</li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <div className="mb-3 text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
              Distribution
            </div>
            <OddsBar segments={preview.rarityShare} />
          </div>
        </Card>

        <Card title="Treasury impact">
          <Metric
            label="Spins currently fundable"
            value={spinsFundable.toLocaleString()}
            tone={spinsFundable === 0 ? 'danger' : spinsFundable < 50 ? 'brand' : 'default'}
            hint="Limited by the scarcest asset at its worst case"
          />

          <div className="mt-5">
            <div className="mb-2 text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
              Maximum liability per spin
            </div>
            <ul className="space-y-1.5 text-[0.8rem]">
              {preview.perSpinLiability.map((item) => {
                const held = vaultBalances[item.address.toLowerCase()]
                const token = tokenByAddress(item.address)
                const heldAmount =
                  held && token ? unitsToNumber(BigInt(held), token.decimals) : 0
                const short = heldAmount < item.amount
                return (
                  <li key={item.address} className="flex items-baseline justify-between gap-3">
                    <span className="num text-foreground-secondary">{item.symbol}</span>
                    <span className={cn('num', short ? 'text-danger' : 'text-foreground')}>
                      {formatTokenAmount(item.amount)}
                      <span className="text-foreground-muted"> / {formatTokenAmount(heldAmount)} held</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
              Expected payout per spin
            </div>
            <ul className="space-y-1.5 text-[0.8rem]">
              {preview.expectedPerSpin.map((item) => (
                <li key={item.symbol} className="flex items-baseline justify-between gap-3">
                  <span className="num text-foreground-secondary">{item.symbol}</span>
                  <span className="num text-foreground">{formatTokenAmount(item.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-foreground-muted">
              Token terms only. A dollar expectation would depend on a price feed, and no price feed
              is allowed anywhere near settlement.
            </p>
          </div>
        </Card>

        <Card title="Publish">
          <p className="text-[0.82rem] leading-relaxed text-foreground-secondary">
            Publishing creates a new immutable version. Existing versions are never edited, so spins
            already in flight keep resolving against the table they were sold.
          </p>
          <Button className="mt-4 w-full" disabled>
            Publish new version
          </Button>
          <p className="mt-2.5 text-[0.72rem] leading-relaxed text-foreground-muted">
            Disabled here by design: publishing is an onchain transaction signed by the operator
            wallet holding <code className="num">OPERATOR_ROLE</code>. Export this draft and run{' '}
            <code className="num">PublishTable.s.sol</code> — see DEPLOYMENT.md.
          </p>
          <details className="mt-4">
            <summary className="cursor-pointer text-[0.76rem] text-foreground-muted hover:text-foreground-secondary">
              Export draft as JSON
            </summary>
            <pre className="num mt-2 max-h-56 overflow-auto rounded-[8px] border border-border bg-surface-sunken p-3 text-[0.68rem] leading-relaxed text-foreground-secondary">
              {JSON.stringify(
                {
                  prizes: rows.map((r) => ({
                    token: r.token,
                    amount: r.amountUnits,
                    weight: r.weight,
                    rarity: r.rarity,
                  })),
                },
                null,
                2,
              )}
            </pre>
          </details>
        </Card>
      </div>
    </div>
  )
}

/** Loads an existing machine's table as a starting point. */
function seedFrom(machineId: string): Row[] {
  const machine = machines.find((m) => m.id === machineId) ?? machines[0]
  return machine.prizes.map((prize) => ({
    token: prize.token,
    amountInput: String(prize.amount),
    amountUnits: prize.amountUnits,
    weight: prize.weight,
    rarity: rarityIndex(prize.rarity),
  }))
}
