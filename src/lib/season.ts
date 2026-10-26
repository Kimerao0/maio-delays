import { romeDay } from '@/lib/clock'

// Which month it is depends on where you ask, so the month comes from the Rome calendar day.
export function currentSeasonCode(now: Date): string {
  const day = romeDay(now)
  const year = day.getUTCFullYear()
  if (day.getUTCMonth() >= 6) return seasonCode(year, year + 1)
  return seasonCode(year - 1, year)
}

function seasonCode(from: number, to: number): string {
  return `${twoDigits(from)}${twoDigits(to)}`
}

function twoDigits(year: number): string {
  return String(year % 100).padStart(2, '0')
}
