'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { BachaMachine, type MachineState, type MachineToken } from '@/components/brand/BachaMachine'
import { BachaGhostMark } from '@/components/brand/BachaLogo'
import { ControlConsole } from './ControlConsole'
import { ResultCard } from './ResultCard'
import { MachineStatusRow } from './MachineStatusRow'
import { RecentDropsRail } from './RecentDropsRail'
import { InsideMachine } from './InsideMachine'
import { SpinSettles } from './SpinSettles'
import { SessionPanel } from './SessionPanel'
import { DemoBanner } from './DemoBanner'
import { SoundToggle } from './SoundToggle'
import { useSound } from './SoundProvider'
import { useSpin } from '@/lib/spin/useSpin'
import { machines, machineById } from '@/lib/machine'
import { tokenByAddress } from '@/lib/tokens'
import { rarityStyle } from '@/lib/rarity'
import { contractsConfigured } from '@/lib/env'
import type { MarketQuote } from '@/lib/market'
import type { SpinRecord } from '@/lib/spin/types'

const PHASE_TO_MACHINE: Record<string, MachineState> = {
  idle: 'idle',
  confirming: 'arming',
  submitted: 'arming',
  settling: 'spinning',
  revealing: 'revealing',
  settled: 'result',
  claiming: 'result',
  claimed: 'result',
  error: 'idle',
}

/**
 * The play page.
 *
 * One machine stage: the object on the left, the console on the right, and the
 * result delivered beside the tray rather than in a modal over the page. Every
 * number on screen is read from the selected machine's real prize table, and
 * the page says out loud whether settlement is live or simulated.
 */
