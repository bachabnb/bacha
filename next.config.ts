import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'assets.coingecko.com' },
    ],
  },
  eslint: { dirs: ['src', 'scripts'] },
  /**
   * `wagmi/connectors` is a barrel, so importing any connector drags in the
   * Base Account one, which reaches for `@coinbase/cdp-sdk` and a set of
   * `@x402/*` packages that are optional and not installed. Bacha never uses
   * that connector — `injected` already covers every browser wallet we care
   * about — so the subtree is stubbed out rather than installed.
   */
  webpack(config) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@base-org/account': false,
      '@coinbase/cdp-sdk': false,
      // React Native storage, reached for by the MetaMask SDK. There is no
      // React Native here, so it resolves to nothing rather than failing.
      '@react-native-async-storage/async-storage': false,
      // Optional pretty-printer that WalletConnect's logger reaches for in
      // development. Production logs are JSON, so it is never needed.
      'pino-pretty': false,
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
