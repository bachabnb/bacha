#!/usr/bin/env node
/**
 * Adds a reward token to data/tokens.json — or refreshes one already there —
 * from a DexScreener link, running the checks that make an entry safe:
 *
 *   1. The link is resolved to the pool's *base* token. A pool address is
 *      never mistaken for a token address.
 *   2. name(), symbol(), decimals() and totalSupply() are read straight from
 *      BNB Smart Chain. Decimals are never taken from an API.
 *   3. The contract's bytecode must delegate to the bStocks issuer beacon —
 *      the one thing a copycat "TSLA" cannot fake. Anything else is refused
 *      unless --allow-other-issuer is passed after a manual review.
 *   4. Liquidity and volume are summed across every BSC pool for the token,
 *      so a thin pool in the link does not understate a deep market.
 *   5. The logo is fetched once — from CoinGecko's listing, falling back to
 *      DexScreener — normalised to a 128px PNG and stored locally. Check it:
 *      a pool's DexScreener image is set by whoever created the pool.
 *
 *   node scripts/add-token.mjs <dexscreener url | pool or token address> [--id tsla]
 *
 * Adding a token to the registry does not put it in the machine: prize
 * amounts are authored in scripts/build-machine-config.mjs.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createPublicClient, http, getAddress } from 'viem'
import { bsc } from 'viem/chains'
import sharp from 'sharp'

/** BTECH Holdings' bStocks: every token is a beacon proxy onto this beacon. */
const BSTOCKS_BEACON = '156d6dce9a4f6139a3406f1f021f1a4880de93a3'

const args = process.argv.slice(2)
const input = args.find((a) => !a.startsWith('--'))
const idFlag = args.indexOf('--id')
const forcedId = idFlag >= 0 ? args[idFlag + 1] : undefined
const allowOtherIssuer = args.includes('--allow-other-issuer')
if (!input) {
  console.error('usage: node scripts/add-token.mjs <dexscreener url | address> [--id <id>] [--allow-other-issuer]')
  process.exit(1)
}

const client = createPublicClient({
  chain: bsc,
  transport: http(process.env.BACHA_RPC_URL || 'https://bsc-dataseed.bnbchain.org'),
})

const address = (input.match(/0x[0-9a-fA-F]{40}/) ?? [])[0]
if (!address) throw new Error(`no address in ${input}`)

// A DexScreener link usually names a pool. Resolve it to the base token.
const token = await resolveToken(address)
const ds = await dexscreener(`tokens/${token}`)
const pools = (ds.pairs ?? []).filter(
  (p) => p.chainId === 'bsc' && p.baseToken?.address?.toLowerCase() === token.toLowerCase(),
)
if (pools.length === 0) throw new Error(`${token} has no BSC pools on DexScreener`)
pools.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))

const erc20 = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
]
const read = (functionName) => client.readContract({ address: token, abi: erc20, functionName })
const [name, symbol, decimals, supply] = await Promise.all(['name', 'symbol', 'decimals', 'totalSupply'].map(read))
const code = await client.getCode({ address: token })

const isBStock = Boolean(code?.toLowerCase().includes(BSTOCKS_BEACON))
if (!isBStock && !allowOtherIssuer) {
  console.error(`${symbol} (${token}) is not a bStocks token: its code does not use the issuer beacon.`)
  console.error('Refusing. Review the contract by hand, then re-run with --allow-other-issuer if it is genuine.')
  process.exit(1)
}

const id = forcedId ?? symbol.toLowerCase().replace(/b$/, '').replace(/[^a-z0-9]/g, '')
const liquidityUsd = Math.round(pools.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0))
const volume24hUsd = Math.round(pools.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0))
const deepest = pools[0]
const company = name.trim()

// CoinGecko first: its image belongs to the listing. A DexScreener image is
// attached per pool by whoever made the pool, so it can be anything.
const logo =
  (await saveLogo(await coingeckoImage(token), id)) ??
  (await saveLogo(pools.find((p) => p.info?.imageUrl)?.info?.imageUrl, id))

