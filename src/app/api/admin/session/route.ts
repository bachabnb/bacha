import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'
import { ADMIN_COOKIE } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

/** Exchanges the operator token for a session cookie. */
export async function POST(request: Request) {
  const { adminToken } = serverEnv()
  if (!adminToken) {
    return NextResponse.json({ error: 'Admin console is disabled.' }, { status: 404 })
  }

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supplied = typeof body.token === 'string' ? body.token : ''
  if (!constantTimeEqual(supplied, adminToken)) {
    return NextResponse.json({ error: 'Rejected.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, adminToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_COOKIE)
  return response
}

/** Compares without leaking length or position through timing. */
function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    // Still do the work, so a wrong length is not distinguishable by timing.
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}
