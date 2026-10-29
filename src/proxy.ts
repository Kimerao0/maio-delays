import { type NextRequest, NextResponse } from 'next/server'
import { COOKIE, hasFilterParams, savedSearch } from '@/lib/remember'

// A shared link says what to show on its own, so only a bare `/` falls back to the saved filters.
export function proxy(request: NextRequest): NextResponse {
  // A Server Function posts to the route it lives on, and a 307 keeps the method, so a body would
  // be replayed at a different URL.
  if (request.method !== 'GET') return NextResponse.next()
  if (hasFilterParams(request.nextUrl.searchParams)) return NextResponse.next()
  const saved = savedSearch(request.cookies.get(COOKIE)?.value)
  if (saved === '') return NextResponse.next()
  const url = request.nextUrl.clone()
  url.search = saved
  return NextResponse.redirect(url)
}

export const config = { matcher: '/' }
