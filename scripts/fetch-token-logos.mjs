#!/usr/bin/env node
/**
 * Refreshes public/tokens/* from CoinGecko and rewrites the logo paths in
 * data/tokens.json. Logos are stored locally rather than hot-linked so the
 * product does not depend on a third-party CDN staying up.
 *
 * Project logos remain the trademarks of their projects and are used here only
 * to identify which token a reward consists of. See data/image-credits.json.
 */
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'

const OUT = 'public/tokens'
const UA = 'bacha-token-logo-sync/1.0'

const registry = JSON.parse(await readFile('data/tokens.json', 'utf8'))
const key = process.env.COINGECKO_API_KEY
const base = key ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3'
const headers = { 'User-Agent': UA, ...(key ? { 'x-cg-pro-api-key': key } : {}) }

const existing = new Set(await readdir(OUT).catch(() => []))

for (const token of registry.tokens) {
  if (!token.coingeckoId) {
    console.log(`skip ${token.symbol} — no coingeckoId`)
    continue
  }
  const url = `${base}/coins/${token.coingeckoId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    console.warn(`skip ${token.symbol} — CoinGecko returned ${res.status}`)
    await sleep(key ? 300 : 14_000)
    continue
  }
  const body = await res.json()
  const imageUrl = body?.image?.large
  if (!imageUrl) {
    console.warn(`skip ${token.symbol} — no image in response`)
    await sleep(key ? 300 : 14_000)
    continue
  }

  const ext = (imageUrl.split('?')[0].split('.').pop() || 'png').toLowerCase()
  const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
  const filename = `${token.id}.${safeExt}`

  const img = await fetch(imageUrl, { headers })
  if (!img.ok) {
    console.warn(`skip ${token.symbol} — image fetch returned ${img.status}`)
    await sleep(key ? 300 : 14_000)
    continue
  }

  await writeFile(path.join(OUT, filename), Buffer.from(await img.arrayBuffer()))
  for (const old of existing) {
    if (old.startsWith(`${token.id}.`) && old !== filename) {
      await unlink(path.join(OUT, old)).catch(() => {})
    }
  }
  token.logo = `/tokens/${filename}`
  console.log(`ok   ${token.symbol} -> ${filename}`)

  await sleep(key ? 300 : 14_000)
}

await writeFile('data/tokens.json', JSON.stringify(registry, null, 2) + '\n')
console.log('updated data/tokens.json')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
