import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Inter, Inter_Tight, JetBrains_Mono, Noto_Sans_SC } from 'next/font/google'
import { Providers } from '@/app/providers'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { AgeGate } from '@/components/site/AgeGate'
import { ThemeScript } from '@/lib/theme/ThemeScript'
import { routing, locales, localeMeta, type Locale } from '@/i18n/routing'
import { publicEnv } from '@/lib/env'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-code', display: 'swap' })

/**
 * A real CJK face, loaded only for the Chinese locale. Without this, Chinese
 * falls through to whatever serif the OS picks, which looks broken next to
 * the Latin type.
 */
const notoSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-sc',
  display: 'swap',
  preload: false,
})

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })
  const base = publicEnv.siteUrl

  return {
    metadataBase: new URL(base),
    title: { default: t('title'), template: t('titleTemplate', { page: '%s' }) },
    description: t('description'),
    applicationName: 'Bacha',
    keywords: ['BNB Chain', 'BEP-20', 'gacha', 'onchain game', 'Chainlink VRF', 'token discovery'],
    alternates: {
      canonical: `${base}/${locale}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [localeMeta[l as Locale].html, `${base}/${l}`]),
        ['x-default', `${base}/${routing.defaultLocale}`],
      ]),
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `${base}/${locale}`,
      siteName: 'Bacha',
      type: 'website',
      locale: locale === 'zh-CN' ? 'zh_CN' : 'en_US',
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
    robots: { index: true, follow: true },
    manifest: '/manifest.webmanifest',
  }
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#080b0d' },
    { media: '(prefers-color-scheme: light)', color: '#f6f7f3' },
  ],
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'nav' })
  const fontVars = `${inter.variable} ${interTight.variable} ${mono.variable} ${
    locale === 'zh-CN' ? notoSC.variable : ''
  }`

  return (
    <html lang={localeMeta[locale as Locale].html} suppressHydrationWarning className={fontVars}>
      <body className="min-h-dvh bg-background antialiased">
        {/* First thing in the body so the theme is set before anything paints.
            In <head> the App Router can relocate it, which reintroduces the
            flash this exists to prevent. */}
        <ThemeScript />
        <NextIntlClientProvider>
          <Providers>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-foreground"
            >
              {t('skipToContent')}
            </a>
            <SiteHeader />
            <main id="main" className="-mt-[78px] pt-[78px] sm:-mt-[90px] sm:pt-[90px]">{children}</main>
            <SiteFooter />
            <AgeGate />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
