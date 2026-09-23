import type { MetadataRoute } from 'next'
import { defaultLocale } from '@/i18n/routing'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bacha — Gacha on BNB Chain',
    short_name: 'Bacha',
    description: 'Spin the machine and pull real tokens from across the BNB Chain ecosystem.',
    start_url: `/${defaultLocale}`,
    scope: '/',
    display: 'standalone',
    background_color: '#080b0d',
    theme_color: '#f0b90b',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
