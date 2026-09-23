import { PageHeader, Card, EmptyNotice } from '@/components/admin/AdminPrimitives'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { listDemoSpins } from '@/lib/demo/store'
import { listOnchainSpins } from '@/lib/onchain/spins'
import { tokenByAddress } from '@/lib/tokens'
import { machineById } from '@/lib/machine'
import { spinMode } from '@/lib/env'
import { shortAddress, shortHash, formatTokenAmount, formatBnb } from '@/lib/format'
import type { SpinRecord } from '@/lib/spin/types'

export const dynamic = 'force-dynamic'

export default async function AdminSpins() {
  let spins: SpinRecord[] = []
  let failed = false

  try {
    spins =
      spinMode === 'onchain'
        ? (await listOnchainSpins({ limit: 100 })).spins
        : listDemoSpins({ limit: 100 }).spins
  } catch {
    failed = true
  }

  const pending = spins.filter((s) => s.status === 'PENDING')
  const unclaimed = spins.filter((s) => s.status === 'SETTLED')

  return (
    <>
      <PageHeader
        title="Spins"
        description={
          spinMode === 'onchain'
            ? 'Read from contract events. Pending spins are waiting on VRF; settled-unclaimed spins are owed a payout the vault is already holding.'
            : 'Simulated spins from the local demo store. These are not transactions and settle no value.'
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat label="Recorded" value={spins.length} />
        </Card>
        <Card>
          <Stat label="Pending randomness" value={pending.length} />
        </Card>
        <Card>
          <Stat label="Settled, unclaimed" value={unclaimed.length} />
        </Card>
      </div>

      <Card>
        {failed ? (
          <EmptyNotice
            title="Could not read spins."
            body="The RPC endpoint did not respond. This page shows nothing rather than a stale or invented list."
          />
        ) : spins.length === 0 ? (
          <EmptyNotice
            title="No spins yet."
            body="Spins appear here as soon as one is paid for."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-[0.82rem]">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                  <th className="pb-3 font-normal">#</th>
                  <th className="pb-3 font-normal">Player</th>
                  <th className="pb-3 font-normal">Machine</th>
                  <th className="pb-3 font-normal">Version</th>
                  <th className="pb-3 font-normal">Paid</th>
                  <th className="pb-3 font-normal">Reward</th>
                  <th className="pb-3 font-normal">Rarity</th>
                  <th className="pb-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {spins.slice(0, 60).map((spin) => {
                  const token = spin.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined
                  const machine = machineById(spin.machineId)
                  return (
                    <tr key={spin.id} className="border-t border-border">
                      <td className="num py-3 text-foreground-muted">{spin.id}</td>
                      <td className="num py-3 text-foreground-secondary">{shortAddress(spin.player)}</td>
                      <td className="py-3 text-foreground-secondary">{machine?.label ?? `T${spin.tierId}`}</td>
                      <td className="num py-3 text-foreground-muted">{spin.machineVersion}</td>
                      <td className="num py-3 text-foreground-secondary">
                        {formatBnb(BigInt(spin.paymentWei), 4)}
                      </td>
                      <td className="py-3">
                        {token && spin.rewardAmount != null ? (
                          <span className="flex items-center gap-2">
                            <TokenMark token={token} size={20} />
                            <span className="num text-foreground">
                              {formatTokenAmount(spin.rewardAmount, token.symbol)}
                            </span>
                          </span>
                        ) : (
                          <span className="num text-foreground-muted">
                            {spin.requestId ? shortHash(spin.requestId, 6, 3) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-3">{spin.rarity && <RarityChip rarity={spin.rarity} />}</td>
                      <td className="num py-3 text-right text-foreground-secondary">{spin.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{label}</div>
      <div className="num mt-1.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-foreground">
        {value}
      </div>
    </div>
  )
}
