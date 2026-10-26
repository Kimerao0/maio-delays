import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { type Direction, EVENTS, type EventId } from '@/lib/events'
import { parseMatches } from '@/lib/matches'
import { atLeastAsRareAs, baseRates, rankByRarity } from '@/lib/rarity'
import { computeRitardi, type Ritardo } from '@/lib/streaks'

const i1 = parseMatches(readFileSync('tests/fixtures/I1-2627.csv', 'utf8'))

test('base rates land strictly between 0 and 1 for every event', () => {
  const rates = baseRates(i1, 'ft', 'all')
  expect(rates.size).toBe(12)
  for (const [, p] of rates) {
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  }
})

test('an empty season still yields a rate for every event', () => {
  expect(baseRates([], 'ft', 'all').size).toBe(12)
})

test('conceding is far more common than a goalless match', () => {
  const rates = baseRates(i1, 'ft', 'all')
  expect(rates.get('concedes')).toBeGreaterThan(rates.get('under05') as number)
})

test('the venue filter changes the rate', () => {
  const home = baseRates(i1, 'ft', 'home')
  const away = baseRates(i1, 'ft', 'away')
  expect(home.get('win')).not.toBe(away.get('win'))
})

test('a short run of a rare-to-avoid event outranks a long run of a common one', () => {
  // The whole point: 4 without conceding (concedes is frequent) beats 9 without a 0-0.
  const rates = baseRates(i1, 'ft', 'all')
  const rows: Ritardo[] = [
    {
      div: 'I1',
      team: 'Ajax',
      event: 'under05',
      period: 'ft',
      direction: 'not',
      streak: 9,
      lastMatch: new Date(2026, 9, 18),
    },
    {
      div: 'I1',
      team: 'Brighton',
      event: 'concedes',
      period: 'ft',
      direction: 'not',
      streak: 4,
      lastMatch: new Date(2026, 9, 18),
    },
  ]
  expect(rankByRarity(rows, rates).map((r) => r.team)).toEqual(['Brighton', 'Ajax'])
})

test('a run of a rare event is rarer than a run of a common one', () => {
  // At direction yes the run is of the event itself: five 0-0s beat five matches with a goal.
  const rates = baseRates(i1, 'ft', 'all')
  const row = (event: EventId): Ritardo => ({
    div: 'I1',
    team: 'Lecce',
    event,
    period: 'ft',
    direction: 'yes',
    streak: 5,
    lastMatch: new Date(2026, 9, 18),
  })
  expect(rankByRarity([row('over05'), row('under05')], rates).map((r) => r.event)).toEqual([
    'under05',
    'over05',
  ])
})

test('the same streak flips rank when the direction flips', () => {
  // Conceding is frequent, so five clean sheets are exceptional and five concessions are not.
  const rates = baseRates(i1, 'ft', 'all')
  const row = (direction: Direction): Ritardo => ({
    div: 'I1',
    team: 'Como',
    event: 'concedes',
    period: 'ft',
    direction,
    streak: 5,
    lastMatch: new Date(2026, 9, 18),
  })
  expect(rankByRarity([row('yes'), row('not')], rates).map((r) => r.direction)).toEqual([
    'not',
    'yes',
  ])
})

test('oneIn is finite for every row even on a one-match season', () => {
  const one = i1.slice(0, 1)
  const rates = baseRates(one, 'ft', 'all')
  const rows = computeRitardi(one, {
    events: EVENTS.map((e) => e.id),
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  for (const r of rankByRarity(rows, rates)) expect(Number.isFinite(r.oneIn)).toBe(true)
})

test('does not mutate the rows it is given', () => {
  const rates = baseRates(i1, 'ft', 'all')
  const rows = computeRitardi(i1, {
    events: ['draw'],
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 1,
  })
  const before = [...rows]
  rankByRarity(rows, rates)
  expect(rows).toEqual(before)
})

test('real Serie A data: no U0.5 does not dominate the top of the ranking', () => {
  const rates = baseRates(i1, 'ft', 'all')
  const rows = computeRitardi(i1, {
    events: EVENTS.map((e) => e.id),
    period: 'ft',
    direction: 'not',
    venue: 'all',
    min: 4,
  })
  expect(rankByRarity(rows, rates)[0].event).not.toBe('under05')
})

test('the rarity floor keeps the row sitting on it and drops the ones below', () => {
  // At least as rare as, so the floor itself is kept, and the default floor of 1 keeps everything.
  const rates = baseRates(i1, 'ft', 'all')
  const row = (team: string, streak: number): Ritardo => ({
    div: 'I1',
    team,
    event: 'draw',
    period: 'ft',
    direction: 'not',
    streak,
    lastMatch: new Date(2026, 9, 18),
  })
  const [rarest, common] = rankByRarity([row('Lecce', 9), row('Como', 2)], rates)
  expect(atLeastAsRareAs([rarest, common], rarest.oneIn)).toEqual([rarest])
  expect(atLeastAsRareAs([rarest, common], rarest.oneIn + 1)).toEqual([])
  expect(atLeastAsRareAs([rarest, common], 1)).toEqual([rarest, common])
})
