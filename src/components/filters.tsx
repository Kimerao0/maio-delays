'use client'

import { cn } from 'cn'
import { useSearchParams } from 'next/navigation'
import type { FocusEvent, KeyboardEvent, ReactElement } from 'react'
import { useFilterNav } from '@/components/filter-shell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EVENTS, type EventId } from '@/lib/events'
import { LEAGUES } from '@/lib/leagues'
import { type Query, toQuery } from '@/lib/query'
import type { Venue } from '@/lib/streaks'

const ALL = 'tutti'

// The sort lives outside Query, so these are the params a filter change has to carry over by hand.
const SORT_PARAMS = ['sort', 'dir'] as const

const VENUES: readonly { value: Venue; label: string }[] = [
  { value: 'all', label: 'tutte' },
  { value: 'home', label: 'casa' },
  { value: 'away', label: 'trasferta' },
]

// Shared by the bar and its placeholder, so the controls land without moving the table.
const WIDTHS = {
  evento: 'w-[136px]',
  periodo: 'w-[104px]',
  dove: 'w-[120px]',
  leghe: 'w-[120px]',
  min: 'w-[88px]',
} as const

const BAR = 'flex flex-wrap gap-x-2 gap-y-3 pt-2'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-figure'

// The bar already dims as a whole while pending, so the shipped per-control disabled fade is
// neutralised rather than stacked on top of it.
const CONTROL = 'data-[size=default]:h-11 rounded-lg border-rule text-figure disabled:opacity-100'

const POPUP = 'w-auto min-w-48 bg-field text-figure ring-rule'

const ITEM = 'min-h-11 text-figure focus:bg-rule data-highlighted:bg-rule'

// Selected reads as figure, unselected as quiet: the state is carried by colour, never by a fill.
const TOGGLE = 'h-11 flex-1 text-[13px] text-quiet aria-pressed:text-figure disabled:opacity-100'

function eventLabel(value: string | null): string {
  if (value === ALL || value === null) return 'tutti'
  return EVENTS.find((event) => event.id === value)?.label ?? 'tutti'
}

function eventsFor(value: string | null): EventId[] {
  const event = EVENTS.find((candidate) => candidate.id === value)
  if (!event) return EVENTS.map((candidate) => candidate.id)
  return [event.id]
}

function venueLabel(value: Venue | null): string {
  return VENUES.find((venue) => venue.value === value)?.label ?? 'tutte'
}

function leaguesLabel(divs: readonly string[]): string {
  if (divs.length === LEAGUES.length) return 'tutte'
  return LEAGUES.filter((league) => divs.includes(league.div))
    .map((league) => league.tag)
    .join(' ')
}

// The label sits on the control's own frame, so the control keeps its full 44px touch target.
function Field({ label, children }: { label: string; children: ReactElement }) {
  return (
    <div className="relative">
      <span className="absolute -top-2 left-2 z-10 bg-field px-1 text-[11px] leading-4 text-quiet">
        {label}
      </span>
      {children}
    </div>
  )
}

// Stands in while the request-time query resolves: same frames, same labels, same geometry.
export function FiltersSkeleton() {
  return (
    <div aria-hidden="true" className={BAR}>
      {Object.entries(WIDTHS).map(([label, width]) => (
        <Field key={label} label={label}>
          <div className={cn('h-11 rounded-lg border border-rule', width)} />
        </Field>
      ))}
    </div>
  )
}

export function Filters({ query }: { query: Query }) {
  const searchParams = useSearchParams()
  const { pending, navigate } = useFilterNav()

  // Only what the URL actually holds: writing the defaults back would add a sort to every link.
  function withSort(params: URLSearchParams): URLSearchParams {
    for (const key of SORT_PARAMS) {
      const value = searchParams.get(key)
      if (value !== null) params.set(key, value)
    }
    return params
  }

  function apply(next: Query): void {
    navigate(`?${withSort(toQuery(next))}`)
  }

  function applyEvent(value: string | null): void {
    apply({ ...query, events: eventsFor(value) })
  }

  function applyPeriod(value: string[]): void {
    const [period] = value
    if (period !== 'ft' && period !== 'ht') return
    apply({ ...query, period })
  }

  function commitMin(value: string): void {
    const min = Number.parseInt(value, 10)
    if (!Number.isInteger(min) || min === query.min) return
    apply({ ...query, min })
  }

  function onMinBlur(blur: FocusEvent<HTMLInputElement>): void {
    commitMin(blur.currentTarget.value)
  }

  function onMinKeyDown(press: KeyboardEvent<HTMLInputElement>): void {
    if (press.key !== 'Enter') return
    commitMin(press.currentTarget.value)
  }

  const selectedEvent = query.events.length === EVENTS.length ? ALL : query.events[0]

  return (
    <div
      aria-busy={pending}
      className={cn(
        BAR,
        'transition-opacity motion-reduce:transition-none',
        pending && 'opacity-60',
      )}
    >
      <Field label="evento">
        <Select value={selectedEvent} onValueChange={applyEvent} disabled={pending}>
          <SelectTrigger aria-label="evento" className={cn(CONTROL, FOCUS, WIDTHS.evento)}>
            <SelectValue>{(value: string | null) => eventLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className={POPUP}>
            <SelectItem value={ALL} className={ITEM}>
              tutti
            </SelectItem>
            {EVENTS.map((event) => (
              <SelectItem key={event.id} value={event.id} className={ITEM}>
                {event.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="periodo">
        <ToggleGroup
          spacing={0}
          disabled={pending}
          value={[query.period]}
          onValueChange={applyPeriod}
          className={cn('h-11 rounded-lg border border-rule', WIDTHS.periodo)}
        >
          <ToggleGroupItem value="ft" aria-label="novanta minuti" className={cn(TOGGLE, FOCUS)}>
            90&apos;
          </ToggleGroupItem>
          <ToggleGroupItem
            value="ht"
            aria-label="primo tempo"
            className={cn(TOGGLE, FOCUS, 'border-l border-rule')}
          >
            1°T
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      <Field label="dove">
        <Select
          disabled={pending}
          value={query.venue}
          onValueChange={(venue) => apply({ ...query, venue: venue ?? 'all' })}
        >
          <SelectTrigger aria-label="dove" className={cn(CONTROL, FOCUS, WIDTHS.dove)}>
            <SelectValue>{(value: Venue | null) => venueLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className={POPUP}>
            {VENUES.map((venue) => (
              <SelectItem key={venue.value} value={venue.value} className={ITEM}>
                {venue.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="leghe">
        <Select
          multiple
          disabled={pending}
          value={query.divs}
          onValueChange={(divs) => apply({ ...query, divs })}
        >
          <SelectTrigger aria-label="leghe" className={cn(CONTROL, FOCUS, WIDTHS.leghe)}>
            <SelectValue>{(value: string[]) => leaguesLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className={POPUP}>
            {LEAGUES.map((league) => (
              <SelectItem key={league.div} value={league.div} className={ITEM}>
                {league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="min">
        <input
          key={query.min}
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          disabled={pending}
          defaultValue={query.min}
          aria-label="ritardo minimo"
          onBlur={onMinBlur}
          onKeyDown={onMinKeyDown}
          className={cn(
            'h-11 rounded-lg border border-rule px-3 text-[15px] text-figure tabular-nums',
            FOCUS,
            WIDTHS.min,
          )}
        />
      </Field>
    </div>
  )
}
