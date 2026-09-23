import { PageHeader, Card, StatusPill } from '@/components/admin/AdminPrimitives'
import { OddsBar } from '@/components/ui/OddsBar'
import { machines, rarityBreakdown } from '@/lib/machine'
import { formatPercent, shortHash } from '@/lib/format'
import { contractsConfigured } from '@/lib/env'

export const dynamic = 'force-dynamic'

export default function AdminMachines() {
  return (
    <>
      <PageHeader
        title="Machines"
        description="Tier configuration: price, the prize-table version each tier points at, and whether it is accepting spins. Repointing a tier is an onchain transaction; it never touches a spin already in flight."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {machines.map((machine) => (
          <Card key={machine.id} title={machine.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="num font-display text-[1.8rem] font-extrabold tracking-[-0.045em] text-foreground">
                {machine.priceBnb}
                <span className="ml-1 text-[0.8rem] font-normal text-foreground-muted">BNB</span>
              </span>
              <StatusPill status={contractsConfigured ? 'HEALTHY' : 'PAUSED'} />
            </div>

            <dl className="mt-5 space-y-2 text-[0.8rem]">
              <Row label="Tier id" value={String(machine.tierId)} />
              <Row label="Price (wei)" value={machine.priceWei.toString()} />
              <Row label="Prize entries" value={String(machine.prizes.length)} />
              <Row
                label="Distinct assets"
                value={String(new Set(machine.prizes.map((p) => p.token.toLowerCase())).size)}
              />
              <Row label="Total weight" value={machine.totalWeight.toLocaleString()} />
              <Row label="Table hash" value={shortHash(machine.localTableHash, 8, 6)} />
              <Row label="Reference RTP" value={formatPercent(machine.referenceReturnToPlayer, 1)} />
            </dl>

            <div className="mt-6">
              <OddsBar segments={rarityBreakdown(machine)} />
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-[0.78rem] leading-relaxed text-foreground-muted">
        Reference RTP is computed from prices captured when the table was authored. It is a design
        aid for the operator and is never shown to players as a promise — prices move, and the
        contract settles token amounts, not value.
      </p>
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
