import { type EventId, occurred, type Period, type Side } from '@/lib/events'
import type { Match } from '@/lib/matches'

export type Venue = 'home' | 'away' | 'all'

export type Ritardo = {
  div: string
  team: string
  event: EventId
  period: Period
  streak: number
  lastMatch: Date
}

export type RitardoOpts = {
  events: EventId[]
  period: Period
  venue: Venue
  min: number
}

// One match seen from one team's point of view.
type TeamMatch = { match: Match; side: Side }

function addEntry(byTeam: Map<string, TeamMatch[]>, team: string, entry: TeamMatch): void {
  const entries = byTeam.get(team)
  if (entries) {
    entries.push(entry)
    return
  }
  byTeam.set(team, [entry])
}

function groupByTeam(matches: Match[]): Map<string, TeamMatch[]> {
  const byTeam = new Map<string, TeamMatch[]>()
  for (const match of matches) {
    addEntry(byTeam, match.home, { match, side: 'home' })
    addEntry(byTeam, match.away, { match, side: 'away' })
  }
  return byTeam
}

function inVenue(side: Side, venue: Venue): boolean {
  if (venue === 'all') return true
  return side === venue
}

// The kept matches are consecutive among themselves: the ones filtered out are not breaks.
function scopedEntries(entries: TeamMatch[], venue: Venue): TeamMatch[] {
  return entries
    .filter((entry) => inVenue(entry.side, venue))
    .sort((a, b) => b.match.date.getTime() - a.match.date.getTime())
}

function runOf(entries: TeamMatch[], event: EventId, period: Period): TeamMatch[] {
  const run: TeamMatch[] = []
  for (const entry of entries) {
    if (occurred(event, entry.match, entry.side, period)) return run
    run.push(entry)
  }
  return run
}

function compareRitardi(a: Ritardo, b: Ritardo): number {
  return b.streak - a.streak || a.div.localeCompare(b.div) || a.team.localeCompare(b.team)
}

export function computeRitardi(matches: Match[], opts: RitardoOpts): Ritardo[] {
  const rows: Ritardo[] = []
  for (const [team, entries] of groupByTeam(matches)) {
    const scoped = scopedEntries(entries, opts.venue)
    if (scoped.length === 0) continue
    const newest = scoped[0].match
    for (const event of opts.events) {
      const streak = runOf(scoped, event, opts.period).length
      if (streak < opts.min) continue
      rows.push({
        div: newest.div,
        team,
        event,
        period: opts.period,
        streak,
        lastMatch: newest.date,
      })
    }
  }
  return rows.sort(compareRitardi)
}

export function streakMatches(
  matches: Match[],
  team: string,
  event: EventId,
  period: Period,
  venue: Venue,
): Match[] {
  const entries = groupByTeam(matches).get(team)
  if (!entries) return []
  return runOf(scopedEntries(entries, venue), event, period).map((entry) => entry.match)
}
