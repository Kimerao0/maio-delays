import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { type Match, parseMatches } from '@/lib/matches'
import { computeRitardi, type RitardoOpts, runKey, streakMatches, streakRuns } from '@/lib/streaks'

const m = (
  date: Date,
  home: string,
  away: string,
  ft: [number, number],
  ht: [number, number],
): Match => ({
  div: 'I1',
  date,
  home,
  away,
  ftHome: ft[0],
  ftAway: ft[1],
  htHome: ht[0],
  htAway: ht[1],
})

// A, B and C carry the assertions; D, E and F are opponents only.
const fixtureMatches: Match[] = [
  m(new Date(2026, 7, 22), 'A', 'D', [1, 1], [0, 1]), // A home draw
  m(new Date(2026, 7, 29), 'E', 'A', [0, 2], [0, 1]), // A away win
  m(new Date(2026, 8, 5), 'A', 'F', [0, 0], [0, 0]), // A home draw
  m(new Date(2026, 7, 23), 'D', 'B', [2, 0], [1, 0]), // B away loss
  m(new Date(2026, 7, 30), 'B', 'E', [3, 1], [2, 0]), // B home win
  m(new Date(2026, 8, 6), 'F', 'B', [0, 1], [0, 0]), // B away win
  m(new Date(2026, 7, 24), 'C', 'D', [1, 1], [1, 0]), // C home draw
  m(new Date(2026, 7, 31), 'E', 'C', [2, 2], [1, 1]), // C away draw
  m(new Date(2026, 8, 7), 'C', 'F', [0, 0], [0, 0]), // C home draw
]

