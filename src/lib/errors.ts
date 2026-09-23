'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

/**
 * Turns whatever a wallet or RPC node throws into something a person can read.
 *
 * Raw provider errors never reach the UI: they leak internals and tell a
 * normal user nothing useful. Matching happens on the raw string, but the
 * message the person sees comes from the dictionary, so it is translated.
 */
const PATTERNS: [RegExp, string][] = [
  [/user rejected|user denied|rejected the request|ACTION_REJECTED|4001/i, 'userRejected'],
  [/insufficient funds|exceeds balance|gas required exceeds/i, 'insufficientFunds'],
  [/IncorrectPayment/i, 'priceChanged'],
  [/InsufficientInventory/i, 'outOfInventory'],
  [/TierInactive|UnknownTier/i, 'tierInactive'],
  [/EnforcedPause|paused/i, 'paused'],
  [/SpinNotSettled/i, 'notSettled'],
  [/UnknownSpin/i, 'unknownSpin'],
  [/RefundTooEarly/i, 'refundTooEarly'],
  [/nonce too low|replacement transaction underpriced/i, 'pendingTx'],
  [/chain mismatch|chain not configured|Unsupported chain/i, 'wrongChain'],
  [/timeout|timed out|ETIMEDOUT/i, 'timeout'],
  [/fetch failed|network error|Failed to fetch/i, 'network'],
  [/rate limit|429/i, 'rateLimit'],
]

/** Maps a thrown value to a dictionary key. Pure, so it is unit-testable. */
export function errorKey(error: unknown): string {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message} ${'cause' in error ? String((error as { cause?: unknown }).cause ?? '') : ''}`
      : String(error ?? '')

  for (const [pattern, key] of PATTERNS) {
    if (pattern.test(raw)) return key
  }
  return 'generic'
}

/** Hook form, for components. */
export function useHumanError() {
  const t = useTranslations('errors')
  return useCallback((error: unknown) => t(errorKey(error)), [t])
}

/** True when the failure was the person changing their mind, not a fault. */
export function isUserRejection(error: unknown): boolean {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return /user rejected|user denied|rejected the request|ACTION_REJECTED|4001/i.test(raw)
}
