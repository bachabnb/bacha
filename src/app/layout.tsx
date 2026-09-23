import type { ReactNode } from 'react'

/**
 * Root layout is deliberately a pass-through.
 *
 * Everything that depends on locale — the `lang` attribute, fonts, metadata,
 * message provider — lives in `app/[locale]/layout.tsx`, because only that
 * layout knows which locale is being served.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
