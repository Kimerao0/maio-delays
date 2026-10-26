import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseFixtures, parseMatches } from '@/lib/matches'

const i1 = readFileSync('tests/fixtures/I1-2627.csv', 'utf8')

test('parses every played match in the real Serie A file', () => {
  expect(parseMatches(i1)).toHaveLength(70)
})

test('reads dd/mm/yyyy as a day, not a month', () => {
  const first = parseMatches(i1)[0]
  expect(first.date.getUTCMonth()).toBe(7) // August
  expect(first.date.getUTCDate()).toBe(22)
})

test('a CSV date keeps its calendar day whatever the host timezone is', () => {
  const first = parseMatches(i1)[0]
  expect(first.date.getUTCFullYear()).toBe(2026)
  expect(first.date.getUTCMonth()).toBe(7)
  expect(first.date.getUTCDate()).toBe(22)
  expect(first.date.getUTCHours()).toBe(0)
})

test('returns matches oldest first', () => {
  const dates = parseMatches(i1).map((m) => m.date.getTime())
  expect(dates).toEqual([...dates].sort((a, b) => a - b))
})

test('reads full-time and half-time goals', () => {
  const inter = parseMatches(i1).find((m) => m.home === 'Inter' && m.away === 'Monza')
  expect(inter).toMatchObject({ ftHome: 4, ftAway: 1, htHome: 1, htAway: 1 })
})

test('drops a row whose full-time goals are empty', () => {
  const text =
    '﻿Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG\n' +
    'I1,22/08/2026,Inter,Monza,,,,\n' +
    'I1,23/08/2026,Roma,Lazio,1,0,0,0\n'
  expect(parseMatches(text).map((m) => m.home)).toEqual(['Roma'])
})

test('parses the real fixtures file', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  expect(fx).toHaveLength(10)
  expect(fx.every((f) => f.div === 'I1')).toBe(true)
})
