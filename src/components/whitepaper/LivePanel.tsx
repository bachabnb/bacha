import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { TokenMark } from '@/components/ui/TokenMark'
import { BnbChainMark } from '@/components/brand/BnbChain'
import { machines } from '@/lib/machine'
import { rewardTokens } from '@/lib/tokens'
import { publicEnv, contractsConfigured } from '@/lib/env'
import { explorer, networkLabel, beacon } from '@/lib/chain'
import { shortAddress, formatPercent } from '@/lib/format'
import { RARITIES } from '@/lib/rarity'
import { cn } from '@/lib/cn'
import type { Block } from '@/content/whitepaper/types'

/**
 * Renders application state inside the paper.
 *
 * The content modules never write a deployment status, an address or a price.
 * They mark the spot and these panels fill it from the same sources the rest
 * of the app reads, so the paper cannot claim something is deployed after it
 * stops being, or quote a machine price that has since changed.
 */
export async function LivePanel({ kind }: { kind: Extract<Block, { t: 'live' }>['kind'] }) {
  switch (kind) {
    case 'deployment':
      return <DeploymentMatrix />
    case 'machines':
      return <MachinesPanel />
    case 'contracts':
      return <ContractsPanel />
    case 'tokens':
      return <TokensPanel />
    case 'odds-link':
      return <OddsLink />
  }
}

/* ------------------------------------------------------------------ status */

async function DeploymentMatrix() {
  const t = await getTranslations('fairness.contracts.strip')

  const cells = [
    { label: t('network'), value: networkLabel, chain: true },
    { label: t('chainId'), value: String(publicEnv.chainId) },
    {
      label: t('game'),
      value: publicEnv.gameAddress ? t('deployed') : t('notDeployed'),
      ok: Boolean(publicEnv.gameAddress),
    },
    {
      label: t('vault'),
      value: publicEnv.vaultAddress ? t('deployed') : t('notDeployed'),
      ok: Boolean(publicEnv.vaultAddress),
    },
    {
      label: t('randomness'),
      value: contractsConfigured ? t('commitReveal') : t('simulated'),
      ok: contractsConfigured,
    },
    {
      label: t('source'),
      value: contractsConfigured ? t('verified') : t('notDeployed'),
      ok: contractsConfigured,
    },
  ]

  return (
    <dl className="wp-block grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-surface px-4 py-3.5">
          <dt className="text-[0.58rem] uppercase tracking-[0.16em] text-foreground-muted">
            {cell.label}
          </dt>
          <dd
            className={cn(
              'mt-1.5 flex items-center gap-1.5 truncate text-[0.84rem] font-medium',
              cell.ok === undefined
                ? 'text-foreground'
                : cell.ok
                  ? 'text-success'
                  : 'text-foreground-muted',
            )}
          >
            {cell.chain && <BnbChainMark className="h-[14px] w-3" />}
            <span className="truncate">{cell.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------------------------------------------------------------- machines */

async function MachinesPanel() {
  const t = await getTranslations('whitepaper.live')
  const r = await getTranslations('rarity')

  return (
    <div className="wp-block overflow-hidden rounded-[14px] border border-border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-surface">
            {[t('machine'), t('price'), t('entries'), t('distribution')].map((head) => (
              <th
                key={head}
                className="px-4 py-3 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-foreground-muted"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {machines.map((machine) => (
            <tr key={machine.id} className="border-b border-border last:border-0">
              <td className="px-4 py-4">
                <span className="block text-[0.9rem] font-semibold text-foreground">
                  {machine.label}
                </span>
                <span className="block text-[0.76rem] text-foreground-muted">{machine.tagline}</span>
              </td>
              <td className="num whitespace-nowrap px-4 py-4 text-[0.86rem] text-foreground">
                {machine.priceBnb} BNB
              </td>
              <td className="num px-4 py-4 text-[0.86rem] text-foreground-secondary">
                {machine.prizes.length}
              </td>
              <td className="px-4 py-4">
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {RARITIES.map((rarity, i) => (
                    <span key={rarity} className="num text-[0.72rem] text-foreground-secondary">
                      <span className="text-foreground-muted">{r(rarity)} </span>
                      {formatPercent(machine.rarityShare[i] ?? 0, 1)}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------------------------------------------------------- contracts */

async function ContractsPanel() {
  const t = await getTranslations('whitepaper.live')

  const rows = [
    { name: 'BachaGame', address: publicEnv.gameAddress },
    { name: 'BachaVault', address: publicEnv.vaultAddress },
    { name: 'BachaRandomness', address: beacon.address },
  ]

  return (
    <div className="wp-block grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.name} className="bg-surface px-4 py-4">
          <p className="num text-[0.82rem] font-semibold text-foreground">{row.name}</p>
          {row.address ? (
            <a
              href={explorer.address(row.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="num mt-1.5 block text-[0.76rem] text-brand underline-offset-2 hover:underline"
            >
              {shortAddress(row.address, 6, 4)}
            </a>
          ) : (
            <p className="mt-1.5 text-[0.76rem] text-foreground-muted">{t('notDeployed')}</p>
          )}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ tokens */

async function TokensPanel() {
  const t = await getTranslations('whitepaper.live')
  const tokens = rewardTokens()

  return (
    <div className="wp-block">
      <ul className="grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-2">
        {tokens.map((token) => (
          <li key={token.address} className="flex items-center gap-3 bg-surface px-4 py-3">
            <TokenMark token={token} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.85rem] font-medium text-foreground">
                {token.name}
              </span>
              <a
                href={explorer.token(token.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="num block truncate text-[0.7rem] text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                {token.address}
              </a>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.74rem] text-foreground-muted">
        {t('tokensNote', { count: tokens.length })}
      </p>
    </div>
  )
}

/* --------------------------------------------------------------- odds link */

async function OddsLink() {
  const t = await getTranslations('whitepaper.live')

  return (
    <Link
      href="/fairness#odds"
      className="wp-block group flex items-center justify-between gap-4 rounded-[14px] border border-brand-line bg-brand-soft px-5 py-4 transition-colors hover:border-brand"
    >
      <span>
        <span className="block text-[0.9rem] font-semibold text-foreground">{t('oddsTitle')}</span>
        <span className="mt-0.5 block text-[0.8rem] text-foreground-secondary">{t('oddsBody')}</span>
      </span>
      <span aria-hidden className="text-brand transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  )
}
