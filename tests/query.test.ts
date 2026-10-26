import { expect, test } from 'vitest'
import { EVENTS } from '@/lib/events'
import { LEAGUES } from '@/lib/leagues'
import { parseQuery, type Query, type RawSearchParams, toQuery } from '@/lib/query'

test('defaults match the spec', () => {
  expect(parseQuery({})).toEqual({
    events: EVENTS.map((e) => e.id),
    period: 'ft',
    direction: 'not',
    venue: 'all',
    divs: LEAGUES.map((l) => l.div),
    min: 12,
    rarity: 1,
  })
})

test('round-trips a narrowed query', () => {
  const q: Query = {
    events: ['draw'],
    period: 'ht',
    direction: 'yes',
    venue: 'home',
    divs: ['I1'],
    min: 8,
    rarity: 250,
  }
  expect(parseQuery(Object.fromEntries(toQuery(q)))).toEqual(q)
})

test('rejects an unknown event id and falls back to all events', () => {
  expect(parseQuery({ events: 'nonsense' }).events).toHaveLength(12)
})

test('clamps min below 1 and above 60', () => {
  expect(parseQuery({ min: '0' }).min).toBe(1)
  expect(parseQuery({ min: '999' }).min).toBe(60)
})

test('clamps raro to 1..1000000 and falls back to 1 on anything else', () => {
  expect(parseQuery({ raro: '0' }).rarity).toBe(1)
  expect(parseQuery({ raro: '9999999' }).rarity).toBe(1_000_000)
  expect(parseQuery({ raro: '2,5k' }).rarity).toBe(1)
})

test('round-trips the rarity floor and omits it at the default', () => {
  const q: Query = { ...parseQuery({}), rarity: 2500 }
  expect(toQuery(q).get('raro')).toBe('2500')
  expect(parseQuery(Object.fromEntries(toQuery(q)))).toEqual(q)
  expect(toQuery({ ...q, rarity: 1 }).has('raro')).toBe(false)
})

test('round-trips a multi-value query through a real URLSearchParams', () => {
  const q: Query = {
    events: ['win', 'btts'],
    period: 'ht',
    direction: 'yes',
    venue: 'away',
    divs: ['I1', 'E0', 'D1'],
    min: 10,
    rarity: 1000,
  }
  const params = toQuery(q)
  const raw: RawSearchParams = {}
  for (const key of new Set(params.keys())) raw[key] = params.getAll(key)
  expect(parseQuery(raw)).toEqual(q)
})

test('canonicalises a caller-ordered list so the round-trip still holds', () => {
  const q: Query = {
    events: ['btts', 'win', 'draw'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    divs: ['SP1', 'I1', 'E0'],
    min: 6,
    rarity: 50,
  }
  const params = toQuery(q)
  const raw: RawSearchParams = {}
  for (const key of new Set(params.keys())) raw[key] = params.getAll(key)
  expect(parseQuery(raw)).toEqual({
    ...q,
    events: ['win', 'draw', 'btts'],
    divs: ['I1', 'E0', 'SP1'],
  })
})

test('a default query produces an empty query string', () => {
  expect(toQuery(parseQuery({})).toString()).toBe('')
})
