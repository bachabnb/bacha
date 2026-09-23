#!/usr/bin/env node
/**
 * Pulls contextual photography from Wikimedia Commons.
 *
 * Commons is used because every file carries a machine-readable licence and
 * attribution, which is recorded into data/image-credits.json alongside the
 * download. Nothing is hot-linked and nothing unlicensed ships.
 *
 * Subjects are deliberately generic — arcades, capsule machines, hardware,
 * night city. No image is ever presented as a Bacha user, a team member, a
 * BNB Chain employee or an actual event.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const OUT = 'public/photos'
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'bacha-photo-sync/1.0 (project asset pipeline)'

/** Searched in order; the first acceptable result per slot is taken. */
const SLOTS = [
  { id: 'capsule-machines', queries: ['gashapon machines', 'capsule toy vending machines', 'gachapon store'], alt: 'A wall of capsule vending machines.' },
  { id: 'arcade', queries: ['Akihabara game center', 'Taito Station arcade', 'game arcade Japan interior', 'amusement arcade machines'], alt: 'The interior of an amusement arcade.' },
  { id: 'hardware', queries: ['circuit board macro', 'printed circuit board detail', 'electronics components macro'], alt: 'Close detail of electronic hardware.' },
  { id: 'nightcity', queries: ['Shibuya Crossing night', 'Tokyo night neon signs', 'Hong Kong skyline night', 'Shinjuku at night'], alt: 'A city street at night.' },
  { id: 'workspace', queries: ['hackathon participants', 'hackathon coding', 'computer laboratory students', 'programmer at computer'], alt: 'People working at computers.' },
]

const ALLOWED = /^(cc0|cc-by-sa-\d|cc-by-\d|public domain|pd-)/i

await mkdir(OUT, { recursive: true })

const credits = []

for (const slot of SLOTS) {
  let picked = null
  for (const query of slot.queries) {
    const results = await search(query)
    for (const title of results) {
      const info = await imageInfo(title)
      if (!info) continue
      const licence = info.LicenseShortName?.value ?? ''
      if (!ALLOWED.test(licence.replace(/\s+/g, '-'))) continue
      if (!info.width || info.width < 1400) continue
      picked = { title, info, query }
      break
    }
    if (picked) break
  }

  if (!picked) {
    console.warn(`no suitable image found for ${slot.id} — the layout falls back to generated art`)
    continue
  }

  const url = picked.info.thumburl ?? picked.info.url
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    console.warn(`download failed for ${slot.id}: ${res.status}`)
    continue
  }
  const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const filename = `${slot.id}.${safeExt}`
  await writeFile(path.join(OUT, filename), Buffer.from(await res.arrayBuffer()))

  credits.push({
    file: `public/photos/${filename}`,
    slot: slot.id,
    alt: slot.alt,
    title: picked.title,
    descriptionPage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(picked.title)}`,
    author: stripHtml(picked.info.Artist?.value) || 'Unknown',
    licence: picked.info.LicenseShortName?.value ?? 'see description page',
    licenceUrl: picked.info.LicenseUrl?.value ?? null,
    source: 'Wikimedia Commons',
    retrievedAt: new Date().toISOString().slice(0, 10),
  })
  console.log(`ok   ${slot.id} <- ${picked.title} [${picked.info.LicenseShortName?.value}]`)
}

const creditsPath = 'data/image-credits.json'
const existing = JSON.parse(await readFile(creditsPath, 'utf8'))
existing.photography.files = credits
await writeFile(creditsPath, JSON.stringify(existing, null, 2) + '\n')
console.log(`recorded ${credits.length} credits in ${creditsPath}`)

async function search(query) {
  const url = `${API}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(
    `filetype:bitmap ${query}`,
  )}&gsrnamespace=6&gsrlimit=12&origin=*`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const body = await res.json()
  return Object.values(body?.query?.pages ?? {}).map((p) => p.title)
}

async function imageInfo(title) {
  const url = `${API}?action=query&format=json&titles=${encodeURIComponent(
    title,
  )}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=2000&origin=*`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const body = await res.json()
  const page = Object.values(body?.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!info) return null
  return { ...info.extmetadata, url: info.url, thumburl: info.thumburl, width: info.width }
}

function stripHtml(value) {
  if (!value) return ''
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
