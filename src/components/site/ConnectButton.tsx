'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId, useBalance } from 'wagmi'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { shortAddress, formatBnb } from '@/lib/format'
import { publicEnv } from '@/lib/env'
import { networkLabel } from '@/lib/chain'
import { useHumanError } from '@/lib/errors'
import { isUserRejection } from '@/lib/errors'
import { cn } from '@/lib/cn'

/**
 * Wallet entry point. Three states, each with exactly one obvious action:
 * disconnected → connect, wrong chain → switch, connected → open the panel.
 */
/**
 * The wallet CTA anchors the right-hand side, so it is deliberately the
 * heaviest control in the header: yellow, black text, a wallet glyph and
 * enough height to hold its own against the logo on the left.
 */
export function ConnectButton({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'md' | 'lg'
}) {
  const t = useTranslations('wallet')
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [open, setOpen] = useState(false)

  const height = size === 'lg' ? 'h-[44px] px-4 text-[0.88rem]' : 'h-10 px-3.5 text-[0.84rem]'

  if (!isConnected) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-[12px] bg-brand font-semibold text-brand-foreground',
            'shadow-[var(--shadow-brand)] transition-[background-color,transform] duration-150 ease-[var(--ease-physical)]',
            'hover:bg-brand-hover active:translate-y-px active:bg-brand-pressed',
            height,
            className,
          )}
        >
          <WalletIcon />
          {t('connect')}
        </button>
        <ConnectDialog open={open} onOpenChange={setOpen} />
      </>
    )
  }

  if (chainId !== publicEnv.chainId) {
    return <SwitchNetworkButton className={className} />
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-2.5 rounded-[12px] border border-border bg-surface',
          'font-medium text-foreground transition-colors',
          'hover:border-border-strong hover:bg-surface-hover',
          height,
          className,
        )}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="num">{shortAddress(address!)}</span>
      </button>
      <WalletPanel open={open} onOpenChange={setOpen} />
    </>
  )
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="2" y="4.2" width="14" height="9.8" rx="2.2" />
      <path d="M2 7.4h14" />
      <circle cx="12.6" cy="10.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SwitchNetworkButton({ className }: { className?: string }) {
  const t = useTranslations('wallet')
  const humanError = useHumanError()
  const { switchChain, isPending } = useSwitchChain()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="secondary"
        className="w-full border-warning/40 bg-warning-soft text-warning hover:border-warning/60"
        disabled={isPending}
        onClick={() => {
          setError(null)
          switchChain(
            { chainId: publicEnv.chainId },
            {
              onError: (e) => {
                if (!isUserRejection(e)) setError(humanError(e))
              },
            },
          )
        }}
      >
        {isPending ? t('switching') : t('switchNetwork', { network: networkLabel })}
      </Button>
      {error && (
        <p className="absolute right-0 top-full z-10 mt-2 w-64 rounded-md border border-border bg-surface-raised p-2 text-[0.72rem] text-foreground-secondary shadow-[var(--shadow-md)]">
          {error}
        </p>
      )}
    </div>
  )
}

function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations('wallet')
  const humanError = useHumanError()
  const { connectors, connect, isPending } = useConnect()
  const [error, setError] = useState<string | null>(null)
  const [attempting, setAttempting] = useState<string | null>(null)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 panel-raised p-6 focus:outline-none">
          <Dialog.Title className="font-display text-xl font-bold tracking-[-0.03em] text-foreground">
            {t('dialogTitle')}
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-[0.84rem] leading-relaxed text-foreground-secondary">
            {t('dialogBody', { network: networkLabel })}
          </Dialog.Description>

          <div className="mt-5 space-y-2">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                disabled={isPending}
                onClick={() => {
                  setError(null)
                  setAttempting(connector.uid)
                  connect(
                    { connector },
                    {
                      onError: (e) => {
                        if (!isUserRejection(e)) setError(humanError(e))
                        setAttempting(null)
                      },
                      onSuccess: () => {
                        setAttempting(null)
                        onOpenChange(false)
                      },
                    },
                  )
                }}
                className="flex min-h-[3.25rem] w-full items-center justify-between rounded-[10px] border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-50"
              >
                <span className="text-[0.9rem] font-medium text-foreground">{connector.name}</span>
                <span className="text-[0.72rem] text-foreground-muted">
                  {attempting === connector.uid ? t('connecting') : t('connectAction')}
                </span>
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-[8px] border border-danger/25 bg-danger-soft p-3 text-[0.78rem] text-danger">
              {error}
            </p>
          )}

          <p className="mt-5 text-[0.7rem] leading-relaxed text-foreground-muted">
            {t('termsNotice')}{' '}
            <Link href="/terms" className="underline decoration-border-strong underline-offset-2 hover:text-foreground-secondary">
              {t('termsLink')}
            </Link>
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function WalletPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations('wallet')
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address, chainId: publicEnv.chainId })
  const [copied, setCopied] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-4 top-4 z-50 w-[min(22rem,calc(100vw-2rem))] panel-raised p-5 focus:outline-none">
          <Dialog.Title className="sr-only">{t('connected')}</Dialog.Title>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
                {t('connected')}
              </div>
              <div className="num mt-1 truncate text-[0.95rem] font-medium text-foreground">
                {address ? shortAddress(address, 6, 6) : '—'}
              </div>
            </div>
            <span className="tag">{networkLabel}</span>
          </div>

          <div className="mt-4 rounded-[10px] border border-border bg-surface px-3 py-2.5">
            <div className="text-[0.64rem] uppercase tracking-[0.18em] text-foreground-muted">
              {t('balance')}
            </div>
            <div className="num mt-1 text-[1.05rem] font-semibold text-foreground">
              {balance ? `${formatBnb(balance.value)} BNB` : '—'}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/me" onClick={() => onOpenChange(false)}>
                {t('myBacha')}
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (!address) return
                try {
                  await navigator.clipboard.writeText(address)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1600)
                } catch {
                  /* clipboard can be blocked */
                }
              }}
            >
              {copied ? t('copied') : t('copyAddress')}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-center hover:text-danger"
            onClick={() => {
              disconnect()
              onOpenChange(false)
            }}
          >
            {t('disconnect')}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
