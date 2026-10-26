import { type Fixture, type Match, parseFixtures, parseMatches } from '@/lib/matches'
import { currentSeasonCode } from '@/lib/season'

export type Snapshot = {
  matches: Match[]
  fixtures: Fixture[]
  fetchedAt: Date
  failed: string[]
}

// The www. host answers these paths with a 302; the bare host serves them directly.
const HOST = 'https://football-data.co.uk'

// Three hours, per the spec.
const REVALIDATE = 10800

export const FIXTURES_URL = `${HOST}/fixtures.csv`

export function resultsUrl(div: string, season: string): string {
  return `${HOST}/mmz4281/${season}/${div}.csv`
}

async function fetchText(url: string): Promise<string> {
  // `force-cache` is what opts this into the cache at all — Next 16 caching is opt-in, and the page
  // reads searchParams, so without it every visitor would re-download all 21 CSVs. `revalidate`
  // only sets the lifetime of an already-cached entry.
  const response = await fetch(url, { cache: 'force-cache', next: { revalidate: REVALIDATE } })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.text()
}

async function loadDivision(div: string, season: string): Promise<Match[]> {
  const matches = parseMatches(await fetchText(resultsUrl(div, season)))
  // A truncated or empty body parses as zero matches: a failure, not a league that played none.
  if (matches.length === 0) throw new Error(`${div} returned no matches`)
  return matches
}

export async function loadSnapshot(divs: string[], now = new Date()): Promise<Snapshot> {
  const season = currentSeasonCode(now)
  const divisions = divs.map((div) => loadDivision(div, season))
  // Handled where it is started, so the rejection is never unhandled while the divisions settle.
  const fixtures = fetchText(FIXTURES_URL)
    .then(parseFixtures)
    .catch(() => null)

  const results = await Promise.allSettled(divisions)
  const matches: Match[] = []
  const failed: string[] = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failed.push(divs[index])
      return
    }
    matches.push(...result.value)
  })

  const loaded = await fixtures
  if (!loaded) failed.push('fixtures')
  return { matches, fixtures: loaded ?? [], fetchedAt: now, failed }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// Calendar day, not timestamp: a fixture kicking off tonight is still upcoming at 21:00.
function isUpcoming(fixture: Fixture, div: string, team: string, from: number): boolean {
  if (fixture.div !== div) return false
  if (fixture.home !== team && fixture.away !== team) return false
  return startOfDay(fixture.date).getTime() >= from
}

export function nextFixture(
  fixtures: Fixture[],
  div: string,
  team: string,
  now: Date,
): Fixture | null {
  const from = startOfDay(now).getTime()
  const upcoming = fixtures
    .filter((fixture) => isUpcoming(fixture, div, team, from))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  return upcoming[0] ?? null
}