const entry = {
  id,
  name: company,
  symbol,
  address: getAddress(token),
  decimals: Number(decimals),
  logo: logo ?? `/tokens/${id}.png`,
  category: isBStock ? 'Tokenized stock' : 'Other',
  blurb: isBStock
    ? `${company} share, tokenized 1:1 as a bStock by BTECH Holdings on BNB Chain.`
    : `${company} on BNB Chain.`,
  enabled: true,
  rewardEnabled: true,
  liquidityUsd,
  volume24hUsd,
  ...(isBStock && {
    transferNotes:
      'bStock: balances rebase for dividends and splits via a share multiplier, and the issuer can block addresses. Not for US persons.',
  }),
  source: {
    dexscreener: `https://dexscreener.com/bsc/${deepest.pairAddress.toLowerCase()}`,
    bscscan: `https://bscscan.com/token/${getAddress(token)}`,
  },
  verifiedAt: new Date().toISOString().slice(0, 10),
}

const registry = JSON.parse(await readFile('data/tokens.json', 'utf8'))
const clash = registry.tokens.find((t) => t.id === id && t.address.toLowerCase() !== token.toLowerCase())
if (clash) throw new Error(`id "${id}" is already used by ${clash.address}; pass --id to choose another`)
const at = registry.tokens.findIndex((t) => t.address.toLowerCase() === token.toLowerCase())
if (at >= 0) registry.tokens[at] = { ...registry.tokens[at], ...entry }
else registry.tokens.push(entry)
await writeFile('data/tokens.json', JSON.stringify(registry, null, 2) + '\n')

if (logo) {
  const credits = JSON.parse(await readFile('data/image-credits.json', 'utf8'))
  const files = credits.tokenLogos.files.filter((f) => f.address.toLowerCase() !== token.toLowerCase())
  files.push({ file: `public${logo}`, token: symbol, address: getAddress(token) })
  credits.tokenLogos.files = files
  await writeFile('data/image-credits.json', JSON.stringify(credits, null, 2) + '\n')
}

console.log(`${at >= 0 ? 'updated' : 'added  '} ${symbol.padEnd(7)} ${getAddress(token)}  id=${id}  decimals=${decimals}`)
console.log(`         ${company} · supply ${(Number(supply) / 10 ** Number(decimals)).toLocaleString()} · ` +
  `${pools.length} pools, $${liquidityUsd.toLocaleString()} liquidity, $${volume24hUsd.toLocaleString()} 24h · ` +
  `$${Number(deepest.priceUsd).toFixed(2)} · issuer ${isBStock ? 'bStocks (beacon verified)' : 'UNVERIFIED'}` +
  `${logo ? '' : ' · NO LOGO'}`)

/* ----------------------------------------------------------------- helpers */

async function resolveToken(addr) {
  const pool = await dexscreener(`pairs/bsc/${addr}`).catch(() => null)
  const pair = pool?.pairs?.[0] ?? pool?.pair
  if (pair?.baseToken?.address) return getAddress(pair.baseToken.address)
  return getAddress(addr)
}

async function dexscreener(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/${path}`, { headers: { Accept: 'application/json' } })
    if (res.ok) return res.json()
    if (res.status !== 429) throw new Error(`dexscreener ${path}: ${res.status}`)
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
  throw new Error(`dexscreener ${path}: rate limited`)
}

async function coingeckoImage(addr) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/binance-smart-chain/contract/${addr}`)
    if (res.ok) return (await res.json())?.image?.large ?? null
    if (res.status !== 429) return null
    await new Promise((r) => setTimeout(r, 15_000))
  }
  return null
}

async function saveLogo(url, id) {
  if (!url) return null
  const res = await fetch(url)
  if (!res.ok) return null
  await mkdir('public/tokens', { recursive: true })
  const png = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(128, 128, { fit: 'cover' })
    .png()
    .toBuffer()
  await writeFile(`public/tokens/${id}.png`, png)
  return `/tokens/${id}.png`
}
