import { PageHeader, Card, StatusPill } from '@/components/admin/AdminPrimitives'
import { publicEnv, contractsConfigured, spinMode } from '@/lib/env'
import { adminWallets } from '@/lib/admin/auth'
import { beacon, networkLabel } from '@/lib/chain'
import { shortAddress } from '@/lib/format'
import { tokenRegistryVersion } from '@/lib/tokens'
import { machineConfigGeneratedAt } from '@/lib/machine'

export const dynamic = 'force-dynamic'

/**
 * Settings is read-only on purpose.
 *
 * Everything that matters here is either an environment variable (changed at
 * deploy time, never from a web form) or an onchain role (changed by a
 * transaction the multisig signs). A console that could flip a pause switch
 * with a cookie would be the weakest link in the whole system.
 */
export default function AdminSettings() {
  const vrf = beacon
  const wallets = adminWallets()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Deployment configuration, shown as it actually resolves on this server. Changing any of it means a redeploy or an onchain transaction — deliberately not a form on this page."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Chain">
          <dl className="space-y-3 text-[0.82rem]">
            <Row label="Network" value={networkLabel} />
            <Row label="Chain ID" value={String(publicEnv.chainId)} />
            <Row label="RPC" value={publicEnv.rpcUrl} />
            <Row label="Settlement mode" value={spinMode === 'onchain' ? 'Onchain (commit–reveal)' : 'Demo (simulated)'} />
          </dl>
        </Card>

        <Card title="Contracts">
          <dl className="space-y-3 text-[0.82rem]">
            <Row label="BachaGame" value={publicEnv.gameAddress ?? 'Not set'} />
            <Row label="BachaVault" value={publicEnv.vaultAddress ?? 'Not set'} />
            <Row label="Randomness beacon" value={vrf.address ?? 'Not deployed'} />
          </dl>
          <div className="mt-4">
            <StatusPill status={contractsConfigured ? 'HEALTHY' : 'UNFUNDED'} />
          </div>
        </Card>

        <Card title="Configuration">
          <dl className="space-y-3 text-[0.82rem]">
            <Row label="Token registry version" value={String(tokenRegistryVersion)} />
            <Row label="Machine config generated" value={machineConfigGeneratedAt} />
            <Row label="WalletConnect" value={publicEnv.walletConnectProjectId ? 'Configured' : 'Not configured'} />
          </dl>
        </Card>

        <Card title="Operator wallets">
          {wallets.length > 0 ? (
            <ul className="space-y-2 text-[0.82rem]">
              {wallets.map((wallet) => (
                <li key={wallet} className="num text-foreground-secondary">
                  {shortAddress(wallet, 8, 6)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.82rem] leading-relaxed text-foreground-secondary">
              No operator wallets listed. Set <code className="num">BACHA_ADMIN_ADDRESSES</code> to
              record which wallets are expected to execute admin transactions.
            </p>
          )}
          <p className="mt-4 text-[0.74rem] leading-relaxed text-foreground-muted">
            This list is documentation, not access control. Authority lives in{' '}
            <code className="num">DEFAULT_ADMIN_ROLE</code> and{' '}
            <code className="num">OPERATOR_ROLE</code> on the contracts, which should be held by a
            multisig in production rather than any single key.
          </p>
        </Card>
      </div>

      <Card title="Emergency pause" className="mt-4">
        <p className="text-[0.86rem] leading-relaxed text-foreground-secondary">
          Pausing stops new spins immediately. It does not touch spins already in flight: those keep
          their locked prize table, settle normally when randomness arrives, and remain claimable.
        </p>
        <p className="mt-3 text-[0.8rem] leading-relaxed text-foreground-muted">
          Execute with the operator wallet:{' '}
          <code className="num">cast send $BACHA_GAME_ADDRESS &quot;pause()&quot;</code>. It is
          deliberately not wired to a button here — a pause should require the same key custody as
          any other privileged action, not a session cookie.
        </p>
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
