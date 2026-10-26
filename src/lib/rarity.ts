import { EVENTS, type EventId, occurred, type Period, type Side } from '@/lib/events'
import type { Match } from '@/lib/matches'
import type { Ritardo, Venue } from '@/lib/streaks'

export type BaseRates = ReadonlyMap<EventId, number>

export type Ranked = Ritardo & { oneIn: number }

const BOTH_SIDES: readonly Side[] = ['home', 'away']

function sidesOf(venue: Venue): readonly Side[] {
  if (venue === 'all') return BOTH_SIDES
  return [venue]
}

function hitsOf(id: EventId, matches: Match[], sides: readonly Side[], period: Period): number {
  let hits = 0
  for (const match of matches) {
    for (const side of sides) {
      if (occurred(id, match, side, period)) hits += 1
    }
  }
  return hits
}

// Laplace smoothing, not the raw fraction: a short season can make an event hit never or always,
// and a rate of exactly 0 or 1 degenerates every rarity derived from it.
export function baseRates(matches: Match[], period: Period, venue: Venue): BaseRates {
  const sides = sidesOf(venue)
  const pairs = matches.length * sides.length
  const rates = new Map<EventId, number>()
  for (const event of EVENTS) {
    rates.set(event.id, (hitsOf(event.id, matches, sides, period) + 1) / (pairs + 2))
  }
  return rates
}

// A run of non-occurrences repeats the complement of the rate, a run of occurrences the rate
// itself. Laplace smoothing keeps the rate inside (0, 1), so neither form divides by zero.
function chanceOf(row: Ritardo, rate: number): number {
  if (row.direction === 'yes') return rate ** row.streak
  return (1 - rate) ** row.streak
}

function oneInOf(row: Ritardo, rates: BaseRates): number {
  const rate = rates.get(row.event) ?? 0
  return Math.round(1 / chanceOf(row, rate))
}

function compareRanked(a: Ranked, b: Ranked): number {
  return (
    b.oneIn - a.oneIn ||
    b.streak - a.streak ||
    a.div.localeCompare(b.div) ||
    a.team.localeCompare(b.team)
  )
}

// A run is ranked by how unlikely it is given how often the event actually happens, so a short run
// of a frequent event outranks a long run of a rare one.
export function rankByRarity(rows: Ritardo[], rates: BaseRates): Ranked[] {
  return rows.map((row) => ({ ...row, oneIn: oneInOf(row, rates) })).sort(compareRanked)
}
