#!/usr/bin/env node
/**
 * Generates the Bacha isometric art pack.
 *
 * This is a BUILD-TIME content pipeline. It is never called from a request
 * path — artwork is generated once, optimised, committed, and served as static
 * files. Nothing here ever runs for a website visitor.
 *
 * Guarantees this script is responsible for:
 *   - OPENAI_API_KEY is read from the environment, used server-side only, and
 *     never written into any output file or manifest.
 *   - No prompt asks for text or logos. Real token marks and real copy are
 *     composited in HTML on top, where they stay accurate and translatable.
 *   - Every asset is checked for genuine background transparency after
 *     generation, because theming depends on it.
 *   - public/art/bacha/manifest.json records what exists and why.
 *
 * Usage:
 *   npm run art:generate
 *   npm run art:generate -- --force
 *   npm run art:generate -- --only hero-machine,cta-capsule
 *   npm run art:generate -- --list
 */
import { mkdir, writeFile, readFile, access, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import zlib from 'node:zlib'
import { CATALOGUE, composePrompt } from '../src/lib/art-generation/catalogue.mjs'

const run = promisify(execFile)

const ROOT = 'public/art/bacha'
/** Unoptimised generation masters. Outside public/ so they are never served. */
const MASTERS = 'art-masters'
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst'
const ENDPOINT = 'https://api.openai.com/v1/images/generations'

/** Widths emitted per asset, so pages can serve something sensibly sized. */
const RESPONSIVE_WIDTHS = [480, 960, 1440]

const args = process.argv.slice(2)
const force = args.includes('--force')
const list = args.includes('--list')
const onlyArg = valueOf('--only')
const only = onlyArg ? onlyArg.split(',').map((s) => s.trim()) : null

if (list) {
  for (const piece of CATALOGUE) {
    console.log(`${piece.id.padEnd(20)} ${piece.dir.padEnd(11)} ${piece.size.padEnd(10)} ${piece.section}`)
  }
  process.exit(0)
}

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error(
    'OPENAI_API_KEY is not set.\n\n' +
      'Add it to .env.local — server-side only, never NEXT_PUBLIC_ — and re-run.\n' +
      'The site runs without the art pack: every consumer falls back to its CSS/SVG treatment.',
  )
  process.exit(1)
}

const targets = only ? CATALOGUE.filter((p) => only.includes(p.id)) : CATALOGUE
if (targets.length === 0) {
  console.error(`No catalogue entry matched. Run with --list to see the ids.`)
  process.exit(1)
}

console.log(`model: ${MODEL}`)
console.log(`pieces: ${targets.length}${force ? ' (forcing regeneration)' : ''}\n`)

const manifest = await loadManifest()
let generated = 0
let skipped = 0
let failed = 0
const warnings = []

for (const piece of targets) {
  const dir = path.join(MASTERS, piece.dir)
  const png = path.join(dir, `${piece.id}.png`)
  await mkdir(dir, { recursive: true })
  await mkdir(path.join(ROOT, piece.dir), { recursive: true })

  if (!force && (await exists(png))) {
    console.log(`skip   ${piece.id}`)
    skipped++
    continue
  }

  const prompt = composePrompt(piece.subject, { isolated: piece.isolated !== false })
  process.stdout.write(`gen    ${piece.id.padEnd(20)} `)

  try {
    const bytes = await generate(prompt, piece.size)
    await writeFile(png, bytes)

    const transparency = await transparentFraction(png)
    const variants = await optimise(png, piece)
    const size = (await stat(png)).size

    let note = ''
    if (transparency !== null && transparency < 0.15) {
      note = ' — little transparency, may not suit light mode'
      warnings.push(`${piece.id}: only ${(transparency * 100).toFixed(0)}% transparent`)
    }

    console.log(
      `ok  ${(size / 1024).toFixed(0)}KB  ` +
        `${transparency === null ? 'opaque' : `${(transparency * 100).toFixed(0)}% clear`}${note}`,
    )

    manifest[piece.id] = {
      id: piece.id,
      dir: piece.dir,
      master: png,
      variants,
      section: piece.section,
      aspectRatio: piece.aspect,
      size: piece.size,
      themeCompatibility: piece.themes,
      transparentBackground: transparency !== null && transparency > 0.15,
      model: MODEL,
      prompt,
      containsGeneratedText: false,
      generatedAt: new Date().toISOString().slice(0, 10),
    }
    generated++
  } catch (error) {
    console.log(`failed — ${String(error.message).slice(0, 160)}`)
    failed++
  }
}

await saveManifest(manifest)

