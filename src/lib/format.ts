/** Display helpers. None of these are used for settlement arithmetic. */

export function shortAddress(address: string, lead = 4, tail = 4): string {
  if (!address || address.length < lead + tail + 2) return address
  return `${address.slice(0, 2 + lead)}…${address.slice(-tail)}`
}

export function shortHash(hash: string, lead = 6, tail = 4): string {
  if (!hash || hash.length < lead + tail + 2) return hash
  return `${hash.slice(0, 2 + lead)}…${hash.slice(-tail)}`
}

/**
 * Formats a token amount with a precision that suits its magnitude — a
 * BABYDOGE reward and a BNB reward should not be shown the same way.
 */
export function formatTokenAmount(amount: number, symbol?: string): string {
  if (!Number.isFinite(amount)) return '—'
  let body: string
  if (amount === 0) body = '0'
  else if (amount >= 1_000_000_000) body = `${(amount / 1_000_000_000).toFixed(2)}B`
  else if (amount >= 1_000_000) body = `${(amount / 1_000_000).toFixed(2)}M`
  else if (amount >= 1_000) body = amount.toLocaleString('en-US', { maximumFractionDigits: 0 })
  else if (amount >= 1) body = amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  else if (amount >= 0.001) body = trimZeros(amount.toFixed(4))
  else body = amount.toPrecision(3)
  return symbol ? `${body} ${symbol}` : body
}

export function formatUsd(value: number | null | undefined, opts?: { approx?: boolean }): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const prefix = opts?.approx ? '≈ ' : ''
  if (value >= 1000) return `${prefix}$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (value >= 1) return `${prefix}$${value.toFixed(2)}`
  if (value >= 0.01) return `${prefix}$${value.toFixed(3)}`
  return `${prefix}$${value.toPrecision(2)}`
}

export function formatBnb(wei: bigint, decimals = 5): string {
  const asNumber = Number(wei) / 1e18
  return asNumber.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatPercent(fraction: number, decimals = 2): string {
  if (!Number.isFinite(fraction)) return '—'
  const pct = fraction * 100
  if (pct >= 10) return `${pct.toFixed(Math.min(decimals, 1))}%`
  return `${pct.toFixed(decimals)}%`
}

export function timeAgo(timestampMs: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestampMs) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds} sec ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(timestampMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Exact base-units → decimal number, for display only. */
export function unitsToNumber(units: bigint, decimals: number): number {
  if (decimals === 0) return Number(units)
  const base = 10n ** BigInt(decimals)
  const whole = units / base
  const frac = units % base
  return Number(whole) + Number(frac) / Number(base)
}

/**
 * Decimal number → exact base units, truncating rather than rounding.
 *
 * Uses the shortest round-trip string for the value instead of `toFixed`,
 * which silently loses precision past ~15 significant digits: `(1.2).toFixed(18)`
 * is `'1.199999999999999956'`, and publishing that as a prize amount would
 * short a player by a hair on every single spin. Truncation is deliberate —
 * a reward should never be rounded *up* into an amount the vault did not
 * budget for.
 */
export function numberToUnits(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n

  let text = String(value)
  // Exponent notation has no decimal point to split on; expand it first.
  if (text.includes('e') || text.includes('E')) {
    text = value.toFixed(Math.max(decimals, 20))
  }

  const [whole = '0', frac = ''] = text.split('.')
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0')
}

/** Drops trailing zeros so `0.8200` reads as `0.82`. */
function trimZeros(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}
