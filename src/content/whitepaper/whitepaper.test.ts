import { describe, expect, it } from 'vitest'
import { en } from './en'
import { zhCN } from './zh-CN'
import type { Block, WhitepaperContent } from './types'

/**
 * The two locales are separate hand-written modules, which is the only way to
 * get readable prose in both. The cost is that they can drift — a chapter
 * added to one and not the other, a table gaining a column, a `live` block
 * pointing at a different panel. These tests make that drift a failing build
 * rather than a broken page in a language the author does not read.
 */

/** Every human-readable string in the document, flattened. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

const locales: [string, WhitepaperContent][] = [
  ['en', en],
  ['zh-CN', zhCN],
]

/** A shape signature that ignores prose but captures everything structural. */
function signature(block: Block): string {
  switch (block.t) {
    case 'ul':
    case 'ol':
      return `${block.t}:${block.items.length}`
    case 'callout':
      return `callout:${block.kind}`
    case 'code':
      return `code:${block.lang}`
    case 'table':
      return `table:${block.head.length}x${block.rows.length}`
    case 'facts':
      return `facts:${block.items.length}`
    case 'flow':
      return `flow:${block.steps.length}`
    case 'steps':
      return `steps:${block.items.map((i) => i.n).join(',')}`
    case 'art':
      return `art:${block.id}:${block.width ?? 'narrow'}`
    case 'live':
      return `live:${block.kind}`
    default:
      return block.t
  }
}

describe.each(locales)('whitepaper (%s)', (_name, doc) => {
  it('declares a version and a title', () => {
    expect(doc.version).toMatch(/^\d+\.\d+$/)
    expect(doc.title.trim().length).toBeGreaterThan(0)
    expect(doc.subtitle.trim().length).toBeGreaterThan(0)
  })

  it('has unique, URL-safe chapter anchors', () => {
    const ids = doc.chapters.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('numbers chapters consecutively from 00', () => {
    doc.chapters.forEach((chapter, i) => {
      expect(chapter.index).toBe(String(i).padStart(2, '0'))
    })
  })

  it('gives every chapter a title and at least one block', () => {
    for (const chapter of doc.chapters) {
      expect(chapter.title.trim().length).toBeGreaterThan(0)
      expect(chapter.blocks.length).toBeGreaterThan(0)
    }
  })

  it('keeps every table rectangular', () => {
    for (const chapter of doc.chapters) {
      for (const block of chapter.blocks) {
        if (block.t !== 'table') continue
        for (const row of block.rows) {
          expect(row, `${chapter.id}: ${row[0]}`).toHaveLength(block.head.length)
        }
      }
    }
  })

  it('never hardcodes a contract address', () => {
    // Addresses belong to `live` blocks, which read them from the app. A
    // literal address in prose is one that can silently go stale or wrong.
    const offenders = strings(doc).filter((s) => /0x[a-fA-F0-9]{40}/.test(s))
    expect(offenders).toEqual([])
  })

  it('never claims an audit', () => {
    // Every mention of auditing must be a denial. Asserting on the matching
    // sentences rather than the whole document keeps a failure readable.
    const claims = strings(doc)
      .flatMap((s) => s.split(/(?<=[.。])\s*/))
      .filter((s) => /audit|审计/i.test(s))
      .filter((s) => !/not been audited|not yet audited|unaudited|(尚未|未经|没有)[^。]*审计|不能替代/i.test(s))
    expect(claims).toEqual([])
  })

  it('never implies a Bacha token', () => {
    const claims = strings(doc).filter((s) => /\$bacha|bacha token(?! *—)/i.test(s))
    expect(claims).toEqual([])
  })
})

describe('whitepaper locale parity', () => {
  it('covers the same chapters in the same order', () => {
    expect(zhCN.chapters.map((c) => c.id)).toEqual(en.chapters.map((c) => c.id))
    expect(zhCN.chapters.map((c) => c.index)).toEqual(en.chapters.map((c) => c.index))
  })

  it('declares the same document version', () => {
    expect(zhCN.version).toBe(en.version)
  })

  it('matches block structure chapter for chapter', () => {
    en.chapters.forEach((chapter, i) => {
      const other = zhCN.chapters[i]
      expect(other.blocks.map(signature), `chapter ${chapter.id}`).toEqual(
        chapter.blocks.map(signature),
      )
    })
  })

  it('carries a lede in both locales or neither', () => {
    en.chapters.forEach((chapter, i) => {
      expect(Boolean(zhCN.chapters[i].lede), `chapter ${chapter.id}`).toBe(Boolean(chapter.lede))
    })
  })

  it('is actually translated', () => {
    // A copy-pasted English chapter would pass every structural check above.
    for (const [i, chapter] of en.chapters.entries()) {
      expect(zhCN.chapters[i].title, `chapter ${chapter.id}`).not.toBe(chapter.title)
    }
  })
})