test('counts consecutive non-occurrences back from the newest match', () => {
  const out = computeRitardi(fixtureMatches, {
    events: ['win'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  expect(out.find((r) => r.team === 'C')?.streak).toBe(3)
})

test('a team whose newest match had the event has a streak of 0 and is filtered out by min 1', () => {
  const out = computeRitardi(fixtureMatches, {
    events: ['win'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  expect(out.find((r) => r.team === 'B')).toBeUndefined()
})

test('venue home counts only home matches, consecutively among themselves', () => {
  // A's away win sits between its two home draws: it breaks the all-venue run but not the home one.
  const all = computeRitardi(fixtureMatches, {
    events: ['win'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  const home = computeRitardi(fixtureMatches, {
    events: ['win'],
    period: 'ft',
    direction: 'not',
    venue: 'home',
    min: 1,
  })
  expect(all.find((r) => r.team === 'A')?.streak).toBe(1)
  expect(home.find((r) => r.team === 'A')?.streak).toBe(2)
})

test('min filters out shorter runs', () => {
  expect(
    computeRitardi(fixtureMatches, {
      events: ['win'],
      period: 'ft',
      direction: 'not',
      venue: 'all',
      min: 99,
    }),
  ).toEqual([])
})

test('sorts by streak descending, then division, then team', () => {
  const out = computeRitardi(fixtureMatches, {
    events: ['win', 'draw'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  expect(out).toEqual(
    [...out].sort(
      (a, b) => b.streak - a.streak || a.div.localeCompare(b.div) || a.team.localeCompare(b.team),
    ),
  )
})

test('a team with no matches produces no row', () => {
  expect(
    computeRitardi([], { events: ['win'], period: 'ft', direction: 'not', venue: 'all', min: 1 }),
  ).toEqual([])
})

test('streakMatches returns the run newest first', () => {
  const run = streakMatches(fixtureMatches, 'C', 'win', 'ft', 'not', 'all')
  expect(run).toHaveLength(3)
  expect(run[0].date.getTime()).toBeGreaterThan(run[1].date.getTime())
})

test('real Serie A data produces a ritardo no longer than the matches played', () => {
  const i1 = parseMatches(readFileSync('tests/fixtures/I1-2627.csv', 'utf8'))
  const out = computeRitardi(i1, {
    events: ['draw'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  expect(out.length).toBeGreaterThan(0)
  expect(Math.max(...out.map((r) => r.streak))).toBeLessThanOrEqual(7) // 7 rounds in the fixture
})

test('period ht is carried into the row and changes the result', () => {
  const ft = computeRitardi(fixtureMatches, {
    events: ['scores'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  const ht = computeRitardi(fixtureMatches, {
    events: ['scores'],
    period: 'ht',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  expect(ht.every((r) => r.period === 'ht')).toBe(true)
  expect(ht).not.toEqual(ft)
})

test('streakRuns agrees with streakMatches for every row', () => {
  const i1 = parseMatches(readFileSync('tests/fixtures/I1-2627.csv', 'utf8'))
  const rows = computeRitardi(i1, {
    events: ['draw', 'over25'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  const runs = streakRuns(i1, rows, 'ft', 'not', 'all')
  expect(rows.length).toBeGreaterThan(0)
  expect(runs.size).toBe(rows.length)
  for (const row of rows) {
    expect(runs.get(runKey(row.div, row.team, row.event))).toEqual(
      streakMatches(i1, row.team, row.event, 'ft', 'not', 'all'),
    )
  }
})

// Direction 'yes': a run of matches where the event DID happen.
// Newest first, per team (ft score from the team's side; ht in brackets when it matters):
//   A: Sep 5 home 0-0 draw, Aug 29 away 2-0 win, Aug 22 home 1-1 draw (ht 0-1 loss)
//   B: Sep 6 away 1-0 win (ht draw), Aug 30 home 3-1 win, Aug 23 away 0-2 loss
//   C: Sep 7 home 0-0 draw, Aug 31 away 2-2 draw, Aug 24 home 1-1 draw (ht 1-0 win)
const yesOpts = (over: Partial<RitardoOpts> = {}): RitardoOpts => ({
  events: ['win'],
  period: 'ft',
  direction: 'yes',
  venue: 'all',
  min: 1,
  ...over,
})

test("direction 'yes' counts the run of the event happening back from the newest match", () => {
  // B won on Sep 6 and Aug 30, then lost on Aug 23: the run is 2.
  const out = computeRitardi(fixtureMatches, yesOpts())
  expect(out.find((r) => r.team === 'B')?.streak).toBe(2)
})

test("direction 'yes' gives a streak of 0 to a team whose newest match lacked the event", () => {
  // A and C drew on their newest match, so neither has a win streak: min 1 drops them.
  const out = computeRitardi(fixtureMatches, yesOpts())
  expect(out.find((r) => r.team === 'A')).toBeUndefined()
  expect(out.find((r) => r.team === 'C')).toBeUndefined()
})

test("'not' and 'yes' are complementary at the newest match for every team", () => {
  const not = computeRitardi(fixtureMatches, yesOpts({ direction: 'not', min: 0 }))
  const yes = computeRitardi(fixtureMatches, yesOpts({ direction: 'yes', min: 0 }))
  const teams = ['A', 'B', 'C', 'D', 'E', 'F']
  expect(not.map((r) => r.team).sort()).toEqual(teams)
  expect(yes.map((r) => r.team).sort()).toEqual(teams)
  for (const team of teams) {
    const n = not.find((r) => r.team === team)?.streak ?? -1
    const y = yes.find((r) => r.team === team)?.streak ?? -1
    expect(n).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(n > 0 !== y > 0).toBe(true)
  }
  // Pinned literals so the invariant cannot hold by both sides being wrong in the same way.
  expect(not.find((r) => r.team === 'A')?.streak).toBe(1)
  expect(yes.find((r) => r.team === 'A')?.streak).toBe(0)
  expect(not.find((r) => r.team === 'B')?.streak).toBe(0)
  expect(yes.find((r) => r.team === 'B')?.streak).toBe(2)
  expect(not.find((r) => r.team === 'C')?.streak).toBe(3)
  expect(yes.find((r) => r.team === 'C')?.streak).toBe(0)
})

test("direction 'yes' with venue home counts only home matches", () => {
  // B's only home match is the Aug 30 win; the two away matches are absent, not breaks.
  const home = computeRitardi(fixtureMatches, yesOpts({ venue: 'home' }))
  expect(home.find((r) => r.team === 'B')?.streak).toBe(1)
  // Away: Sep 6 win, then the Aug 23 loss breaks the run.
  const away = computeRitardi(fixtureMatches, yesOpts({ venue: 'away' }))
  expect(away.find((r) => r.team === 'B')?.streak).toBe(1)
})

test("direction 'yes' treats filtered-out venue matches as absent, not as breaks", () => {
  // A's away win sits between two home draws: it breaks the all-venue run, not the home one.
  const all = computeRitardi(fixtureMatches, yesOpts({ events: ['draw'] }))
  const home = computeRitardi(fixtureMatches, yesOpts({ events: ['draw'], venue: 'home' }))
  expect(all.find((r) => r.team === 'A')?.streak).toBe(1)
  expect(home.find((r) => r.team === 'A')?.streak).toBe(2)
})

test("direction 'yes' reads half-time goals when the period is ht", () => {
  // C drew 0-0, 2-2, 1-1 at full time (run of 3), but at half time Aug 24 was 1-0: run of 2.
  const ft = computeRitardi(fixtureMatches, yesOpts({ events: ['draw'], period: 'ft' }))
  const ht = computeRitardi(fixtureMatches, yesOpts({ events: ['draw'], period: 'ht' }))
  expect(ft.find((r) => r.team === 'C')?.streak).toBe(3)
  expect(ht.find((r) => r.team === 'C')?.streak).toBe(2)
  // B won on Sep 6 at full time but was level at half time (0-0), then 2-0 up on Aug 30.
  expect(ft.find((r) => r.team === 'B')).toBeUndefined()
  expect(ht.find((r) => r.team === 'B')?.streak).toBe(1)
  expect(ht.every((r) => r.period === 'ht')).toBe(true)
})

test("min filters a 'yes' run exactly as it filters a 'not' one", () => {
  // Only B has a win streak at all (2); every other team's newest match is not a win.
  const atTwo = computeRitardi(fixtureMatches, yesOpts({ min: 2 }))
  expect(atTwo.map((r) => [r.team, r.streak])).toEqual([['B', 2]])
  expect(computeRitardi(fixtureMatches, yesOpts({ min: 3 }))).toEqual([])
})

test("streakMatches at 'yes' returns the run newest first", () => {
  const run = streakMatches(fixtureMatches, 'B', 'win', 'ft', 'yes', 'all')
  expect(run.map((x) => x.date)).toEqual([new Date(2026, 8, 6), new Date(2026, 7, 30)])
})

test("streakRuns agrees with streakMatches for every 'yes' row, newest first", () => {
  const rows = computeRitardi(fixtureMatches, yesOpts({ events: ['win', 'draw'] }))
  const runs = streakRuns(fixtureMatches, rows, 'ft', 'yes', 'all')
  expect(rows.length).toBeGreaterThan(0)
  expect(runs.size).toBe(rows.length)
  for (const row of rows) {
    const run = runs.get(runKey(row.div, row.team, row.event)) ?? []
    expect(run).toHaveLength(row.streak)
    expect(run).toEqual(streakMatches(fixtureMatches, row.team, row.event, 'ft', 'yes', 'all'))
    for (let i = 1; i < run.length; i++) {
      expect(run[i - 1].date.getTime()).toBeGreaterThan(run[i].date.getTime())
    }
  }
})

test("streakRuns and streakMatches agree at 'yes' under a venue filter", () => {
  const rows = computeRitardi(fixtureMatches, yesOpts({ events: ['draw'], venue: 'home' }))
  const runs = streakRuns(fixtureMatches, rows, 'ft', 'yes', 'home')
  const a = rows.find((r) => r.team === 'A')
  expect(a?.streak).toBe(2)
  expect(runs.get(runKey('I1', 'A', 'draw'))?.map((x) => x.date)).toEqual([
    new Date(2026, 8, 5),
    new Date(2026, 7, 22),
  ])
  expect(
    streakMatches(fixtureMatches, 'A', 'draw', 'ft', 'yes', 'home').map((x) => x.date),
  ).toEqual([new Date(2026, 8, 5), new Date(2026, 7, 22)])
})

test('each row carries the direction it was computed with', () => {
  const yes = computeRitardi(fixtureMatches, yesOpts({ events: ['win', 'draw'], min: 0 }))
  const not = computeRitardi(
    fixtureMatches,
    yesOpts({ events: ['win', 'draw'], direction: 'not', min: 0 }),
  )
  expect(yes.length).toBeGreaterThan(0)
  expect(not.length).toBeGreaterThan(0)
  expect(yes.every((r) => r.direction === 'yes')).toBe(true)
  expect(not.every((r) => r.direction === 'not')).toBe(true)
})
