import { expect, test } from 'vitest'
import { LEAGUES, leagueByDiv } from '@/lib/leagues'

test('LEAGUES covers the 21 divisions in fixtures.csv', () => {
  expect(LEAGUES.map((l) => l.div)).toEqual([
    'I1',
    'I2',
    'E0',
    'E1',
    'E2',
    'E3',
    'EC',
    'SP1',
    'SP2',
    'D1',
    'D2',
    'F1',
    'F2',
    'N1',
    'B1',
    'P1',
    'T1',
    'G1',
    'SC0',
    'SC1',
    'SC2',
  ])
})

test('tags are unique', () => {
  expect(new Set(LEAGUES.map((l) => l.tag)).size).toBe(LEAGUES.length)
})

test('leagueByDiv resolves a known division', () => {
  expect(leagueByDiv('I1')).toEqual({ div: 'I1', name: 'Serie A', tag: 'ITA' })
})
