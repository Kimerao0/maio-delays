import { parseQuery, type RawSearchParams, toQuery } from '@/lib/query'
import { parseSort, toSort } from '@/lib/sort'

export const COOKIE = 'filtri'

const MAX_AGE = 60 * 60 * 24 * 365

// Every param the table reads, the sort included. It must hold every key `toQuery` and `toSort` can
// emit, or a redirect target would not short-circuit and the proxy would loop.
const KEYS = ['events', 'period', 'occ', 'venue', 'divs', 'min', 'raro', 'sort', 'dir'] as const

export function hasFilterParams(params: URLSearchParams): boolean {
  return KEYS.some((key) => params.has(key))
}

// The shape Next's own searchParams has: parseSort compares `sp.sort` with `===` against a string,
// so a key seen once has to be that string and not a one-element array.
function toRaw(params: URLSearchParams): RawSearchParams {
  const raw: RawSearchParams = {}
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key)
    raw[key] = values.length > 1 ? values : values[0]
  }
  return raw
}

// The sanitiser: junk, duplicates and defaults all drop, so a hostile cookie can only ever produce
// a query this app itself would write.
export function canonical(search: string): string {
  const raw = toRaw(new URLSearchParams(search))
  const params = toQuery(parseQuery(raw))
  for (const [key, value] of toSort(parseSort(raw))) params.append(key, value)
  return params.toString()
}

// Conditional, not unconditional: a Secure cookie written over plain http is dropped by the
// browser, and `next dev` is http. On https it is what stops a plaintext request to the same host
// from overwriting the choice — which is also why it belongs here and not in `remember`: a delete
// that lacks it cannot clear a cookie that has it.
function secureAttr(): string {
  return location.protocol === 'https:' ? '; Secure' : ''
}

function write(value: string, maxAge: number): void {
  // What goes in here is one short ASCII value this module builds and encodes itself.
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is Chromium-only.
  document.cookie = `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureAttr()}`
}

export function remember(search: string): void {
  const value = canonical(search)
  if (value === '') {
    forget()
    return
  }
  write(encodeURIComponent(value), MAX_AGE)
}

export function forget(): void {
  write('', 0)
}

// The value arrives already percent-decoded, because `request.cookies.get()` decodes it; one Next
// could not decode never arrives at all.
export function savedSearch(cookie: string | undefined): string {
  if (!cookie) return ''
  return canonical(cookie)
}
