#!/usr/bin/env node
/**
 * Prepares the supplied Bacha mark for the web.
 *
 * The source artwork is a large PNG with generous transparent margin. Shipped
 * as-is it is both heavy and visually small — the mark only occupies part of
 * its own canvas, so at nav size the detail collapses. This trims it to the
 * artwork, emits sized WebP variants, and keeps the untouched original as the
 * master.
 *
 * Run after replacing public/brand/bacha-logo.png:
 *   node scripts/process-logo.mjs
 */
import { readFile, mkdir, stat, access, copyFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE = 'public/brand/bacha-logo.png'
const MASTER = 'art-masters/brand/bacha-logo-original.png'
const OUT_DIR = 'public/brand'
const SIZES = [64, 128, 256, 512]

try {
  await access(SOURCE)
} catch {
  console.error(
    `${SOURCE} is missing.\n` +
      'Drop the Bacha mark there (transparent PNG, square, ideally 1024px or larger) and re-run.\n' +
      'The app falls back to a vector mark until then, so nothing breaks.',
  )
  process.exit(1)
}

await mkdir(path.dirname(MASTER), { recursive: true })
await mkdir(OUT_DIR, { recursive: true })

// Keep the untouched original once, so re-running never degrades quality.
try {
  await access(MASTER)
} catch {
  await copyFile(SOURCE, MASTER)
  console.log(`master kept at ${MASTER}`)
}

const before = (await stat(MASTER)).size
const input = await readFile(MASTER)

/**
 * Some exports arrive on a flat white background rather than transparent.
 * If the corners are opaque and near-white, key that background out — the
 * mark has to sit on both a near-black and a warm ivory canvas, and a white
 * box around it would be visible on both.
 */
const prepared = await removeFlatBackground(input)

// Trim the margin, then pad back a hair so edges never clip.
const trimmed = await sharp(prepared).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true })
const { width, height } = trimmed.info
// A hair of padding so the outer glow never clips, but the artwork keeps its
// own proportions — squaring it would letterbox the mark inside its own file.
const pad = Math.round(Math.max(width, height) * 0.015)

const padded = await sharp(trimmed.data)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

const final = await sharp(padded).metadata()
const aspect = final.width / final.height

// The default asset, and the one the icon route reads.
await sharp(padded).resize({ height: 512 }).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, 'bacha-logo.png'))

const variants = []
for (const size of SIZES) {
  const out = path.join(OUT_DIR, `bacha-logo-${size}.webp`)
  // Sized by height, so every variant shares the artwork's real aspect.
  const info = await sharp(padded)
    .resize({ height: size })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(out)
  variants.push({ size, bytes: info.size, width: info.width, height: info.height })
}

const after = (await stat(path.join(OUT_DIR, 'bacha-logo.png'))).size

console.log(`source   ${trimmed.info.width}×${trimmed.info.height} after trim (was square with margin)`)
console.log(`png      ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`)
for (const v of variants) {
  console.log(`webp     ${String(v.width).padStart(3)}×${v.height}  ${(v.bytes / 1024).toFixed(1)}KB`)
}
console.log(`aspect   ${aspect.toFixed(3)} — use a box with this ratio`)
console.log('\nThe mark now fills its own box, so it reads correctly at nav size.')

/**
 * Detects a flat, opaque, near-white backdrop by sampling the corners, and
 * makes it transparent if found. A genuinely transparent source is returned
 * untouched.
 */
async function removeFlatBackground(buffer) {
  const image = sharp(buffer).ensureAlpha()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels } = info

  const corner = (x, y) => {
    const i = (y * w + x) * channels
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
  }
  const corners = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)]

  const opaqueLight = corners.every((c) => c.a > 240 && c.r > 235 && c.g > 235 && c.b > 235)
  if (!opaqueLight) return buffer

  // Feather the cut so the mark's soft outer glow does not get a hard edge.
  const out = Buffer.from(data)
  for (let i = 0; i < out.length; i += channels) {
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const min = Math.min(r, g, b)
    if (min < 228) continue
    const alpha = Math.round(((255 - min) / (255 - 228)) * 255)
    out[i + 3] = Math.min(out[i + 3], alpha)
  }

  console.log('keyed out a flat white background')
  return sharp(out, { raw: { width: w, height: h, channels } }).png().toBuffer()
}
