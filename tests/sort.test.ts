import { expect, test } from 'vitest'
import { DEFAULT_SORT, parseSort, toSort } from '@/lib/sort'

test('sorts by rarity when the url says nothing', () => {
  expect(parseSort({})).toEqual(DEFAULT_SORT)
})

test('falls back to raro on an unknown key', () => {
  expect(parseSort({ sort: 'nonsense' }).key).toBe('raro')
})

test("takes the column's own default direction when the url has none", () => {
  expect(parseSort({ sort: 'squadra' })).toEqual({ key: 'squadra', dir: 'asc' })
})

test('omits the default sort and writes any other one', () => {
  expect(toSort(DEFAULT_SORT).toString()).toBe('')
  expect(toSort({ key: 'lega', dir: 'asc' }).toString()).toBe('sort=lega&dir=asc')
})
