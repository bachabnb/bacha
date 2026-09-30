import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

/**
 * Locale routing, plus the hook a jurisdiction block would use.
 *
 * `BACHA_BLOCKED_COUNTRIES` is read here rather than in the app so a blocked
 * request never reaches a page that could take money. The country comes from
 * the host in front of the app — Vercel, or Cloudflare everywhere else — so
 * self-hosting means serving only through Cloudflare. Bacha makes no claim
 * about where it is or is not permitted.
 */
export default function middleware(request: NextRequest) {
  const blocked = (process.env.BACHA_BLOCKED_COUNTRIES ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

  if (blocked.length > 0) {
    // Read only the header the host in front of us sets — named explicitly by
    // BACHA_GEO_HEADER (x-vercel-ip-country on Vercel, cf-ipcountry behind
    // Cloudflare). Cloudflare passes client-sent headers through, so reading
    // any other header would let a visitor pick their own country. The
    // VERCEL fallback only helps when system variables are exposed.
    const header =
      process.env.BACHA_GEO_HEADER?.trim().toLowerCase() ||
      (process.env.VERCEL ? 'x-vercel-ip-country' : 'cf-ipcountry')
    const country = (request.headers.get(header) ?? '').toUpperCase()

    // In production a missing or unknowable country — no header, Cloudflare's
    // XX (unknown) or T1 (Tor) — is refused rather than waved through, since
    // it is exactly what someone routing around the block would present.
    const unknown = !country || country === 'XX' || country === 'T1'
    const refused = blocked.includes(country) || (unknown && process.env.NODE_ENV === 'production')

    if (refused) {
      // A redirect, to a path the matcher below excludes. Rewriting instead
      // sent /unavailable back through locale routing in production, which
      // prefixed it to /en/unavailable, which was refused again — a loop.
      // Built from the forwarded host and scheme: behind a tunnel the app
      // itself only ever sees http://localhost, and middleware redirects
      // must be absolute.
      const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.nextUrl.protocol.replace(':', '')
      const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
      return NextResponse.redirect(new URL('/unavailable', `${proto}://${host}`), 307)
    }
  }

  return intlMiddleware(request)
}

/**
 * Locale routing applies to public pages only.
 *
 * Everything excluded here either has no locale (the operator console, the
 * region-block page, the metadata routes Next generates, static assets) or
 * would break if it were redirected into a locale prefix.
 */
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|admin|unavailable|icon|apple-icon|opengraph-image|twitter-image|manifest|sitemap|robots|art|photos|tokens|brand|.*\\..*).*)',
  ],
}
