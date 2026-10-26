import { parseCsv } from '@/lib/csv'

export type Match = {
  div: string
  date: Date
  home: string
  away: string
  ftHome: number
  ftAway: number
  htHome: number
  htAway: number
}

export type Fixture = { div: string; date: Date; home: string; away: string }

export function parseMatches(text: string): Match[] {
  const matches: Match[] = []
  for (const row of parseCsv(text)) {
    const match = toMatch(row)
    if (match) matches.push(match)
  }
  return matches.sort(byDate)
}

export function parseFixtures(text: string): Fixture[] {
  const fixtures: Fixture[] = []
  for (const row of parseCsv(text)) {
    const date = parseDate(row.Date)
    if (!date) continue
    fixtures.push({ div: row.Div, date, home: row.HomeTeam, away: row.AwayTeam })
  }
  return fixtures.sort(byDate)
}

function toMatch(row: Record<string, string>): Match | null {
  const ftHome = toGoals(row.FTHG)
  const ftAway = toGoals(row.FTAG)
  if (ftHome === null || ftAway === null) return null
  const date = parseDate(row.Date)
  if (!date) return null
  return {
    div: row.Div,
    date,
    home: row.HomeTeam,
    away: row.AwayTeam,
    ftHome,
    ftAway,
    htHome: toGoals(row.HTHG) ?? 0,
    htAway: toGoals(row.HTAG) ?? 0,
  }
}

function toGoals(value: string): number | null {
  if (!value || value.trim() === '') return null
  const goals = Number(value)
  if (!Number.isInteger(goals)) return null
  return goals
}

// dd/mm/yyyy: the Date constructor misreads these, so the parts are built by hand.
function parseDate(value: string): Date | null {
  if (!value) return null
  const [dayText, monthText, yearText] = value.split('/')
  if (!dayText || !monthText || !yearText) return null
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  return new Date(fullYear(year), month - 1, day)
}

function fullYear(year: number): number {
  if (year >= 100) return year
  if (year < 70) return 2000 + year
  return 1900 + year
}

function byDate(a: { date: Date }, b: { date: Date }): number {
  return a.date.getTime() - b.date.getTime()
}
