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

function matchesOf(entries: TeamMatch[]): Match[] {
  return entries.map((entry) => entry.match)
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
  return matchesOf(runOf(scopedEntries(entries, venue), event, period))
}

export function runKey(div: string, team: string, event: EventId): string {
  return `${div}|${team}|${event}`
}

// The run behind every row at once: streakMatches groups the whole season per call, which a table
// of hundreds of rows cannot afford to pay once per row.
export function streakRuns(
  matches: Match[],
  rows: Ritardo[],
  period: Period,
  venue: Venue,
): Map<string, Match[]> {
  const scoped = new Map<string, TeamMatch[]>()
  for (const [team, entries] of groupByTeam(matches)) {
    scoped.set(team, scopedEntries(entries, venue))
  }
  const runs = new Map<string, Match[]>()
  for (const row of rows) {
    const entries = scoped.get(row.team)
    if (!entries) continue
    runs.set(runKey(row.div, row.team, row.event), matchesOf(runOf(entries, row.event, period)))
  }
  return runs
}
