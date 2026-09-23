'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Capsule } from '@/components/brand/Capsule'

/**
 * The console is locked by default and stays locked when no token is
 * configured — an unconfigured admin surface should be unreachable, not open.
 */
export function AdminLocked({ configured }: { configured: boolean }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function unlock(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        setError('That token was not accepted.')
        return
      }
      window.location.reload()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="panel-raised w-full max-w-sm p-7">
        <Capsule finish="graphite" size={48} />
        <h1 className="mt-6 font-display text-[1.5rem] font-bold tracking-[-0.035em] text-foreground">
          Bacha operator console
        </h1>

        {configured ? (
          <>
            <p className="mt-3 text-[0.86rem] leading-relaxed text-foreground-secondary">
              Enter the operator token to continue. This unlocks a read-mostly console — every state
              change is still executed by your own wallet and checked by the contract.
            </p>
            <form onSubmit={unlock} className="mt-6 space-y-3">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                placeholder="Operator token"
                aria-label="Operator token"
                className="num h-11 w-full rounded-[10px] border border-border bg-surface px-3.5 text-[0.9rem] text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none"
              />
              <Button type="submit" className="w-full" disabled={busy || !token}>
                {busy ? 'Checking…' : 'Unlock'}
              </Button>
            </form>
            {error && (
              <p className="mt-4 rounded-[8px] border border-danger/25 bg-danger-soft p-3 text-[0.8rem] text-danger">
                {error}
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-[0.86rem] leading-relaxed text-foreground-secondary">
            No operator token is configured on this deployment, so the console is disabled. Set{' '}
            <code className="num text-foreground">BACHA_ADMIN_TOKEN</code> in the server environment
            to enable it.
          </p>
        )}
      </div>
    </div>
  )
}
