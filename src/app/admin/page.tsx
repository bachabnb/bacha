import { PageHeader, Card, Metric, StatusPill } from '@/components/admin/AdminPrimitives'
import { machines, rosterTokens } from '@/lib/machine'
import { publicEnv, contractsConfigured, spinMode } from '@/lib/env'
import { networkLabel } from '@/lib/chain'
import { listDemoSpins } from '@/lib/demo/store'
import { formatPercent } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminOverview() {
  const roster = rosterTokens()
  const { total } = spinMode === 'demo' ? listDemoSpins({ limit: 1 }) : { total: 0 }

  return (
    <>
      <PageHeader
        title="Overview"
        description="The state of the machine right now: what is configured, what is running, and what would stop a spin being accepted."
      />

      {!contractsConfigured && (
        <div className="mb-6 rounded-[12px] border border-warning/30 bg-warning-soft px-5 py-4 text-[0.86rem] leading-relaxed text-warning">
          Contracts are not deployed on this deployment. The console shows the local configuration a
          deploy would publish; nothing here can be executed until{' '}
          <code className="num">NEXT_PUBLIC_BACHA_GAME_ADDRESS</code> and{' '}
          <code className="num">NEXT_PUBLIC_BACHA_VAULT_ADDRESS</code> are set.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Machine">
          <div className="grid grid-cols-2 gap-5">
            <Metric label="Machines" value={machines.length} />
            <Metric label="Reward assets" value={roster.length} />
            <Metric label="Prize entries" value={machines.reduce((s, m) => s + m.prizes.length, 0)} />
            <Metric label="Network" value={networkLabel} />
          </div>
        </Card>

        <Card title="Settlement">
          <div className="grid grid-cols-2 gap-5">
            <Metric
              label="Mode"
              value={spinMode === 'onchain' ? 'Onchain' : 'Demo'}
              tone={spinMode === 'onchain' ? 'brand' : 'default'}
              hint={spinMode === 'onchain' ? 'Chainlink VRF' : 'Simulated server-side'}
            />
            <Metric label="Chain ID" value={publicEnv.chainId} />
            <Metric label="Spins recorded" value={total} hint={spinMode === 'demo' ? 'Demo store' : 'From chain'} />
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">Status</div>
              <div className="mt-2">
                <StatusPill status={contractsConfigured ? 'HEALTHY' : 'UNFUNDED'} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Contracts">
          <dl className="space-y-3 text-[0.8rem]">
            <Row label="BachaGame" value={publicEnv.gameAddress ?? 'Not deployed'} />
            <Row label="BachaVault" value={publicEnv.vaultAddress ?? 'Not deployed'} />
            <Row label="RPC" value={publicEnv.rpcUrl} />
          </dl>
        </Card>
      </div>

      <Card title="Machines" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[0.82rem]">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                <th className="pb-3 font-normal">Tier</th>
                <th className="pb-3 font-normal">Label</th>
                <th className="pb-3 font-normal">Price</th>
                <th className="pb-3 font-normal">Entries</th>
                <th className="pb-3 font-normal">Assets</th>
                <th className="pb-3 text-right font-normal">Epic odds</th>
                <th className="pb-3 text-right font-normal">Reference RTP</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => (
                <tr key={machine.id} className="border-t border-border">
                  <td className="num py-3 text-foreground-muted">{machine.tierId}</td>
                  <td className="py-3 font-medium text-foreground">{machine.label}</td>
                  <td className="num py-3 text-foreground-secondary">{machine.priceBnb} BNB</td>
                  <td className="num py-3 text-foreground-secondary">{machine.prizes.length}</td>
                  <td className="num py-3 text-foreground-secondary">
                    {new Set(machine.prizes.map((p) => p.token.toLowerCase())).size}
                  </td>
                  <td className="num py-3 text-right text-brand">
                    {formatPercent(machine.rarityShare[3] ?? 0)}
                  </td>
                  <td className="num py-3 text-right text-foreground-secondary">
                    {formatPercent(machine.referenceReturnToPlayer, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-foreground-muted">{label}</dt>
      <dd className="num truncate text-foreground-secondary">{value}</dd>
    </div>
  )
}