console.log('')
console.log(`${generated} generated, ${skipped} already present, ${failed} failed.`)
if (warnings.length) {
  console.log('\nreview these before shipping:')
  for (const w of warnings) console.log(`  · ${w}`)
}
if (failed > 0) {
  console.log('\nFailures are not fatal — every consumer falls back to its CSS/SVG treatment.')
}

/* ------------------------------------------------------------------ api */

async function generate(prompt, size) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, prompt, size, n: 1, background: 'transparent' }),
  })

  if (!res.ok) {
    throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  }

  const payload = await res.json()
  const item = payload?.data?.[0]
  if (!item) throw new Error('response contained no image')

  return item.b64_json
    ? Buffer.from(item.b64_json, 'base64')
    : Buffer.from(await (await fetch(item.url)).arrayBuffer())
}

/* ----------------------------------------------------------- optimising */

/**
 * Emits responsive WebP variants alongside the master PNG.
 *
 * `sips` ships with macOS and handles both resize and WebP encode, which keeps
 * this pipeline free of a native image dependency. If it is unavailable the
 * master PNG is still written and the site simply serves that.
 */
async function optimise(png, piece) {
  const variants = []
  const dir = path.dirname(png)
  const [w] = piece.size.split('x').map(Number)

  for (const width of RESPONSIVE_WIDTHS) {
    if (width > w) continue
    const out = path.join(dir, `${piece.id}-${width}.webp`)
    try {
      await run('sips', ['-Z', String(width), '-s', 'format', 'webp', png, '--out', out])
      variants.push({ width, file: path.relative('public', out) })
    } catch {
      // No sips, or no WebP support — the master PNG remains the fallback.
      break
    }
  }
  return variants
}

/* ------------------------------------------------------------------- QA */

/**
 * Fraction of pixels that are fully transparent.
 *
 * Worth checking every time: the models do sometimes paint a backdrop despite
 * being asked for transparency, and an opaque dark asset silently breaks light
 * mode. Returns null when the file has no alpha channel at all.
 */
async function transparentFraction(file) {
  const data = await readFile(file)
  let pos = 8
  let idat = Buffer.alloc(0)
  let width = 0
  let height = 0
  let colorType = 0

  while (pos < data.length) {
    const len = data.readUInt32BE(pos)
    const type = data.toString('ascii', pos + 4, pos + 8)
    const body = data.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      colorType = body.readUInt8(9)
    } else if (type === 'IDAT') {
      idat = Buffer.concat([idat, body])
    } else if (type === 'IEND') break
    pos += 12 + len
  }

  if (colorType !== 6) return null

  const raw = zlib.inflateSync(idat)
  const bpp = 4
  const stride = width * bpp
  let prev = Buffer.alloc(stride)
  let offset = 0
  let clear = 0
  let total = 0

  for (let y = 0; y < height; y++) {
    const filter = raw[offset++]
    const line = Buffer.from(raw.subarray(offset, offset + stride))
    offset += stride

    for (let x = 0; x < stride; x++) {
      const a = line[x]
      const b = x >= bpp ? line[x - bpp] : 0
      const c = prev[x]
      const d = x >= bpp ? prev[x - bpp] : 0
      if (filter === 1) line[x] = (a + b) & 255
      else if (filter === 2) line[x] = (a + c) & 255
      else if (filter === 3) line[x] = (a + ((b + c) >> 1)) & 255
      else if (filter === 4) {
        const p = b + c - d
        const pa = Math.abs(p - b)
        const pb = Math.abs(p - c)
        const pc = Math.abs(p - d)
        line[x] = (a + (pa <= pb && pa <= pc ? b : pb <= pc ? c : d)) & 255
      }
    }

    for (let x = 3; x < stride; x += 4) {
      total++
      if (line[x] < 16) clear++
    }
    prev = line
  }

  return total === 0 ? null : clear / total
}

/* -------------------------------------------------------------- manifest */

async function loadManifest() {
  try {
    const raw = await readFile(path.join(ROOT, 'manifest.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed.assets ?? {}
  } catch {
    return {}
  }
}

async function saveManifest(assets) {
  await mkdir(ROOT, { recursive: true })
  const payload = {
    $comment:
      'Generated by scripts/generate-bacha-art.mjs. Original artwork produced for this project. ' +
      'No prompt requests text or logos — real token marks and copy are composited in HTML.',
    generator: 'scripts/generate-bacha-art.mjs',
    updatedAt: new Date().toISOString().slice(0, 10),
    assets,
  }
  await writeFile(path.join(ROOT, 'manifest.json'), JSON.stringify(payload, null, 2) + '\n')
}

/* ---------------------------------------------------------------- utils */

function valueOf(flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : null
}

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}
