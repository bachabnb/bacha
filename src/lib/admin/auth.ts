import 'server-only'
import { cookies, headers } from 'next/headers'
import { serverEnv } from '../env'

export const ADMIN_COOKIE = 'bacha_admin'

/**
 * Admin access.
 *
 * Two independent gates, both server-side:
 *
 *   1. `BACHA_ADMIN_TOKEN` — a shared secret that unlocks the console. Absent,
 *      the console is unreachable entirely rather than open.
 *   2. `BACHA_ADMIN_ADDRESSES` — the wallets allowed to execute anything. The
 *      console never signs on their behalf; it prepares a transaction and the
 *      operator's own wallet executes it against contracts whose admin role
 *      should be held by a multisig.
 *
 * This is deliberately not a login system. It gates a read-mostly console, and
 * every state change still has to clear the contract's own access control.
 */
export async function isAdminRequest(): Promise<boolean> {
  const { adminToken } = serverEnv()
  if (!adminToken) return false

  const jar = await cookies()
  if (jar.get(ADMIN_COOKIE)?.value === adminToken) return true

  const headerList = await headers()
  return headerList.get('authorization') === `Bearer ${adminToken}`
}

export function adminConfigured(): boolean {
  return Boolean(serverEnv().adminToken)
}

/** Wallets permitted to execute admin transactions. */
export function adminWallets(): string[] {
  return serverEnv().adminAddresses
}
