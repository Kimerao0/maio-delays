const BOM = '﻿'

export function parseCsv(text: string): Record<string, string>[] {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
  if (lines.length === 0) return []
  const headers = splitRow(lines[0])
  return lines.slice(1).map((line) => toRow(headers, splitRow(line)))
}

function stripBom(text: string): string {
  if (text.startsWith(BOM)) return text.slice(BOM.length)
  return text
}

function splitRow(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(cell)
      cell = ''
      continue
    }
    cell += char
  }
  cells.push(cell)
  return cells
}

function toRow(headers: string[], cells: string[]): Record<string, string> {
  const row: Record<string, string> = {}
  headers.forEach((header, index) => {
    row[header] = cells[index] ?? ''
  })
  return row
}
