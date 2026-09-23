'use client'

import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import useFeed from '@/lib/useFeed'
import { TokenMark } from '@/components/ui/TokenMark'
import { RarityChip } from '@/components/ui/RarityChip'
import { useTimeAgo } from '@/lib/useTimeAgo'
import { tokenByAddress } from '@/lib/tokens'
import { shortAddress, formatTokenAmount } from '@/lib/format'
import { explorer } from '@/lib/chain'

/**
 * A horizontal rail of what has actually come out of the machine.
 *
 * Real settled spins only. With nothing settled the rail says so rather than
 * filling itself with plausible-looking rows.
 */
export function RecentDropsRail() {
  const t = useTranslations('play.drops')
  const a = useTranslations('activity')
  const { data } = useFeed('/api/spins?limit=14', 12_000)
  const reduce = useReducedMotion()

  const spins = (data?.spins ?? []).filter((s) => s.status !== 'PENDING').slice(0, 10)

  return (
    <section aria-labelledby="recent-drops">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="recent-drops" className="font-display text-[1.3rem] font-bold tracking-[-0.035em] text-foreground">
          {t('title')}
        </h2>
        {data?.mode === 'onchain' && <span className="tag tag-neutral">{a('modeLive')}</span>}
      </div>

      {spins.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border-strong px-5 py-8 text-center text-[0.86rem] text-foreground-muted">
          {t('empty')}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <ul className="flex gap-2.5">
            <AnimatePresence initial={false}>
              {spins.map((spin) => {
                const token = spin.rewardTokenAddress ? tokenByAddress(spin.rewardTokenAddress) : undefined
                const body = (
                  <>
                    {token ? (
                      <TokenMark token={token} size={28} />
                    ) : (
                      <span className="h-7 w-7 rounded-full bg-surface-hover" />
                    )}
                    <span className="min-w-0">
                      <span className="num block truncate text-[0.82rem] font-semibold text-foreground">
                        {spin.rewardAmount != null
                          ? formatTokenAmount(spin.rewardAmount, token?.symbol ?? '')
                          : '—'}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="num text-[0.66rem] text-foreground-muted">
                          {shortAddress(spin.player)}
                        </span>
                        <Ago timestamp={spin.settledAt ?? spin.requestedAt} />
                      </span>
                    </span>
                    {spin.rarity && <RarityChip rarity={spin.rarity} className="scale-[0.85]" />}
                  </>
                )

                return (
                  <motion.li
                    key={`${spin.mode}-${spin.id}`}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="shrink-0"
                  >
                    {spin.txHash ? (
                      <a
                        href={explorer.tx(spin.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-physical flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-hover"
                      >
                        {body}
                      </a>
                    ) : (
                      <span className="card-physical flex items-center gap-2.5 px-3 py-2.5">{body}</span>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </section>
  )
}

function Ago({ timestamp }: { timestamp: number }) {
  return <span className="num text-[0.66rem] text-foreground-muted">{useTimeAgo(timestamp)}</span>
}
