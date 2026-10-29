import { cn } from 'cn'
import { RowDetail } from '@/components/row-detail'
import { SortLink } from '@/components/sort-link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { eventLabel, eventShort, type Period } from '@/lib/events'
import { leagueByDiv } from '@/lib/leagues'
import type { Fixture, Match } from '@/lib/matches'
import { type Query, toQuery } from '@/lib/query'
import { compactOneIn, type Ranked } from '@/lib/rarity'
import { DEFAULT_DIR, type Dir, type Sort, type SortKey } from '@/lib/sort'
import { nextFixture } from '@/lib/source'
import { runKey } from '@/lib/streaks'

const ARIA_SORT: Record<Dir, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending',
}

const ARROW: Record<Dir, string> = { asc: '↑', desc: '↓' }

// UTC because a match date is a calendar date stored as midnight UTC: read in any other zone it
// prints the day before.
const DAY = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

const FRAME = 'mx-auto w-full max-w-[min(100%-2rem,84rem)]'

// The shipped Table wraps itself in an overflow container, which would trap the sticky header.
const UNTRAP = '[&>[data-slot=table-container]]:overflow-visible'

const GRID =
  'table-fixed border-separate border-spacing-0 [&_td]:border-b [&_td]:border-rule [&_th]:border-b [&_th]:border-rule'

const HEAD = 'h-10 bg-field text-[11px] font-normal text-quiet'

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

function rowLabel(row: Ranked): string {
  return eventLabel(row.event, row.direction)
}

function eventCode(row: Ranked): string {
  const short = eventShort(row.event, row.direction)
  if (row.period === 'ht') return `${short} 1T`
  return short
}

function periodLabel(period: Period): string {
  if (period === 'ht') return '1°T'
  return "90'"
}

function leagueTag(div: string): string {
  return leagueByDiv(div)?.tag ?? div
}

function opponentOf(fixture: Fixture, team: string): string {
  if (fixture.home === team) return fixture.away
  return fixture.home
}

// The design plan's shorthand for the next match: casa or trasferta in one character.
function sideMark(fixture: Fixture, team: string): string {
  if (fixture.home === team) return 'c'
  return 't'
}

function nextLabel(fixture: Fixture | null, team: string): string {
  if (!fixture) return '—'
  return `${opponentOf(fixture, team)} (${sideMark(fixture, team)}) ${DAY.format(fixture.date)}`
}

function nextDir(column: SortKey, sort: Sort): Dir {
  if (sort.key !== column) return DEFAULT_DIR[column]
  if (sort.dir === 'asc') return 'desc'
  return 'asc'
}

// The sort lives outside Query, so it is appended to the filter params rather than carried by them.
function sortHref(query: Query, column: SortKey, sort: Sort): string {
  const params = toQuery(query)
  params.set('sort', column)
  params.set('dir', nextDir(column, sort))
  return `?${params}`
}

function compare(key: SortKey, a: Ranked, b: Ranked): number {
  if (key === 'raro') return a.oneIn - b.oneIn
  if (key === 'squadra') return a.team.localeCompare(b.team)
  if (key === 'evento') return rowLabel(a).localeCompare(rowLabel(b))
  if (key === 'lega') return leagueTag(a.div).localeCompare(leagueTag(b.div))
  if (key === 'ultima') return a.lastMatch.getTime() - b.lastMatch.getTime()
  return a.streak - b.streak
}

function tieBreak(a: Ranked, b: Ranked): number {
  return a.div.localeCompare(b.div) || a.team.localeCompare(b.team)
}

function sortRows(rows: Ranked[], sort: Sort): Ranked[] {
  // rankByRarity already hands these over rarest first, which is the default order.
  if (sort.key === 'raro' && sort.dir === 'desc') return rows
  const direction = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => direction * compare(sort.key, a, b) || tieBreak(a, b))
}

function keyOf(row: Ranked): string {
  return runKey(row.div, row.team, row.event)
}

// Three rows, never a share of them: a decile of a 543-row table paints every figure on a phone
// screen gold, which is the one thing the accent cannot afford to do.
function tailKeys(rows: Ranked[]): ReadonlySet<string> {
  const rarest = [...rows].sort((a, b) => b.oneIn - a.oneIn).slice(0, 3)
  return new Set(rarest.map(keyOf))
}

type SortableHeadProps = {
  column: SortKey
  label: string
  query: Query
  sort: Sort
  className?: string
}

