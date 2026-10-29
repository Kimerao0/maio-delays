import { expect, test } from 'vitest'
import { type Query, toQuery } from '@/lib/query'
import { canonical, hasFilterParams, savedSearch } from '@/lib/remember'
import { toSort } from '@/lib/sort'

test('drops everything that is already at its default', () => {
  expect(canonical('')).toBe('')
  expect(canonical('?min=12&raro=1')).toBe('')
})

test('keeps a narrowed query', () => {
  const params = new URLSearchParams(canonical('?divs=E0&divs=I1&min=20'))
  expect(params.getAll('divs')).toEqual(['I1', 'E0'])
  expect(params.get('min')).toBe('20')
})

test('drops a param the app never reads', () => {
  expect(canonical('?fbclid=abc')).toBe('')
})

test('neutralises a hostile value', () => {
  expect(canonical('?divs=https://evil.test')).toBe('')
})

test('drops the default sort and keeps a real one', () => {
  expect(canonical('?sort=raro&dir=desc')).toBe('')
  expect(canonical('?sort=lega&dir=asc')).toBe('sort=lega&dir=asc')
})

test('sees the filter params and nothing else', () => {
  expect(hasFilterParams(new URLSearchParams('divs=I1'))).toBe(true)
  expect(hasFilterParams(new URLSearchParams('fbclid=abc'))).toBe(false)
})

test('reads nothing back from a missing or junk cookie', () => {
  expect(savedSearch(undefined)).toBe('')
  expect(savedSearch('')).toBe('')
  expect(savedSearch('not a query')).toBe('')
})

test('round-trips a saved value', () => {
  expect(savedSearch('divs=I1&min=20')).toBe('divs=I1&min=20')
})

// A key `toQuery` can emit but `hasFilterParams` does not know would make the proxy redirect to a
// URL it redirects again. The `Query` literal is what gives this teeth: a new filter field fails to
// compile here, and a new emitted key fails the assertion.
test('every param the app writes is one the proxy sees', () => {
  const narrowed: Query = {
    events: ['draw'],
    period: 'ht',
    direction: 'yes',
    venue: 'home',
    divs: ['I1'],
    min: 20,
    rarity: 250,
  }
  const params = toQuery(narrowed)
  for (const [key, value] of toSort({ key: 'lega', dir: 'asc' })) params.append(key, value)
  for (const [key] of params) {
    expect(hasFilterParams(new URLSearchParams([[key, 'x']]))).toBe(true)
  }
})
