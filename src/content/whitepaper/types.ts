/**
 * Whitepaper content model.
 *
 * Prose lives in typed content modules rather than in the message dictionaries
 * or in JSX. Long-form text in JSON becomes unreadable and unreviewable, and
 * in JSX it cannot be localised — this keeps it editable, diffable and
 * translatable, with one module per locale.
 *
 * Dynamic facts (deployment state, addresses, machine configuration) are
 * never written here. Blocks reference them by kind and the renderer reads
 * them from the live application, so the paper cannot drift from the product.
 */

export type CalloutKind = 'note' | 'important' | 'security' | 'demo' | 'formula' | 'onchain' | 'risk'

export type Block =
  | { t: 'p'; text: string }
  /** A bulleted list. Keep items to one line each. */
  | { t: 'ul'; items: string[] }
  /** A numbered list where order carries meaning. */
  | { t: 'ol'; items: string[] }
  | { t: 'h3'; text: string }
  | { t: 'callout'; kind: CalloutKind; title?: string; text: string }
  | { t: 'code'; lang: string; code: string; caption?: string }
  | { t: 'table'; head: string[]; rows: string[][]; caption?: string }
  /** Key/value facts rendered as a definition grid. */
  | { t: 'facts'; items: { label: string; value: string }[] }
  /** A horizontal flow: A → B → C. Rendered as HTML, never baked into art. */
  | { t: 'flow'; steps: { label: string; detail?: string }[] }
  /** A step with consumer copy and optional technical detail behind a toggle. */
  | { t: 'steps'; items: { n: string; title: string; body: string; technical?: string }[] }
  /** Pulls a generated art asset in at a readable size. */
  | { t: 'art'; id: string; alt: string; width?: 'narrow' | 'wide' }
  /** Renders live application state. `kind` selects which. */
  | { t: 'live'; kind: 'deployment' | 'machines' | 'contracts' | 'tokens' | 'odds-link' }

export interface Chapter {
  /** Stable anchor. Deep links depend on these, so do not rename casually. */
  id: string
  /** Two-digit index shown in the contents rail. */
  index: string
  title: string
  /** One line under the chapter title. */
  lede?: string
  blocks: Block[]
}

export interface WhitepaperContent {
  version: string
  title: string
  subtitle: string
  chapters: Chapter[]
}
