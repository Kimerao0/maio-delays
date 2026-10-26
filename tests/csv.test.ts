import { expect, test } from 'vitest'
import { parseCsv } from '@/lib/csv'

test('strips the UTF-8 BOM from the first column name', () => {
  const rows = parseCsv('﻿Div,Date\nI1,22/08/2026\n')
  expect(rows[0].Div).toBe('I1')
})

test('ignores blank and whitespace-only lines', () => {
  expect(parseCsv('A,B\n1,2\n\n   \n')).toHaveLength(1)
})

test('keeps a field containing a quoted comma intact', () => {
  expect(parseCsv('A,B\n"x,y",2\n')[0].A).toBe('x,y')
})
