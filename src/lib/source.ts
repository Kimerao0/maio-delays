import { type Fixture, type Match, parseFixtures, parseMatches } from '@/lib/matches'
import { currentSeasonCode } from '@/lib/season'

export type Snapshot = {
  matches: Match[]
  fixtures: Fixture[]
  // When the bodies were downloaded, not when this request rendered; null when nothing was.
  fetchedAt: Date | null
  failed: string[]
}

// The www. host answers these paths with a 302; the bare host serves them directly.
const HOST = 'https://football-data.co.uk'

// Three hours, per the spec.
const REVALIDATE = 10800

// Without this a hung host holds the boundary open for as long as it likes, and the table never
// gets past its skeleton; a named failure is better than a permanent spinner.
const TIMEOUT = 15_000

export const FIXTURES_URL = `${HOST}/fixtures.csv`

export function resultsUrl(div: string, season: string): string {
  return `${HOST}/mmz4281/${season}/${div}.csv`
}

// The cache stores the upstream headers verbatim and replays them on a hit, so `date` is the moment
// the origin served this body — which for a cached entry is hours before the current request.
function fetchedAtOf(response: Response): Date | null {
  const header = response.headers.get('date')
  if (!header) return null
  const at = new Date(header)
  if (Number.isNaN(at.getTime())) return null
  return at
}

type Fetched = { text: string; fetchedAt: Date | null }

async function fetchText(url: string): Promise<Fetched> {
  // `force-cache` is what opts this into the cache at all — Next 16 caching is opt-in, and the page
  // reads searchParams, so without it every visitor would re-download all 21 CSVs. `revalidate`
  // only sets the lifetime of an already-cached entry.
  const response = await fetch(url, {
    cache: 'force-cache',
    next: { revalidate: REVALIDATE },
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return { text: await response.text(), fetchedAt: fetchedAtOf(response) }
}

type Division = { matches: Match[]; fetchedAt: Date | null }

async function loadDivision(div: string, season: string): Promise<Division> {
  const { text, fetchedAt } = await fetchText(resultsUrl(div, season))
  const matches = parseMatches(text)
  // A truncated or empty body parses as zero matches: a failure, not a league that played none.
  if (matches.length === 0) throw new Error(`${div} returned no matches`)
  return { matches, fetchedAt }
}

// The set is only as fresh as its oldest member: naming the newest would overstate the rest.
function earliest(times: Date[]): Date | null {
  if (times.length === 0) return null
  return new Date(Math.min(...times.map((at) => at.getTime())))
}

export async function loadSnapshot(divs: string[], now = new Date()): Promise<Snapshot> {
  const season = currentSeasonCode(now)
  const divisions = divs.map((div) => loadDivision(div, season))
  // Handled where it is started, so the rejection is never unhandled while the divisions settle.
  const fixtures = fetchText(FIXTURES_URL)
    .then(({ text, fetchedAt }) => ({ fixtures: parseFixtures(text), fetchedAt }))
    .catch(() => null)

  const results = await Promise.allSettled(divisions)
  const matches: Match[] = []
  const failed: string[] = []
  const times: Date[] = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failed.push(divs[index])
      return
    }
    matches.push(...result.value.matches)
    if (result.value.fetchedAt) times.push(result.value.fetchedAt)
  })

  const loaded = await fixtures
  if (!loaded) failed.push('fixtures')
  if (loaded?.fetchedAt) times.push(loaded.fetchedAt)
  return { matches, fixtures: loaded?.fixtures ?? [], fetchedAt: earliest(times), failed }
}

// UTC, which is how both sides arrive here: a fixture date is midnight UTC of its calendar day, and
// `now` reaches nextFixture as the Rome day encoded the same way.
function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
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
