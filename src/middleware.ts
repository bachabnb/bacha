import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

/**
 * Locale routing, plus the hook a jurisdiction block would use.
 *
 * `BACHA_BLOCKED_COUNTRIES` is read here rather than in the app so a blocked
 * request never reaches a page that could take money. It is off unless
 * configured — Bacha makes no claim about where it is or is not permitted.
 */
export default function middleware(request: NextRequest) {
  const blocked = (process.env.BACHA_BLOCKED_COUNTRIES ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

  if (blocked.length > 0) {
    const country = (
      request.headers.get('x-vercel-ip-country') ??
      request.headers.get('cf-ipcountry') ??
      ''
    ).toUpperCase()

    if (country && blocked.includes(country) && !request.nextUrl.pathname.startsWith('/unavailable')) {
      const url = request.nextUrl.clone()
      url.pathname = '/unavailable'
      return NextResponse.rewrite(url)
    }
  }

  return intlMiddleware(request)
}

/**
 * Locale routing applies to public pages only.
 *
 * Everything excluded here either has no locale (the operator console, the
 * metadata routes Next generates, static assets) or would break if it were
 * redirected into a locale prefix.
 */
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|admin|icon|apple-icon|opengraph-image|twitter-image|manifest|sitemap|robots|art|photos|tokens|brand|.*\\..*).*)',
  ],
}
