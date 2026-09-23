/**
 * Environment access, split by trust boundary.
 *
 * Anything under `publicEnv` is inlined into the browser bundle by Next.
 * Anything under `serverEnv` is read lazily and must only ever be touched from
 * server components, route handlers or scripts — never imported into a
 * `"use client"` module.
 */

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const DEFAULT_RPC: Record<number, string> = {
  56: 'https://bsc-dataseed.bnbchain.org',
  97: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
}

const rawChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '56')
const chainId = rawChainId === 97 ? 97 : 56

export const publicEnv = {
  chainId,
  rpcUrl: optional(process.env.NEXT_PUBLIC_BSC_RPC_URL) ?? DEFAULT_RPC[chainId],
  walletConnectProjectId: optional(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
  gameAddress: normaliseAddress(process.env.NEXT_PUBLIC_BACHA_GAME_ADDRESS),
  vaultAddress: normaliseAddress(process.env.NEXT_PUBLIC_BACHA_VAULT_ADDRESS),
  siteUrl: optional(process.env.NEXT_PUBLIC_SITE_URL) ?? 'http://localhost:3000',
  /** Shows the environment ribbon. Never set in a production deploy. */
  showDevRibbon: process.env.NODE_ENV !== 'production',
} as const

function normaliseAddress(value: string | undefined): `0x${string}` | undefined {
  const v = optional(value)
  if (!v) return undefined
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return undefined
  return v.toLowerCase() as `0x${string}`
}

/** True once real contracts are wired up on the configured chain. */
export const contractsConfigured = Boolean(publicEnv.gameAddress && publicEnv.vaultAddress)

/**
 * The machine runs in one of two modes and the UI always says which.
 *
 * `onchain` — spins are real transactions settled by Chainlink VRF.
 * `demo`    — no contracts are deployed, so spins are simulated server-side
 *             and labelled as such. Demo randomness lives in its own module
 *             and never touches the production settlement path.
 */
export const spinMode: 'onchain' | 'demo' = contractsConfigured ? 'onchain' : 'demo'

/** Server-only. Throws if reached from a client bundle. */
export function serverEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() was reached from the browser — this is a server-only module')
  }
  return {
    bscscanApiKey: optional(process.env.BSCSCAN_API_KEY),
    coingeckoApiKey: optional(process.env.COINGECKO_API_KEY),
    openaiApiKey: optional(process.env.OPENAI_API_KEY),
    databaseUrl: optional(process.env.DATABASE_URL),
    settlementPrivateKey: optional(process.env.SETTLEMENT_PRIVATE_KEY),
    adminToken: optional(process.env.BACHA_ADMIN_TOKEN),
    adminAddresses: (optional(process.env.BACHA_ADMIN_ADDRESSES) ?? '')
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter((a) => /^0x[0-9a-f]{40}$/.test(a)),
    blockedCountries: (optional(process.env.BACHA_BLOCKED_COUNTRIES) ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    minimumAge: Number(optional(process.env.BACHA_MINIMUM_AGE) ?? '18'),
  }
}
