#!/usr/bin/env node
/**
 * Generates the Bacha art pack with the OpenAI Images API.
 *
 * Rules this script enforces, because they are product requirements and not
 * stylistic preferences:
 *
 *   - The key is read from the environment and used server-side only. It is
 *     never written into any generated file and never reaches the browser.
 *   - No prompt asks for text, lettering, logos or token marks. Real logos and
 *     real copy are composited in HTML/SVG on top, where they stay accurate.
 *   - Output is written to public/art/bacha/ and committed. The application
 *     must run with these files absent, so every consumer treats them as
 *     decoration with a CSS fallback underneath.
 *
 * Usage:
 *   npm run art:generate              # only generates what is missing
 *   npm run art:generate -- --force   # regenerates everything
 *   npm run art:generate -- --only hero-bacha-machine
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = 'public/art/bacha'
const MODEL = 'gpt-image-1'

const NEGATIVE =
  'No text, no letters, no words, no numbers, no logos, no watermarks, no brand marks, ' +
  'no signage, no UI chrome, no people, no anime characters, no cartoon mascots.'

const HOUSE =
  'Premium product photography in a dark studio. Near-black charcoal background (#0B0E11). ' +
  'Single hard key light plus a soft rim light. Deep shadows, restrained specular highlights, ' +
  'fine surface grain. Colour is limited to matte black, graphite and one warm saturated yellow ' +
  '(#F0B90B). Expensive, industrial, understated. Not neon, not cyberpunk, not glossy toy plastic.'

const PIECES = [
  {
    id: 'hero-bacha-machine',
    size: '1024x1536',
    background: 'opaque',
    prompt:
      `A premium industrial capsule dispenser machine, photographed as a hero product shot. ` +
      `A tall matte-black machined chassis with softly rounded corners and crisp bevelled edges. ` +
      `A large transparent domed chamber in the upper half, lit from within by warm yellow light, ` +
      `filled with smooth two-part capsules in matte black, graphite and yellow. ` +
      `Below the chamber a control deck with a single recessed yellow illuminated button, ` +
      `and beneath that a dark recessed dispensing tray. ` +
      `Three-quarter view, slight low angle, shallow depth of field. ${HOUSE} ${NEGATIVE}`,
  },
  {
    id: 'yellow-capsule',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      `A single two-part capsule, isolated on a transparent background. ` +
      `Saturated warm yellow (#F0B90B) moulded shell with a clean horizontal seam across the middle. ` +
      `The upper half is a smooth translucent dome, the lower half solid and matte. ` +
      `Studio product lighting with a crisp specular highlight on the upper left and a soft rim light. ` +
      `Centred, floating, slight three-quarter rotation. ${NEGATIVE}`,
  },
  {
    id: 'black-capsule',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      `A single two-part capsule, isolated on a transparent background. ` +
      `Matte graphite-black moulded shell with a clean horizontal seam across the middle and a ` +
      `thin warm yellow accent line along the seam. Soft-touch finish that absorbs light, ` +
      `with one restrained specular highlight and a cool rim light along the right edge. ` +
      `Centred, floating, slight three-quarter rotation. ${NEGATIVE}`,
  },
  {
    id: 'epic-capsule',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      `A single two-part capsule in polished chrome with warm gold reflections, isolated on a ` +
      `transparent background. Mirror-finish metal picking up a dark studio environment, with ` +
      `a clean horizontal seam across the middle and sharp caustic highlights. ` +
      `It should read as a rare, more valuable version of a matte capsule — heavier, colder, ` +
      `more reflective. Centred, floating, slight three-quarter rotation. ${NEGATIVE}`,
  },
  {
    id: 'capsule-field',
    size: '1536x1024',
    background: 'transparent',
    prompt:
      `A loose scattered cluster of a dozen two-part capsules floating at different depths, ` +
      `isolated on a transparent background. A mix of matte black, graphite and warm yellow shells, ` +
      `each with a clean horizontal seam. Front capsules sharp, rear capsules softly out of focus. ` +
      `Even studio lighting, subtle shadows between forms, no ground plane. ${NEGATIVE}`,
  },
  {
    id: 'bacha-geometry',
    size: '1536x1024',
    background: 'opaque',
    prompt:
      `An abstract dark environment built from extruded geometric solids — squares, crosses and ` +
      `chamfered blocks — arranged on a shallow grid and receding into darkness. ` +
      `Matte charcoal surfaces with thin warm yellow light seams tracing a few of the edges. ` +
      `Architectural, calm and almost empty; most of the frame is near-black negative space. ` +
      `Wide angle, low contrast, no focal subject. ${HOUSE} ${NEGATIVE}`,
  },
  {
    id: 'reward-reveal-background',
    size: '1536x1024',
    background: 'opaque',
    prompt:
      `A cinematic empty stage for a product reveal. A near-black void with a single warm yellow ` +
      `pool of light falling from above onto a dark reflective floor, and faint volumetric haze. ` +
      `The centre of the frame is deliberately empty so a subject can be composited into it. ` +
      `Restrained and expensive rather than dramatic. ${HOUSE} ${NEGATIVE}`,
  },
]

const args = process.argv.slice(2)
const force = args.includes('--force')
const onlyIndex = args.indexOf('--only')
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error(
    'OPENAI_API_KEY is not set.\n' +
      'Add it to .env.local (server-side only — never NEXT_PUBLIC_) and re-run.\n' +
      'The application runs fine without the art pack; every consumer has a CSS fallback.',
  )
  process.exit(1)
}

await mkdir(OUT_DIR, { recursive: true })

const targets = only ? PIECES.filter((p) => p.id === only) : PIECES
if (targets.length === 0) {
  console.error(`No art piece named "${only}". Known pieces: ${PIECES.map((p) => p.id).join(', ')}`)
  process.exit(1)
}

const manifest = []
let generated = 0
let skipped = 0
let failed = 0

for (const piece of targets) {
  const file = path.join(OUT_DIR, `${piece.id}.png`)

  if (!force && (await exists(file))) {
    console.log(`skip  ${piece.id} (already present — pass --force to regenerate)`)
    skipped++
    manifest.push(describe(piece, file, 'existing'))
    continue
  }

  process.stdout.write(`gen   ${piece.id} … `)
  try {
    const body = {
      model: MODEL,
      prompt: piece.prompt,
      size: piece.size,
      n: 1,
      ...(piece.background === 'transparent' ? { background: 'transparent' } : {}),
    }

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`${res.status} ${detail.slice(0, 300)}`)
    }

    const payload = await res.json()
    const item = payload?.data?.[0]
    if (!item) throw new Error('response contained no image')

    const bytes = item.b64_json
      ? Buffer.from(item.b64_json, 'base64')
      : Buffer.from(await (await fetch(item.url)).arrayBuffer())

    await writeFile(file, bytes)
    console.log(`ok (${(bytes.length / 1024).toFixed(0)} KB)`)
    generated++
    manifest.push(describe(piece, file, 'generated'))
  } catch (error) {
    console.log(`failed — ${error.message}`)
    failed++
  }
}

await recordCredits(manifest)

console.log('')
console.log(`${generated} generated, ${skipped} already present, ${failed} failed.`)
if (failed > 0) {
  console.log('Failures are not fatal: the app falls back to its CSS/SVG treatments.')
}

function describe(piece, file, state) {
  return {
    file,
    id: piece.id,
    state,
    model: MODEL,
    size: piece.size,
    background: piece.background,
    containsGeneratedText: false,
    note: 'Original artwork generated for this project. Logos and copy are composited in HTML/SVG, never generated.',
    generatedAt: new Date().toISOString().slice(0, 10),
  }
}

async function recordCredits(entries) {
  if (entries.length === 0) return
  try {
    const p = 'data/image-credits.json'
    const credits = JSON.parse(await readFile(p, 'utf8'))
    const byId = new Map((credits.generatedArt.files ?? []).map((f) => [f.id, f]))
    for (const entry of entries) byId.set(entry.id, entry)
    credits.generatedArt.files = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
    await writeFile(p, JSON.stringify(credits, null, 2) + '\n')
  } catch (error) {
    console.warn(`could not update data/image-credits.json: ${error.message}`)
  }
}

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}
