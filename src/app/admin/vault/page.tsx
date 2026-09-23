import { PageHeader, Card, Metric, StatusPill, EmptyNotice } from '@/components/admin/AdminPrimitives'
import { TokenMark } from '@/components/ui/TokenMark'
import { readVaultBalances } from '@/lib/admin/vault'
import { rewardTokens } from '@/lib/tokens'
import { machines } from '@/lib/machine'
import { fundableSpins, previewTable } from '@/lib/admin/preview'
import { rarityIndex } from '@/lib/rarity'
import { unitsToNumber, formatTokenAmount } from '@/lib/format'
import { contractsConfigured, publicEnv } from '@/lib/env'
import { explorer } from '@/lib/chain'
import { shortAddress } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Reserve health.
 *
 * "Available" is what the vault holds. "Reserved" is the worst case owed to
 * every machine at once — every in-flight spin landing on that asset's largest
 * entry. The gap between them is the only thing a treasurer may withdraw, and
 * the contract enforces that independently of this page.
 */
export default async function AdminVault() {
  const balances = await readVaultBalances()
  const tokens = rewardTokens()

  const previews = machines.map((machine) => ({
    machine,
    preview: previewTable(
      machine.prizes.map((p) => ({
        token: p.token,
        amountUnits: p.amountUnits,
        weight: p.weight,
        rarity: rarityIndex(p.rarity),
      })),
    ),
  }))

  const rows = tokens.map((token) => {
    const key = token.address.toLowerCase()
    const heldUnits = BigInt(balances[key] ?? '0')
    const held = unitsToNumber(heldUnits, token.decimals)

    // Worst case across every machine that can drop this asset.
    let perSpinUnits = 0n
    for (const { preview } of previews) {
      const item = preview.perSpinLiability.find((l) => l.address.toLowerCase() === key)
      if (item) {
        const units = BigInt(item.amountUnits)
        if (units > perSpinUnits) perSpinUnits = units
      }
    }
    const perSpin = unitsToNumber(perSpinUnits, token.decimals)
    const spins = perSpinUnits > 0n ? Number(heldUnits / perSpinUnits) : 0

    const status: 'HEALTHY' | 'LOW' | 'UNFUNDED' =
      perSpinUnits === 0n ? 'HEALTHY' : spins === 0 ? 'UNFUNDED' : spins < 50 ? 'LOW' : 'HEALTHY'

    return { token, held, perSpin, spins, status }
  })

  const worstMachine = Math.min(
    ...previews.map(({ preview }) => fundableSpins(preview.perSpinLiability, balances)),
  )

  return (
    <>
      <PageHeader
        title="Vault"
        description="What the machine can pay. Every figure here is read from chain; nothing is cached or estimated."
        action={
          publicEnv.vaultAddress ? (
            <a
              href={explorer.address(publicEnv.vaultAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="num text-[0.8rem] text-foreground-secondary underline decoration-border underline-offset-4 hover:text-foreground"
            >
              {shortAddress(publicEnv.vaultAddress, 6, 6)}
            </a>
          ) : null
        }
      />

      {!contractsConfigured ? (
        <EmptyNotice
          title="No vault deployed."
          body="Reserve health is read directly from the vault contract. Deploy and configure BACHA_VAULT_ADDRESS to see real balances here — this page will not show placeholder inventory."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card>
              <Metric
                label="Spins fundable"
                value={Number.isFinite(worstMachine) ? worstMachine.toLocaleString() : '0'}
                tone={worstMachine === 0 ? 'danger' : worstMachine < 50 ? 'brand' : 'default'}
                hint="Across the weakest machine"
              />
            </Card>
            <Card>
              <Metric label="Approved assets" value={tokens.length} />
            </Card>
            <Card>
              <Metric
                label="Assets unfunded"
                value={rows.filter((r) => r.status === 'UNFUNDED').length}
                tone={rows.some((r) => r.status === 'UNFUNDED') ? 'danger' : 'default'}
              />
            </Card>
          </div>

          <Card title="Reserve health">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[0.82rem]">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                    <th className="pb-3 font-normal">Token</th>
                    <th className="pb-3 text-right font-normal">Available</th>
                    <th className="pb-3 text-right font-normal">Reserved per spin</th>
                    <th className="pb-3 text-right font-normal">Remaining funded spins</th>
                    <th className="pb-3 text-right font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ token, held, perSpin, spins, status }) => (
                    <tr key={token.address} className="border-t border-border">
                      <td className="py-3">
                        <span className="flex items-center gap-2.5">
                          <TokenMark token={token} size={24} />
                          <span className="num text-foreground">{token.symbol}</span>
                        </span>
                      </td>
                      <td className="num py-3 text-right text-foreground-secondary">
                        {formatTokenAmount(held)}
                      </td>
                      <td className="num py-3 text-right text-foreground-secondary">
                        {perSpin > 0 ? formatTokenAmount(perSpin) : '—'}
                      </td>
                      <td className="num py-3 text-right text-foreground">
                        {perSpin > 0 ? spins.toLocaleString() : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <StatusPill status={status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <p className="mt-4 max-w-3xl text-[0.78rem] leading-relaxed text-foreground-muted">
        Withdrawals are limited by the contract, not by this page: the vault subtracts everything
        owed — settled-unclaimed prizes plus the worst case for every pending spin — before allowing
        a treasurer to take anything out. Funding is permissionless; anyone may top the vault up and
        gains no claim by doing so.
      </p>
    </>
  )
}
