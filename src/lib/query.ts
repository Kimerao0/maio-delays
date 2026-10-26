import { type Direction, EVENTS, type EventId, type Period } from '@/lib/events'
import { LEAGUES } from '@/lib/leagues'
import type { Venue } from '@/lib/streaks'

export type Query = {
  events: EventId[]
  period: Period
  direction: Direction
  venue: Venue
  divs: string[]
  min: number
  rarity: number
}

export type RawSearchParams = Record<string, string | string[] | undefined>

const ALL_EVENTS: EventId[] = EVENTS.map((e) => e.id)
const ALL_DIVS: string[] = LEAGUES.map((l) => l.div)
const DEFAULT_PERIOD: Period = 'ft'
const DEFAULT_DIRECTION: Direction = 'not'
const DEFAULT_VENUE: Venue = 'all'
const DEFAULT_MIN = 12
const DEFAULT_RARITY = 1

export const MIN_STREAK = 1
export const MAX_STREAK = 60

// A rarity worth a floor spans six orders of magnitude; 1 is the floor that keeps nothing out.
export const MIN_RARITY = 1
export const MAX_RARITY = 1_000_000

// The URL says it in Italian, the way the filter reads: `occ=si` or `occ=no`.
const OCC: Record<Direction, string> = { not: 'no', yes: 'si' }

function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

// Keeps only known ids, in the canonical order; empty result falls back to all.
function pickInOrder<T extends string>(raw: string[], canonical: readonly T[]): T[] {
  const wanted = new Set(raw)
  const picked = canonical.filter((id) => wanted.has(id))
  return picked.length > 0 ? picked : [...canonical]
}

function readEvents(sp: RawSearchParams): EventId[] {
  return pickInOrder(toList(sp.events), ALL_EVENTS)
}

function readPeriod(sp: RawSearchParams): Period {
  const [value] = toList(sp.period)
  if (value === 'ft' || value === 'ht') return value
  return DEFAULT_PERIOD
}

function readDirection(sp: RawSearchParams): Direction {
  const [value] = toList(sp.occ)
  if (value === OCC.yes) return 'yes'
  return DEFAULT_DIRECTION
}

function readVenue(sp: RawSearchParams): Venue {
  const [value] = toList(sp.venue)
  if (value === 'home' || value === 'away' || value === 'all') return value
  return DEFAULT_VENUE
}

function readDivs(sp: RawSearchParams): string[] {
  return pickInOrder(toList(sp.divs), ALL_DIVS)
}

function readMin(sp: RawSearchParams): number {
  const [value] = toList(sp.min)
  if (value === undefined || !/^-?\d+$/.test(value.trim())) return DEFAULT_MIN
  return clampMin(Number.parseInt(value, 10))
}

function clampMin(n: number): number {
  return Math.min(MAX_STREAK, Math.max(MIN_STREAK, n))
}

// The URL says `raro`, the same word the column it filters is sorted by.
function readRarity(sp: RawSearchParams): number {
  const [value] = toList(sp.raro)
  if (value === undefined || !/^-?\d+$/.test(value.trim())) return DEFAULT_RARITY
  return clampRarity(Number.parseInt(value, 10))
}

function clampRarity(n: number): number {
  return Math.min(MAX_RARITY, Math.max(MIN_RARITY, n))
}

export function parseQuery(sp: RawSearchParams): Query {
  return {
    events: readEvents(sp),
    period: readPeriod(sp),
    direction: readDirection(sp),
    venue: readVenue(sp),
    divs: readDivs(sp),
    min: readMin(sp),
    rarity: readRarity(sp),
  }
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function toQuery(q: Query): URLSearchParams {
  const params = new URLSearchParams()
  const events = pickInOrder(q.events, ALL_EVENTS)
  const divs = pickInOrder(q.divs, ALL_DIVS)
  const min = clampMin(q.min)
  const rarity = clampRarity(q.rarity)
  if (!sameList(events, ALL_EVENTS)) for (const id of events) params.append('events', id)
  if (q.period !== DEFAULT_PERIOD) params.set('period', q.period)
  if (q.direction !== DEFAULT_DIRECTION) params.set('occ', OCC[q.direction])
  if (q.venue !== DEFAULT_VENUE) params.set('venue', q.venue)
  if (!sameList(divs, ALL_DIVS)) for (const div of divs) params.append('divs', div)
  if (min !== DEFAULT_MIN) params.set('min', String(min))
  if (rarity !== DEFAULT_RARITY) params.set('raro', String(rarity))
  return params
}
