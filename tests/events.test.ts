import { expect, test } from 'vitest'
import { EVENTS, type EventId, occurred, type Side } from '@/lib/events'
import type { Match } from '@/lib/matches'

const m = (ftHome: number, ftAway: number, htHome = 0, htAway = 0): Match => ({
  div: 'I1',
  date: new Date(2026, 7, 22),
  home: 'A',
  away: 'B',
  ftHome,
  ftAway,
  htHome,
  htAway,
})

test.each<[EventId, Side, boolean]>([
  ['win', 'home', true],
  ['win', 'away', false],
  ['loss', 'home', false],
  ['loss', 'away', true],
  ['draw', 'home', false],
  ['scores', 'home', true],
  ['concedes', 'home', true],
  ['btts', 'home', true],
  ['over25', 'home', true],
  ['under25', 'home', false],
  ['over05', 'home', true],
  ['under05', 'home', false],
])('2-1 full time: %s for %s is %s', (id, side, expected) => {
  expect(occurred(id, m(2, 1), side, 'ft')).toBe(expected)
})

test('a 0-0 draw occurs as draw, under and not btts', () => {
  expect(occurred('draw', m(0, 0), 'home', 'ft')).toBe(true)
  expect(occurred('under05', m(0, 0), 'home', 'ft')).toBe(true)
  expect(occurred('btts', m(0, 0), 'home', 'ft')).toBe(false)
})

test('half time reads the half-time goals, not the full-time ones', () => {
  const match = m(3, 0, 0, 1) // 0-1 at the break, 3-0 at the end
  expect(occurred('win', match, 'home', 'ht')).toBe(false)
  expect(occurred('loss', match, 'home', 'ht')).toBe(true)
  expect(occurred('scores', match, 'home', 'ht')).toBe(false)
  expect(occurred('over15', match, 'home', 'ht')).toBe(false)
})

test('the catalog holds all 12 events with unique ids and labels', () => {
  expect(EVENTS).toHaveLength(12)
  expect(new Set(EVENTS.map((e) => e.short)).size).toBe(12)
})
