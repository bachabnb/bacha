import type { Locale } from '@/i18n/routing'
import type { WhitepaperContent } from './types'
import { en } from './en'
import { zhCN } from './zh-CN'

/**
 * One content module per locale, keyed by the same locale codes as routing.
 *
 * Both modules are imported eagerly rather than dynamically: they are static
 * data, the route is statically generated per locale, and the bundler drops
 * the unused one from each page's payload anyway.
 */
const modules: Record<Locale, WhitepaperContent> = {
  en,
  'zh-CN': zhCN,
}

export function getWhitepaper(locale: Locale): WhitepaperContent {
  return modules[locale] ?? en
}

export type { WhitepaperContent }
export * from './types'
