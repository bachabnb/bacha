'use client'

import { useTranslations } from 'next-intl'
import { SectionLabel } from './HowProduced'
import { BnbChainMark } from '@/components/brand/BnbChain'
import { publicEnv, contractsConfigured } from '@/lib/env'
import { explorer, networkLabel, vrfCoordinators } from '@/lib/chain'
import { shortAddress } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Deployment status, stated plainly.
 *
 * This is the one page where "not deployed" has to be unmistakable — a
 * transparency page that implied a live contract would be worse than no page
 * at all. Addresses are only rendered when they exist; there are no
 * placeholders that could be mistaken for a deployment.
 */
export function ContractsPanel() {
  const t = useTranslations('fairness.contracts')
  const vrf = vrfCoordinators[publicEnv.chainId]

  const strip = [
    { label: t('strip.network'), value: networkLabel, chain: true },
    { label: t('strip.chainId'), value: String(publicEnv.chainId) },
    {
      label: t('strip.game'),
      value: publicEnv.gameAddress ? t('strip.deployed') : t('strip.notDeployed'),
      ok: Boolean(publicEnv.gameAddress),
    },
    {
      label: t('strip.vault'),
      value: publicEnv.vaultAddress ? t('strip.deployed') : t('strip.notDeployed'),
      ok: Boolean(publicEnv.vaultAddress),
    },
    {
      label: t('strip.randomness'),
      value: contractsConfigured ? t('strip.vrf') : t('strip.simulated'),
      ok: contractsConfigured,
    },
    {
      label: t('strip.source'),
      value: contractsConfigured ? t('strip.verified') : t('strip.notDeployed'),
      ok: contractsConfigured,
    },
  ]

  return (
    <section id="contracts" className="scroll-mt-28">
      <SectionLabel index="03" />
      <h2 className="type-section mt-3 font-display font-extrabold text-foreground">{t('title')}</h2>

      {!contractsConfigured && (
        <div className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft p-5">
          <p className="text-[0.92rem] font-semibold text-warning">{t('demoTitle')}</p>
          <p className="mt-2 max-w-2xl text-[0.86rem] leading-relaxed text-foreground-secondary">
            {t('demoBody')}
          </p>
        </div>
      )}

      {/* ---------------------------------------------------- status strip */}
      <dl className="mt-6 grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {strip.map((cell) => (
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

      {/* ----------------------------------------------------------- cards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ContractCard
          name={t('game.name')}
          role={t('game.role')}
          address={publicEnv.gameAddress}
          source="https://github.com/bachabnb/bacha/blob/main/contracts/src/BachaGame.sol"
        />
        <ContractCard
          name={t('vault.name')}
          role={t('vault.role')}
          address={publicEnv.vaultAddress}
          source="https://github.com/bachabnb/bacha/blob/main/contracts/src/BachaVault.sol"
        />
        <ContractCard
          name={t('vrf.name')}
          role={t('vrf.role')}
          address={vrf?.address}
          source={vrf?.docs}
          external
        />
      </div>
    </section>
  )
}

function ContractCard({
  name,
  role,
  address,
  source,
  external,
}: {
  name: string
  role: string
  address?: string
  source?: string
  external?: boolean
}) {
  const t = useTranslations('fairness.contracts')
  const deployed = Boolean(address)

  return (
    <article className="card-physical flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[1.12rem] font-bold tracking-[-0.03em] text-foreground">
          {name}
        </h3>
        <span
          className={cn(
            'shrink-0 rounded-[5px] border px-1.5 py-[3px] font-mono text-[0.58rem] uppercase tracking-[0.12em]',
            deployed
              ? 'border-success/35 bg-success-soft text-success'
              : 'border-border-strong text-foreground-muted',
          )}
        >
          {deployed ? t('verified') : t('notDeployed')}
        </span>
      </div>

      <p className="mt-2.5 text-[0.82rem] leading-relaxed text-foreground-secondary">{role}</p>

      <dl className="mt-4 space-y-2 border-t border-border pt-3.5 text-[0.78rem]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-foreground-muted">{t('address')}</dt>
          <dd className="num truncate text-foreground">
            {address ? shortAddress(address, 6, 6) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-foreground-muted">{t('network')}</dt>
          <dd className="num truncate text-foreground-secondary">{networkLabel}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {address && (
          <a
            href={explorer.address(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-[9px] border border-border bg-background px-3 text-[0.76rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t('bscscan')}
          </a>
        )}
        {source && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-[9px] border border-border bg-background px-3 text-[0.76rem] font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {external ? t('vrf.name').split(' ')[0] : t('source')}
          </a>
        )}
      </div>
    </article>
  )
}
