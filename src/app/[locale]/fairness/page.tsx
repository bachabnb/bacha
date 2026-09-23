import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SpinVerifier } from '@/components/fairness/SpinVerifier'
import { OddsBar } from '@/components/ui/OddsBar'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { ArtImage } from '@/components/brand/ArtImage'
import { BnbChainMark } from '@/components/brand/BnbChain'
import { machines, rarityBreakdown } from '@/lib/machine'
import { tokenByAddress } from '@/lib/tokens'
import { publicEnv, contractsConfigured, spinMode } from '@/lib/env'
import { explorer, networkLabel, vrfCoordinators, isTestnet } from '@/lib/chain'
import { formatPercent, formatTokenAmount, shortAddress, shortHash } from '@/lib/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.fairness' })
  return { title: t('title'), description: t('description') }
}

const STEP_KEYS = ['one', 'two', 'three', 'four'] as const

export default async function FairnessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'fairness.page' })
  const v = await getTranslations({ locale, namespace: 'fairness' })
  const vrf = vrfCoordinators[publicEnv.chainId]

  return (
    <div className="shell-wide py-14 lg:py-20">
      <header className="grid gap-10 lg:grid-cols-[1.45fr_1fr] lg:items-center">
        <div className="max-w-2xl">
          <span className="eyebrow">{v('eyebrow')}</span>
          <h1 className="type-hero mt-4 font-display font-extrabold text-foreground">{t('title')}</h1>
          <p className="mt-5 max-w-xl text-[1rem] leading-relaxed text-foreground-secondary">{t('body')}</p>
        </div>
        <div className="relative mx-auto w-full max-w-[18rem] lg:max-w-none">
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[12%] rounded-full" />
          <ArtImage
            id="fairness-verify"
            alt={v('artAlt')}
            className="relative"
            sizes="(max-width: 1024px) 55vw, 24vw"
          />
        </div>
      </header>

      {/* ---------------------------------------------------------- verifier */}
      <section id="verify" className="mt-14 scroll-mt-24">
        <h2 className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
          {t('verifyHeading')}
        </h2>
        <div className="mt-4">
          <Suspense
            fallback={<div className="panel p-8 text-foreground-secondary">{v('verifier.checking')}</div>}
          >
            <SpinVerifier />
          </Suspense>
        </div>
      </section>

      {/* ------------------------------------------------------------- steps */}
      <section id="randomness" className="mt-20 scroll-mt-24">
        <h2 className="type-section font-display font-extrabold text-foreground">{t('howHeading')}</h2>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.45fr] lg:items-start lg:gap-12">
          <div className="relative mx-auto w-full max-w-[17rem] lg:sticky lg:top-24 lg:max-w-none">
            <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[10%] rounded-full" />
            <ArtImage
              id="machine-exploded"
              alt=""
              className="relative"
              sizes="(max-width: 1024px) 55vw, 24vw"
            />
          </div>

          <ol className="grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="bg-surface p-6 lg:p-7">
                <span aria-hidden className="index-numeral block text-[2.4rem]">
                  0{i + 1}
                </span>
                <h3 className="mt-4 font-display text-[1.18rem] font-bold tracking-[-0.03em] text-foreground">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="mt-3 text-[0.86rem] leading-relaxed text-foreground-secondary">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------- contracts */}
      <section id="contracts" className="mt-20 scroll-mt-24">
        <h2 className="type-section font-display font-extrabold text-foreground">{t('contractsHeading')}</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2">
          <ContractCell
            label="BachaGame"
            address={publicEnv.gameAddress}
            note={t('contracts.game')}
            notDeployed={t('contracts.notDeployed')}
          />
          <ContractCell
            label="BachaVault"
            address={publicEnv.vaultAddress}
            note={t('contracts.vault')}
            notDeployed={t('contracts.notDeployed')}
          />
          <ContractCell
            label="Chainlink VRF v2.5"
            address={vrf?.address}
            note={t('contracts.vrf')}
            external={vrf?.docs}
            externalLabel={t('contracts.chainlinkDocs')}
            notDeployed={t('contracts.notDeployed')}
          />
          <div className="bg-surface p-6">
            <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">
              {t('contracts.network')}
            </div>
            <div className="mt-2 flex items-center gap-2 font-display text-[1.1rem] font-bold tracking-[-0.03em] text-foreground">
              <BnbChainMark className="h-[18px] w-4" />
              {networkLabel}
            </div>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-foreground-secondary">
              {t('contracts.chainId', { id: publicEnv.chainId })}
              {isTestnet && ` — ${t('contracts.testnetNote')}`}
            </p>
          </div>
        </div>

        {!contractsConfigured && (
          <p className="mt-5 rounded-[10px] border border-warning/25 bg-warning-soft px-4 py-3.5 text-[0.84rem] leading-relaxed text-warning">
            {t('contracts.demoNotice')}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------- prize tables */}
      <section id="tables" className="mt-20 scroll-mt-24">
        <h2 className="type-section font-display font-extrabold text-foreground">{t('tablesHeading')}</h2>
        <p className="mt-4 max-w-2xl text-[0.92rem] leading-relaxed text-foreground-secondary">
          {t('tablesBody')}
        </p>

        <div className="mt-10 space-y-6">
          {machines.map((machine) => (
            <div key={machine.id} className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6">
                <div>
                  <h3 className="font-display text-[1.45rem] font-extrabold tracking-[-0.04em] text-foreground">
                    {machine.label}
                  </h3>
                  <p className="num mt-1 text-[0.74rem] text-foreground-muted">
                    {t('table.tierMeta', {
                      tier: machine.tierId,
                      price: machine.priceBnb,
                      weight: machine.totalWeight.toLocaleString(),
                    })}
                  </p>
                </div>
                <div className="min-w-[15rem] flex-1 sm:max-w-sm">
                  <OddsBar segments={rarityBreakdown(machine)} height={5} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-left">
                  <thead>
                    <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                      <th className="px-6 py-3 font-normal">{t('table.index')}</th>
                      <th className="px-6 py-3 font-normal">{t('table.asset')}</th>
                      <th className="px-6 py-3 font-normal">{t('table.amount')}</th>
                      <th className="px-6 py-3 font-normal">{t('table.baseUnits')}</th>
                      <th className="px-6 py-3 text-right font-normal">{t('table.weight')}</th>
                      <th className="px-6 py-3 text-right font-normal">{t('table.chance')}</th>
                      <th className="px-6 py-3 text-right font-normal">{t('table.rarity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machine.prizes.map((prize, i) => {
                      const token = tokenByAddress(prize.token)
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="num px-6 py-3 text-[0.74rem] text-foreground-muted">{i}</td>
                          <td className="px-6 py-3">
                            <span className="flex items-center gap-2.5">
                              {token && <TokenMark token={token} size={24} />}
                              <span className="num text-[0.82rem] text-foreground">{prize.symbol}</span>
                            </span>
                          </td>
                          <td className="num px-6 py-3 text-[0.82rem] text-foreground-secondary">
                            {formatTokenAmount(prize.amount)}
                          </td>
                          <td className="num px-6 py-3 text-[0.68rem] text-foreground-muted">
                            {prize.amountUnits}
                          </td>
                          <td className="num px-6 py-3 text-right text-[0.82rem] text-foreground-secondary">
                            {prize.weight}
                          </td>
                          <td className="num px-6 py-3 text-right text-[0.82rem] text-foreground">
                            {formatPercent(prize.weight / machine.totalWeight)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <RarityChip rarity={prize.rarity} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
                <span className="num text-[0.7rem] text-foreground-muted">
                  {spinMode === 'onchain' ? t('table.hash') : t('table.localHash')}{' '}
                  {shortHash(machine.localTableHash, 10, 8)}
                </span>
                <span className="num text-[0.7rem] text-foreground-muted">
                  {t('table.rtp', { value: formatPercent(machine.referenceReturnToPlayer, 1) })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ method */}
      <section className="mt-20">
        <h2 className="type-section font-display font-extrabold text-foreground">{t('methodHeading')}</h2>
        <p className="mt-4 max-w-2xl text-[0.92rem] leading-relaxed text-foreground-secondary">
          {t('methodBody')}
        </p>
        <pre className="mt-8 overflow-x-auto rounded-[14px] border border-border bg-surface-sunken p-6 text-[0.8rem] leading-relaxed text-foreground-secondary">
          <code>{`roll = randomWord % totalWeight
cumulative = 0
for entry in prizes:          # in published order
    cumulative += entry.weight
    if roll < cumulative:
        return entry          # exactly one prize, always`}</code>
        </pre>
        <p className="mt-4 max-w-2xl text-[0.78rem] leading-relaxed text-foreground-muted">
          {t('methodNote')}
        </p>
      </section>
    </div>
  )
}

function ContractCell({
  label,
  address,
  note,
  external,
  externalLabel,
  notDeployed,
}: {
  label: string
  address?: string
  note: string
  external?: string
  externalLabel?: string
  notDeployed: string
}) {
  return (
    <div className="bg-surface p-6">
      <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{label}</div>
      <div className="num mt-2 text-[0.92rem] text-foreground">
        {address ? (
          <a
            href={explorer.address(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-border-strong underline-offset-4 transition-colors hover:text-brand"
          >
            {shortAddress(address, 8, 6)}
          </a>
        ) : (
          <span className="text-foreground-muted">{notDeployed}</span>
        )}
      </div>
      <p className="mt-2 text-[0.78rem] leading-relaxed text-foreground-secondary">{note}</p>
      {external && (
        <a
          href={external}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[0.74rem] text-foreground-muted underline decoration-border underline-offset-4 hover:text-foreground-secondary"
        >
          {externalLabel}
        </a>
      )}
    </div>
  )
}
