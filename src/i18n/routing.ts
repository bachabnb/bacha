import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'

export const locales = ['en', 'zh-CN'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** Display metadata for the language selector. */
export const localeMeta: Record<Locale, { label: string; english: string; html: string }> = {
  en: { label: 'EN', english: 'English', html: 'en' },
  'zh-CN': { label: '中文', english: 'Simplified Chinese', html: 'zh-Hans-CN' },
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Every locale carries its prefix, so /en and /zh-CN are both real URLs and
  // hreflang has something concrete to point at.
  localePrefix: 'always',
  localeDetection: true,
})

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
