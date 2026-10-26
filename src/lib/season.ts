export function currentSeasonCode(now: Date): string {
  const year = now.getFullYear()
  if (now.getMonth() >= 6) return seasonCode(year, year + 1)
  return seasonCode(year - 1, year)
}

function seasonCode(from: number, to: number): string {
  return `${twoDigits(from)}${twoDigits(to)}`
}

function twoDigits(year: number): string {
  return String(year % 100).padStart(2, '0')
}
