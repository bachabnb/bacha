#!/usr/bin/env node
/**
 * Re-checks the token registry against live sources.
 *
 * Every entry in data/tokens.json was verified by hand before it was added.
 * This re-runs that check so drift is caught deliberately rather than
 * discovered by a player receiving the wrong asset:
 *
 *   1. CoinGecko — the contract address and decimals it lists for BSC
 *   2. An eth_call to BNB Smart Chain — decimals() and symbol() on the
 *      contract itself, which is the only authoritative answer
 *
 * Exits non-zero if anything disagrees, so it can gate a release.
 */
import { readFile } from 'node:fs/promises'

const RPC = process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.bnbchain.org'
const CG_KEY = process.env.COINGECKO_API_KEY
const CG_BASE = CG_KEY ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3'

const registry = JSON.parse(await readFile('data/tokens.json', 'utf8'))
let failures = 0

console.log(`checking ${registry.tokens.length} tokens against chain ${registry.chainId}\n`)

for (const token of registry.tokens) {
  const problems = []

  // --- onchain: the authoritative answer -----------------------------------
  const [decimals, symbol] = await Promise.all([
    ethCall(token.address, '0x313ce567').then(hexToInt),
    ethCall(token.address, '0x95d89b41').then(decodeString),
  ])

  if (decimals === null) {
    problems.push('contract did not answer decimals() — is this address a token?')
  } else if (decimals !== token.decimals) {
    problems.push(`decimals: registry says ${token.decimals}, chain says ${decimals}`)
  }

  if (symbol && symbol.toLowerCase() !== token.symbol.toLowerCase()) {
    // Not fatal on its own — several BEP-20s use mixed case, e.g. "Cake".
    console.log(`  note  ${token.symbol}: onchain symbol is "${symbol}"`)
  }

  // --- CoinGecko: an independent second opinion ----------------------------
  if (token.coingeckoId) {
    const listed = await coingeckoAddress(token.coingeckoId)
    if (!listed) {
      problems.push(`CoinGecko has no BSC deployment for "${token.coingeckoId}"`)
    } else if (listed.address.toLowerCase() !== token.address.toLowerCase()) {
      problems.push(`address: registry ${token.address}, CoinGecko ${listed.address}`)
    } else if (listed.decimals !== token.decimals) {
      problems.push(`decimals: registry ${token.decimals}, CoinGecko ${listed.decimals}`)
    }
    await sleep(CG_KEY ? 250 : 13_000)
  }

  if (problems.length > 0) {
    failures++
    console.log(`FAIL  ${token.symbol}`)
    for (const p of problems) console.log(`      ${p}`)
  } else {
    console.log(`ok    ${token.symbol.padEnd(9)} ${token.address}  ${token.decimals} decimals`)
  }
}

console.log('')
if (failures > 0) {
  console.error(`${failures} token(s) disagree with their sources. Do not ship this registry.`)
  process.exit(1)
}
console.log('registry matches every source checked.')

/* ------------------------------------------------------------------ utils */

async function ethCall(to, data) {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    })
    const body = await res.json()
    return typeof body.result === 'string' ? body.result : null
  } catch {
    return null
  }
}

function hexToInt(hex) {
  return hex && hex.length > 2 ? Number.parseInt(hex, 16) : null
}

function decodeString(hex) {
  if (!hex || hex.length <= 2) return null
  try {
    const bytes = Buffer.from(hex.slice(2), 'hex')
    // Dynamic string: offset, length, then data.
    const offset = Number(BigInt('0x' + bytes.subarray(0, 32).toString('hex')))
    const length = Number(BigInt('0x' + bytes.subarray(offset, offset + 32).toString('hex')))
    return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8')
  } catch {
    // Some older tokens return a fixed bytes32 instead.
    return Buffer.from(hex.slice(2), 'hex').toString('utf8').replace(/\0/g, '').trim() || null
  }
}

async function coingeckoAddress(id) {
  try {
    const res = await fetch(
      `${CG_BASE}/coins/${id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
      { headers: CG_KEY ? { 'x-cg-pro-api-key': CG_KEY } : {} },
    )
    if (!res.ok) return null
    const body = await res.json()
    const platform = body?.detail_platforms?.['binance-smart-chain']
    if (!platform?.contract_address) return null
    return { address: platform.contract_address, decimals: platform.decimal_place }
  } catch {
    return null
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
