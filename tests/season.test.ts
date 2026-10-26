import { expect, test } from 'vitest'
import { currentSeasonCode } from '@/lib/season'

test.each([
  ['2026-10-26', '2627'],
  ['2026-07-01', '2627'],
  ['2026-06-30', '2526'],
  ['2027-01-15', '2627'],
])('%s is season %s', (iso, code) => {
  expect(currentSeasonCode(new Date(iso))).toBe(code)
})