function SortableHead({ column, label, query, sort, className }: SortableHeadProps) {
  const active = sort.key === column
  return (
    <TableHead aria-sort={active ? ARIA_SORT[sort.dir] : 'none'} className={cn(HEAD, className)}>
      <SortLink
        href={sortHref(query, column, sort)}
        label={label}
        arrow={active ? ARROW[sort.dir] : null}
      />
    </TableHead>
  )
}

// Same frame and the same 44px rhythm as the table, so the real rows land without a shift.
export function RitardiTableSkeleton() {
  return (
    <div className={FRAME}>
      <p className="flex h-10 items-center border-b border-rule text-[11px] text-quiet">
        caricamento…
      </p>
      {SKELETON_ROWS.map((row) => (
        <div key={row} aria-hidden="true" className="flex h-11 items-center border-b border-rule">
          <span className="ml-5 h-3 w-6 rounded-xs bg-rule" />
          <span className="ml-4 h-3 w-24 rounded-xs bg-rule" />
          <span className="ml-4 h-3 w-10 rounded-xs bg-rule" />
        </div>
      ))}
    </div>
  )
}

type RowProps = {
  row: Ranked
  tail: boolean
  run: Match[]
  next: Fixture | null
}

function Row({ row, tail, run, next }: RowProps) {
  return (
    <RowDetail row={row} run={run} next={next}>
      <TableCell
        className={cn(
          'pr-3 text-right text-[15px] font-bold tabular-nums',
          tail ? 'text-tail' : 'text-figure',
        )}
      >
        {row.streak}
      </TableCell>
      <TableCell className="text-[15px] font-medium text-figure">
        <span className="block truncate">{row.team}</span>
      </TableCell>
      <TableCell className="text-[13px] text-quiet">
        <span className="md:hidden">{eventCode(row)}</span>
        <span className="hidden md:inline">{rowLabel(row)}</span>
      </TableCell>
      <TableCell className="text-[11px] text-quiet md:hidden">{leagueTag(row.div)}</TableCell>
      <TableCell className="hidden text-[13px] text-quiet md:table-cell">
        {periodLabel(row.period)}
      </TableCell>
      <TableCell className="pr-3 text-right text-[13px] text-quiet tabular-nums">
        {compactOneIn(row.oneIn)}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="outline" className="border-rule text-[11px] font-normal text-quiet">
          {leagueTag(row.div)}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-[13px] text-quiet tabular-nums md:table-cell">
        {DAY.format(row.lastMatch)}
      </TableCell>
      <TableCell className="hidden text-[13px] text-quiet md:table-cell">
        {nextLabel(next, row.team)}
      </TableCell>
    </RowDetail>
  )
}

type RitardiTableProps = {
  rows: Ranked[]
  runs: ReadonlyMap<string, Match[]>
  fixtures: Fixture[]
  now: Date
  query: Query
  sort: Sort
}

export function RitardiTable({ rows, runs, fixtures, now, query, sort }: RitardiTableProps) {
  const tail = tailKeys(rows)

  return (
    <div className={cn(FRAME, UNTRAP)}>
      <Table className={GRID}>
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            <SortableHead
              column="da"
              label="DA"
              query={query}
              sort={sort}
              className="w-12 pr-3 text-right"
            />
            <SortableHead
              column="squadra"
              label="SQUADRA"
              query={query}
              sort={sort}
              className="md:w-[160px]"
            />
            <SortableHead
              column="evento"
              label="EVENTO"
              query={query}
              sort={sort}
              className="w-[84px] md:w-[144px]"
            />
            {/* Twice over: the phone wants the tag between EVENTO and 1 SU, the desktop keeps it
                where it was. One table, one column order, so the pair is breakpoint-gated. */}
            <SortableHead
              column="lega"
              label="LEGA"
              query={query}
              sort={sort}
              className="w-14 md:hidden"
            />
            <TableHead className={cn(HEAD, 'hidden md:table-cell md:w-[72px]')}>PERIODO</TableHead>
            <SortableHead
              column="raro"
              label="1 SU"
              query={query}
              sort={sort}
              className="w-14 pr-3 text-right md:w-[72px]"
            />
            <SortableHead
              column="lega"
              label="LEGA"
              query={query}
              sort={sort}
              className="hidden md:table-cell md:w-[64px]"
            />
            <SortableHead
              column="ultima"
              label="ULTIMA"
              query={query}
              sort={sort}
              className="hidden md:table-cell md:w-[88px]"
            />
            <TableHead className={cn(HEAD, 'hidden md:table-cell')}>PROSSIMA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortRows(rows, sort).map((row) => (
            <Row
              key={keyOf(row)}
              row={row}
              tail={tail.has(keyOf(row))}
              run={runs.get(keyOf(row)) ?? []}
              next={nextFixture(fixtures, row.div, row.team, now)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
