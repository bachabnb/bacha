#!/usr/bin/env node
/**
 * Optimises the generated art pack for the web.
 *
 * The models return large lossless PNGs. Shipping those would cost more than
 * the artwork is worth, so each master is:
 *
 *   1. trimmed of fully transparent margin, so the object fills its box and
 *      layouts do not have to compensate for arbitrary padding,
 *   2. emitted as WebP at a few widths, keeping the alpha channel,
 *   3. recorded in the manifest with its real intrinsic size, so `next/image`
 *      can reserve the right space and avoid layout shift.
 *
 * Masters stay on disk as the source of truth but are never served.
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = 'public/art/bacha'
/** Served widths. The asset's own native width is always added on top, so
 *  nothing is ever upscaled and nothing is ever capped below its real size. */
const WIDTHS = [480, 960, 1440]
const QUALITY = 82

const manifestPath = path.join(ROOT, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

let totalBefore = 0
let totalAfter = 0

for (const [id, asset] of Object.entries(manifest.assets)) {
  // Masters live outside public/ so they are never served.
  const master = asset.master ?? path.join('art-masters', `${asset.dir ?? ''}`, `${id}.png`)
  let masterStat
  try {
    masterStat = await stat(master)
  } catch {
    console.warn(`skip ${id} — master missing`)
    continue
  }
  totalBefore += masterStat.size

  // Variants always land under public/, regardless of where the master lives.
  const dir = path.join('public', 'art', 'bacha', asset.dir ?? path.basename(path.dirname(master)))
  await mkdir(dir, { recursive: true })

  // Trim transparent margin so every asset is tight to its subject.
  const trimmed = sharp(master).trim({ threshold: 1 })
  const meta = await trimmed.clone().toBuffer({ resolveWithObject: true })
  const { width, height } = meta.info

  const targets = [...new Set([...WIDTHS.filter((w) => w < width), width])].sort((a, b) => a - b)

  const variants = []
  for (const target of targets) {
    if (target > width) continue
    const out = path.join(dir, `${id}-${target}.webp`)
    const info = await sharp(await trimmed.clone().toBuffer())
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: QUALITY, alphaQuality: 90, effort: 5 })
      .toFile(out)
    variants.push({
      width: info.width,
      height: info.height,
      file: path.relative('public', out),
      bytes: info.size,
    })
    totalAfter += info.size
  }

  // Always emit at least one variant, even for small sources.
  if (variants.length === 0) {
    const out = path.join(dir, `${id}-full.webp`)
    const info = await sharp(await trimmed.clone().toBuffer())
      .webp({ quality: QUALITY, alphaQuality: 90, effort: 5 })
      .toFile(out)
    variants.push({ width: info.width, height: info.height, file: path.relative('public', out), bytes: info.size })
    totalAfter += info.size
  }

  const largest = variants[variants.length - 1]
  manifest.assets[id] = {
    ...asset,
    master,
    variants,
    /** What a consumer should render by default. */
    display: `/${largest.file}`,
    intrinsicWidth: largest.width,
    intrinsicHeight: largest.height,
    trimmedSource: { width, height },
  }

  console.log(
    `${id.padEnd(20)} ${String(width).padStart(4)}×${String(height).padEnd(4)}  ` +
      `${(masterStat.size / 1024).toFixed(0).padStart(5)}KB → ` +
      variants.map((v) => `${v.width}w ${(v.bytes / 1024).toFixed(0)}KB`).join(', '),
  )
}

manifest.optimisedAt = new Date().toISOString().slice(0, 10)
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

// Mirror into data/ so the app can import it without reaching into public/.
await writeFile('data/art-manifest.json', JSON.stringify(manifest, null, 2) + '\n')

console.log('')
console.log(
  `masters ${(totalBefore / 1024 / 1024).toFixed(1)} MB → served ${(totalAfter / 1024 / 1024).toFixed(1)} MB across all widths`,
)
console.log('manifest written to public/art/bacha/manifest.json and data/art-manifest.json')
