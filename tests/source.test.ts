import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { parseFixtures } from '@/lib/matches'
import { FIXTURES_URL, loadSnapshot, nextFixture } from '@/lib/source'

const i1 = readFileSync('tests/fixtures/I1-2627.csv', 'utf8')
const fixturesCsv = readFileSync('tests/fixtures/fixtures.csv', 'utf8')

function divOf(url: string): string {
  return (url.split('/').at(-1) ?? '').replace('.csv', '')
}

// Serves a body per division code, whatever season the URL names; an absent division answers 404.
// The fixtures file always answers: no test here exercises its failure.
function stubFetch(bodies: Record<string, string>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === FIXTURES_URL) return new Response(fixturesCsv)
      const body = bodies[divOf(url)]
      if (body === undefined) return new Response('', { status: 404 })
      return new Response(body)
    }),
  )
}

beforeEach(() => {
  stubFetch({ I1: i1 })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('one failing league does not fail the snapshot, and is named', async () => {
  const snap = await loadSnapshot(['I1', 'E0'])
  expect(snap.matches.length).toBeGreaterThan(0)
  expect(snap.failed).toEqual(['E0'])
})

test('a truncated body is reported as a failure, not parsed as zero matches', async () => {
  stubFetch({ I1: '﻿Div,Date' })
  const snap = await loadSnapshot(['I1'])
  expect(snap.failed).toEqual(['I1'])
})

test('nextFixture ignores a fixture whose date is already past', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  expect(nextFixture(fx, 'I1', 'Inter', new Date(2027, 0, 1))).toBeNull()
})

test('nextFixture returns null for a team absent from the file', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  expect(nextFixture(fx, 'I1', 'Chievo', new Date(2026, 9, 23))).toBeNull()
})

test('nextFixture includes a fixture later today', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  const f = nextFixture(fx, 'I1', fx[0].home, fx[0].date)
  expect(f?.home).toBe(fx[0].home)
})

test('a fixture kicking off later today still counts as upcoming at 21:00', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  const kickOff = fx[0].date
  const tonight = new Date(
    Date.UTC(kickOff.getUTCFullYear(), kickOff.getUTCMonth(), kickOff.getUTCDate(), 21),
  )
  expect(nextFixture(fx, 'I1', fx[0].home, tonight)).toEqual(fx[0])
})

test('requests the bare host and the derived season', async () => {
  await loadSnapshot(['I1'], new Date(2026, 9, 26))
  expect(fetch).toHaveBeenCalledWith(
    'https://football-data.co.uk/mmz4281/2627/I1.csv',
    expect.anything(),
  )
})
