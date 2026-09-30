import { PageHeader, Card, Metric, StatusPill, EmptyNotice } from '@/components/admin/AdminPrimitives'
import { readBankroll } from '@/lib/admin/vault'
import { contractsConfigured, publicEnv } from '@/lib/env'
import { explorer } from '@/lib/chain'
import { formatBnb, shortAddress } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Bankroll health.
 *
 * The game holds one asset, BNB. "Obligations" is everything it owes right
 * now — the reserve behind every spin still waiting on randomness plus every
 * settled prize not yet delivered. The balance above that is the only thing a
 * treasurer may withdraw, and the contract enforces that independently of
 * this page.
 */
export default async function AdminVault() {
  const bankroll = await readBankroll()

  const balance = BigInt(bankroll.balanceWei)
  const obligations = BigInt(bankroll.obligationsWei)
  const covered = balance >= obligations

  const rows = bankroll.tiers.map((tier) => {
    const price = BigInt(tier.priceWei)
    const maxValue = BigInt(tier.maxValueWei)
    const perSpin = maxValue > price ? maxValue - price : 0n
    // With the price covering the biggest prize a spin never draws on free
    // bankroll; the contract then divides by one wei, so the raw count is noise.
    const unlimited = perSpin === 0n
    const spins = BigInt(tier.remainingFundedSpins)

    const status: 'HEALTHY' | 'LOW' | 'PAUSED' | 'UNFUNDED' = !tier.active
      ? 'PAUSED'
      : unlimited
        ? 'HEALTHY'
        : spins === 0n
          ? 'UNFUNDED'
          : spins < 50n
            ? 'LOW'
            : 'HEALTHY'

    return { tier, perSpin, unlimited, spins, status }
  })

  const fundable = rows.filter((r) => r.tier.active && !r.unlimited).map((r) => r.spins)
  const weakest = fundable.length > 0 ? fundable.reduce((a, b) => (b < a ? b : a)) : null

  return (
    <>
      <PageHeader
        title="Bankroll"
        description="What the machine can pay. Every figure here is read from chain; nothing is cached or estimated."
        action={
          publicEnv.gameAddress ? (
            <a
              href={explorer.address(publicEnv.gameAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="num text-[0.8rem] text-foreground-secondary underline decoration-border underline-offset-4 hover:text-foreground"
            >
              {shortAddress(publicEnv.gameAddress, 6, 6)}
            </a>
          ) : null
        }
      />

      {!contractsConfigured ? (
        <EmptyNotice
          title="No game deployed."
          body="The bankroll is read directly from the game contract. Deploy and set NEXT_PUBLIC_BACHA_GAME_ADDRESS to see real balances here — this page will not show a placeholder bankroll."
        />
      ) : !bankroll.available ? (
        <EmptyNotice
          title="Could not read the bankroll."
          body="The RPC endpoint did not respond. This page shows nothing rather than a stale or invented balance."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <Metric label="Balance" value={`${formatBnb(balance)} BNB`} hint="Held by BachaGame" />
            </Card>
            <Card>
              <Metric
                label="Obligations"
                value={`${formatBnb(obligations)} BNB`}
                tone={covered ? 'default' : 'danger'}
                hint={`${formatBnb(BigInt(bankroll.pendingReserveWei))} reserved · ${formatBnb(BigInt(bankroll.settledOwedWei))} owed`}
              />
            </Card>
            <Card>
              <Metric
                label="Withdrawable"
                value={`${formatBnb(BigInt(bankroll.withdrawableWei))} BNB`}
                hint="Balance above every obligation"
              />
            </Card>
            <Card>
              <Metric
                label="Spins fundable"
                value={weakest === null ? 'Unlimited' : weakest.toLocaleString()}
                tone={weakest === null ? 'default' : weakest === 0n ? 'danger' : weakest < 50n ? 'brand' : 'default'}
                hint="Across the weakest active tier"
              />
            </Card>
          </div>

          <Card title="Tiers">
            {rows.length === 0 ? (
              <EmptyNotice
                title="No tiers configured."
                body="The game has no tiers yet, so it cannot accept a spin. Publish a prize table and configure a tier to point at it."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-[0.82rem]">
                  <thead>
                    <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                      <th className="pb-3 font-normal">Tier</th>
                      <th className="pb-3 text-right font-normal">Price</th>
                      <th className="pb-3 text-right font-normal">Version</th>
                      <th className="pb-3 text-right font-normal">Max prize</th>
                      <th className="pb-3 text-right font-normal">Bankroll per spin</th>
                      <th className="pb-3 text-right font-normal">Remaining funded spins</th>
                      <th className="pb-3 text-right font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ tier, perSpin, unlimited, spins, status }) => (
                      <tr key={tier.tierId} className="border-t border-border">
                        <td className="py-3">
                          <span className="num text-foreground-muted">{tier.tierId}</span>
                          <span className="ml-2.5 font-medium text-foreground">{tier.label}</span>
                        </td>
                        <td className="num py-3 text-right text-foreground-secondary">
                          {formatBnb(BigInt(tier.priceWei))} BNB
                        </td>
                        <td className="num py-3 text-right text-foreground-secondary">v{tier.versionId}</td>
                        <td className="num py-3 text-right text-foreground-secondary">
                          {formatBnb(BigInt(tier.maxValueWei))} BNB
                        </td>
                        <td className="num py-3 text-right text-foreground-secondary">
                          {unlimited ? '—' : `${formatBnb(perSpin)} BNB`}
                        </td>
                        <td className="num py-3 text-right text-foreground">
                          {unlimited ? 'Unlimited' : spins.toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          <StatusPill status={status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <p className="mt-4 max-w-3xl text-[0.78rem] leading-relaxed text-foreground-muted">
        Withdrawals are limited by the contract, not by this page: the game subtracts everything
        owed — settled, undelivered prizes plus the reserve behind every pending spin — before
        allowing a treasurer to take anything out, and refuses a new spin unless the balance covers
        all of it. Funding is permissionless; anyone may call <code className="num">fund()</code>{' '}
        and gains no claim by doing so.
      </p>
    </>
  )
}