export function PlayClient({
  quotes,
  latest,
}: {
  quotes: Record<string, MarketQuote>
  latest: SpinRecord | null
}) {
  const t = useTranslations('play.stage')
  const params = useSearchParams()
  const reduce = useReducedMotion()

  const requested = params.get('machine')
  const [machineId, setMachineId] = useState(() =>
    requested && machineById(requested) ? requested : machines[0].id,
  )
  const machine = machineById(machineId) ?? machines[0]

  const { phase, record, txHash, error, spin, claim, reset, markRevealed } = useSpin()
  const { play } = useSound()

  useEffect(() => {
    if (phase === 'confirming') play('arm')
    if (phase === 'settling') play('spin')
    if (phase === 'revealing') play('drop')
  }, [phase, play])

  // The drop animation owns `revealing`; once the capsule has landed the
  // console stops looking busy.
  useEffect(() => {
    if (phase !== 'revealing') return
    const timer = setTimeout(markRevealed, 1200)
    return () => clearTimeout(timer)
  }, [phase, markRevealed])

  const chamberTokens: MachineToken[] = useMemo(() => {
    const seen = new Set<string>()
    const out: MachineToken[] = []
    for (const prize of machine.prizes) {
      const token = tokenByAddress(prize.token)
      if (!token || seen.has(token.id)) continue
      seen.add(token.id)
      out.push({ id: token.id, symbol: token.symbol, logo: token.logo })
    }
    return out
  }, [machine])

  const resultToken = record?.rewardTokenAddress ? tokenByAddress(record.rewardTokenAddress) : undefined
  const showResultCapsule =
    phase === 'revealing' || phase === 'settled' || phase === 'claiming' || phase === 'claimed'

  const rewardValueUsd = useMemo(() => {
    if (!record?.rewardTokenAddress || record.rewardAmount == null) return null
    const quote = quotes[record.rewardTokenAddress.toLowerCase()]
    return quote?.priceUsd != null ? quote.priceUsd * record.rewardAmount : null
  }, [record, quotes])

  const trayLabel =
    phase === 'settled' || phase === 'claiming' || phase === 'claimed' || phase === 'revealing'
      ? t('trayResult')
      : phase === 'settling'
        ? t('traySettling')
        : phase === 'confirming' || phase === 'submitted'
          ? t('trayArmed')
          : t('trayIdle')

  return (
    <>
      {/* ------------------------------------------------ machine stage */}
      <section data-zone="warm" className="canvas-atmosphere relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 construction-lines opacity-70" />
        <BachaGhostMark className="left-[-8%] top-[14%] hidden h-[32rem] w-[32rem] lg:block" />
        {/* The machine floor: a single line for the object to stand on. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 hidden lg:block"
          style={{
            top: '68%',
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, var(--border-strong) 18%, var(--border-strong) 82%, transparent)',
          }}
        />

        <div className="shell-wide play-stage relative pb-8 pt-3 lg:pb-10 lg:pt-4">
          <DemoBanner />

          <div className="play-grid mt-4">
            {/* ------------------------------------------------ machine */}
            <div className="relative min-w-0">
              <div className="min-w-0">
                <span className="eyebrow">{t('eyebrow')}</span>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-[2.4rem] font-extrabold leading-none tracking-[-0.05em] text-foreground lg:text-[2.9rem]">
                    {machine.label}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[0.66rem] font-medium uppercase tracking-[0.13em] text-foreground-secondary">
                    {contractsConfigured ? <span className="live-dot" /> : null}
                    {contractsConfigured ? t('live') : t('demo')}
                  </span>
                </div>
                <p className="mt-1.5 max-w-md text-[0.9rem] text-foreground-secondary">
                  {machine.tagline}
                </p>
              </div>

              <motion.div
                key={machine.id}
                initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="machine-frame relative mt-4"
              >
                <span
                  aria-hidden
                  className="atmosphere-glow pointer-events-none absolute inset-[-8%] rounded-[50%]"
                />
                <BachaMachine
                  state={PHASE_TO_MACHINE[phase] ?? 'idle'}
                  tokens={chamberTokens}
                  label={`BACHA · ${machine.label}`}
                  trayLabel={trayLabel}
                  result={
                    showResultCapsule && resultToken
                      ? {
                          logo: resultToken.logo,
                          symbol: resultToken.symbol,
                          finish: rarityStyle[record?.rarity ?? 'COMMON'].capsuleFinish,
                        }
                      : null
                  }
                  className="relative h-full"
                />
              </motion.div>

              {/* The result arrives where the capsule did. */}
              <div className="mx-auto mt-5 w-full max-w-[26rem]">
                <ResultCard
                  spin={record}
                  phase={phase}
                  valueUsd={rewardValueUsd}
                  onSpinAgain={() => {
                    reset()
                    void spin(machine.id)
                  }}
                  onClaim={() => void claim()}
                />
              </div>
            </div>

            {/* ------------------------------------------------ console */}
            <div className="min-w-0">
              <div className="mb-2 flex h-8 flex-wrap items-center justify-end gap-x-4">
                <SoundToggle />
                <Link
                  href="/fairness"
                  className="text-[0.8rem] text-foreground-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground"
                >
                  {t('fairness')}
                </Link>
                <Link
                  href="/fairness#randomness"
                  className="text-[0.8rem] text-foreground-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground"
                >
                  {t('howItWorks')}
                </Link>
              </div>

              <ControlConsole
                machine={machine}
                onSelectMachine={(id) => {
                  reset()
                  setMachineId(id)
                }}
                phase={phase}
                txHash={txHash}
                error={error}
                onSpin={() => void spin(machine.id)}
                onReset={reset}
              />
            </div>
          </div>

          <MachineStatusRow
            machine={machine}
            rewardCount={chamberTokens.length}
            latest={latest}
            className="mt-8"
          />
        </div>
      </section>

      {/* ------------------------------------------------ supporting rows */}
      <div data-zone="cool" className="border-t border-border">
        <div className="shell-wide space-y-12 py-10 lg:space-y-14 lg:py-12">
          <SessionPanel quotes={quotes} />
          <RecentDropsRail />
          <InsideMachine machine={machine} quotes={quotes} />
          <SpinSettles />
        </div>
      </div>
    </>
  )
}
