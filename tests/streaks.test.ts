import { expect, test } from 'vitest'
import type { Match } from '@/lib/matches'
import { computeRitardi, streakMatches } from '@/lib/streaks'

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
    venue: 'all',
    min: 1,
  })
  expect(out.find((r) => r.team === 'C')?.streak).toBe(3)
})

test('a team whose newest match had the event has a streak of 0 and is filtered out by min 1', () => {
  const out = computeRitardi(fixtureMatches, {
    events: ['win'],
    period: 'ft',
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
    venue: 'all',
    min: 1,
  })
  const home = computeRitardi(fixtureMatches, {
    events: ['win'],
    period: 'ft',
    venue: 'home',
    min: 1,
  })
  expect(all.find((r) => r.team === 'A')?.streak).toBe(1)
  expect(home.find((r) => r.team === 'A')?.streak).toBe(2)
})

test('min filters out shorter runs', () => {
  expect(
    computeRitardi(fixtureMatches, { events: ['win'], period: 'ft', venue: 'all', min: 99 }),
  ).toEqual([])
})

test('sorts by streak descending, then division, then team', () => {
  const out = computeRitardi(fixtureMatches, {
    events: ['win', 'draw'],
    period: 'ft',
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
  expect(computeRitardi([], { events: ['win'], period: 'ft', venue: 'all', min: 1 })).toEqual([])
})

test('streakMatches returns the run newest first', () => {
  const run = streakMatches(fixtureMatches, 'C', 'win', 'ft', 'all')
  expect(run).toHaveLength(3)
  expect(run[0].date.getTime()).toBeGreaterThan(run[1].date.getTime())
})
