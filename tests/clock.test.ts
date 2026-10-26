import { expect, test } from 'vitest'
import { romeDay } from '@/lib/clock'

// 23:30 UTC on 21 August is already 22 August in Rome, so neither UTC nor the host clock answers
// "what day is it" for an Italian reader.
test('reads the calendar day in Rome, not in UTC', () => {
  const day = romeDay(new Date('2026-08-21T23:30:00Z'))
  expect(day.getUTCFullYear()).toBe(2026)
  expect(day.getUTCMonth()).toBe(7)
  expect(day.getUTCDate()).toBe(22)
  expect(day.getUTCHours()).toBe(0)
})
