// The one zone the app reads a clock in: a CSV date is a calendar date and is read in UTC, so this
// is only for the questions about *now* — which day it is, and at what hour the bodies arrived.
export const ZONE = 'Europe/Rome'

const DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Today in Rome, encoded the way a CSV date is: midnight UTC of that calendar day, so the two
// compare directly. Derived from the parts rather than from the host clock, which is what made a
// season boundary land in the wrong month west of UTC.
export function romeDay(now = new Date()): Date {
  const [year, month, day] = DAY.format(now).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
