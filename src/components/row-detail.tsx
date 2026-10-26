'use client'

import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { eventLabel, type Period } from '@/lib/events'
import type { Fixture, Match } from '@/lib/matches'
import type { Ranked } from '@/lib/rarity'

const DAY = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' })

const TRIGGER =
  'h-11 cursor-pointer outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-figure'

const ENTRY = 'flex h-11 items-center gap-3 border-b border-rule text-[13px]'

function periodLabel(period: Period): string {
  if (period === 'ht') return '1°T'
  return "90'"
}

function playedHome(game: Fixture | Match, team: string): boolean {
  return game.home === team
}

function opponentOf(game: Fixture | Match, team: string): string {
  if (playedHome(game, team)) return game.away
  return game.home
}

function venueLabel(game: Fixture | Match, team: string): string {
  if (playedHome(game, team)) return 'casa'
  return 'trasferta'
}

// The row's own period: a first-half ritardo is unreadable against the final score.
function scoreOf(match: Match, team: string, period: Period): string {
  const home = period === 'ft' ? match.ftHome : match.htHome
  const away = period === 'ft' ? match.ftAway : match.htAway
  if (playedHome(match, team)) return `${home}-${away}`
  return `${away}-${home}`
}

function entryKey(match: Match): string {
  return `${match.date.getTime()}-${match.home}-${match.away}`
}

type RowDetailProps = {
  row: Ranked
  run: Match[]
  next: Fixture | null
  children: ReactNode
}

// The table row is the trigger, so the whole 44px band opens the sheet; `nativeButton` false is
// what makes a <tr> keyboard-operable here.
export function RowDetail({ row, run, next, children }: RowDetailProps) {
  return (
    <Sheet>
      <SheetTrigger nativeButton={false} render={<tr className={TRIGGER} />}>
        {children}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto border-rule bg-field motion-reduce:transition-none"
      >
        <SheetHeader className="gap-1">
          <SheetTitle className="text-[15px] font-medium text-figure">{row.team}</SheetTitle>
          <SheetDescription className="text-[13px] text-quiet">
            {eventLabel(row.event, row.direction)} · {periodLabel(row.period)} · da {row.streak}{' '}
            turni
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <section className="flex flex-col gap-1">
            <h3 className="text-[11px] text-quiet">prossima</h3>
            {!next && <p className="text-[13px] text-quiet">—</p>}
            {next && (
              <p className="text-[13px] text-figure">
                {opponentOf(next, row.team)}{' '}
                <span className="text-quiet">{venueLabel(next, row.team)}</span>{' '}
                <span className="text-quiet tabular-nums">{DAY.format(next.date)}</span>
              </p>
            )}
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="text-[11px] text-quiet">partite</h3>
            {/* streakRuns hands the run over newest first. */}
            <ul>
              {run.map((match) => (
                <li key={entryKey(match)} className={ENTRY}>
                  <span className="w-12 shrink-0 text-quiet tabular-nums">
                    {DAY.format(match.date)}
                  </span>
                  <span className="flex-1 truncate font-medium text-figure">
                    {opponentOf(match, row.team)}
                  </span>
                  <span className="w-20 shrink-0 text-quiet">{venueLabel(match, row.team)}</span>
                  <span className="w-10 shrink-0 text-right text-figure tabular-nums">
                    {scoreOf(match, row.team, row.period)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
