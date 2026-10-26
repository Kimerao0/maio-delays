'use client'

import { cn } from 'cn'
import { useSearchParams } from 'next/navigation'
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useFilterNav } from '@/components/filter-shell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EVENTS, type EventId, eventLabel } from '@/lib/events'
import { LEAGUES } from '@/lib/leagues'
import { MAX_RARITY, MAX_STREAK, MIN_RARITY, MIN_STREAK, type Query, toQuery } from '@/lib/query'
import { compactOneIn, parseOneIn } from '@/lib/rarity'
import { unitFor, type Venue } from '@/lib/streaks'

const ALL = 'tutti'

// A burst of taps on the stepper has to settle into one navigation, not one per tap.
const IDLE_MS = 400

// A ±1 step is useless across 1..1_000_000: reaching 100 would take 99 taps. The rungs are the
// round numbers the `1 SU` column already reads in, and `+` / `−` jump between adjacent ones.
const RUNGS: readonly number[] = [
  1, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
  500_000, 1_000_000,
]

// The sort lives outside Query, so these are the params a filter change has to carry over by hand.
const SORT_PARAMS = ['sort', 'dir'] as const

const VENUES: readonly { value: Venue; label: string }[] = [
  { value: 'all', label: 'tutte' },
  { value: 'home', label: 'casa' },
  { value: 'away', label: 'trasferta' },
]

// `ritardi` / `serie` say what they are, so that control carries no legend — neither in the bar nor
// in the placeholder, whose legends are the keys below.
const UNLABELLED = 'direzione'

// Shared by the bar and its placeholder, so the controls land without moving the table.
// The sum per line is what decides where the bar wraps inside the 358px phone frame: 132+104+104
// wraps after the direction toggle, 120+120+100 after the minimum, and the rarity stepper takes a
// third row on its own.
const WIDTHS = {
  evento: 'w-[132px]',
  periodo: 'w-[104px]',
  direzione: 'w-[104px]',
  dove: 'w-[120px]',
  leghe: 'w-[120px]',
  'turni minimo': 'w-[100px]',
  'raro almeno': 'w-[148px]',
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

// Same rule for the bound: a stepper that cannot go further reads quiet, and never fills.
const STEP = 'h-11 w-[30px] shrink-0 text-[15px] text-figure disabled:text-quiet'

const VALUE = 'h-11 min-w-0 flex-1 text-center text-[15px] text-figure tabular-nums'

// The native spinners both duplicate the buttons and eat the width the value needs.
const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

// The event reads bare here: whether the run is of it happening or not is the direction toggle's.
function selectedEventLabel(value: string | null): string {
  const event = EVENTS.find((candidate) => candidate.id === value)
  if (!event) return 'tutti'
  return eventLabel(event.id, 'yes')
}

function eventsFor(value: string | null): EventId[] {
  const event = EVENTS.find((candidate) => candidate.id === value)
  if (!event) return EVENTS.map((candidate) => candidate.id)
  return [event.id]
}

function venueLabel(value: Venue | null): string {
  return VENUES.find((venue) => venue.value === value)?.label ?? 'tutte'
}

// A typed value off the ladder keeps its place: the next rung above it is where `+` goes.
function rungAbove(value: number): number {
  return RUNGS.find((rung) => rung > value) ?? MAX_RARITY
}

function rungBelow(value: number): number {
  return RUNGS.findLast((rung) => rung < value) ?? MIN_RARITY
}

function leaguesLabel(divs: readonly string[]): string {
  if (divs.length === LEAGUES.length) return 'tutte'
  return LEAGUES.filter((league) => divs.includes(league.div))
    .map((league) => league.tag)
    .join(' ')
}

// The label sits on the control's own frame, so the control keeps its full 44px touch target.
function Field({ label, children }: { label?: string; children: ReactElement }) {
  return (
    <div className="relative">
      {label && (
        <span className="absolute -top-2 left-2 z-10 bg-field px-1 text-[11px] leading-4 text-quiet">
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

function legendOf(name: string): string | undefined {
  if (name === UNLABELLED) return undefined
  return name
}

// Stands in while the request-time query resolves: same frames, same labels, same geometry.
export function FiltersSkeleton() {
  return (
    <div aria-hidden="true" className={BAR}>
      {Object.entries(WIDTHS).map(([name, width]) => (
        <Field key={name} label={legendOf(name)}>
          <div className={cn('h-11 rounded-lg border border-rule', width)} />
        </Field>
      ))}
    </div>
  )
}

type StepperProps = {
  value: number
  label: string
  pending: boolean
  onCommit: (value: number) => void
}

type Burst = {
  value: number
  nudge: (to: (current: number) => number) => void
  commit: (next: number) => void
}

// The value is local so a tap acknowledges in the same frame, and the push waits for the burst to
// end: five taps are one navigation and one history entry. Re-arming on every render keeps the
// pushed query current if another filter moves meanwhile, and `committed` is what stops a
// re-render from pushing the same value twice. Keyed on the query's own value by the caller, so
// Back and a server answer both reset it.
function useBurst(initial: number, onCommit: (value: number) => void): Burst {
  const [value, setValue] = useState(initial)
  const committed = useRef(initial)

  useEffect(() => {
    if (value === committed.current) return
    const timer = setTimeout(() => {
      committed.current = value
      onCommit(value)
    }, IDLE_MS)
    return () => clearTimeout(timer)
  }, [value, onCommit])

  // Off the value the last tap left, not off the rendered one: a burst faster than a render still
  // counts every tap.
  function nudge(to: (current: number) => number): void {
    setValue(to)
  }

  // Typing keeps its own contract: the stepper is for nudging, Enter and blur commit at once.
  function commit(next: number): void {
    if (next === value) return
    committed.current = next
    setValue(next)
    onCommit(next)
  }

  return { value, nudge, commit }
}

function MinStepper({ value, label, pending, onCommit }: StepperProps) {
  const burst = useBurst(value, onCommit)
  const min = burst.value

  function nudge(step: number): void {
    burst.nudge((current) => Math.min(MAX_STREAK, Math.max(MIN_STREAK, current + step)))
  }

  function commit(raw: string): void {
    const typed = Number.parseInt(raw, 10)
    if (!Number.isInteger(typed)) return
    burst.commit(typed)
  }

  function onBlur(blur: FocusEvent<HTMLInputElement>): void {
    commit(blur.currentTarget.value)
  }

  function onKeyDown(press: KeyboardEvent<HTMLInputElement>): void {
    if (press.key !== 'Enter') return
    commit(press.currentTarget.value)
  }

  return (
    <Field label={label}>
      <div className={cn('flex h-11 rounded-lg border border-rule', WIDTHS['turni minimo'])}>
        <button
          type="button"
          aria-label="diminuisci"
          disabled={pending || min <= MIN_STREAK}
          onClick={() => nudge(-1)}
          className={cn(STEP, FOCUS)}
        >
          −
        </button>
        <input
          key={min}
          type="number"
          inputMode="numeric"
          min={MIN_STREAK}
          max={MAX_STREAK}
          disabled={pending}
          defaultValue={min}
          aria-label={label}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={cn(VALUE, NO_SPINNER, FOCUS)}
        />
        <button
          type="button"
          aria-label="aumenta"
          disabled={pending || min >= MAX_STREAK}
          onClick={() => nudge(1)}
          className={cn(STEP, FOCUS)}
        >
          +
        </button>
      </div>
    </Field>
  )
}

// The same burst, the same frame, a ladder instead of ±1: the value is a rarity, so it reads and
// types as `1 su 2,5k` rather than as a bare number.
function RarityStepper({ value, label, pending, onCommit }: StepperProps) {
  const burst = useBurst(value, onCommit)
  const rarity = burst.value
  const shown = `1 su ${compactOneIn(rarity)}`

  // A typed 123456 reads back as `1 su 123k`, so parsing the field the user never touched would
  // commit 123000: text still as rendered is not an edit, and commits nothing.
  function commit(raw: string): void {
    if (raw === shown) return
    const typed = parseOneIn(raw)
    if (typed === null) return
    burst.commit(typed)
  }

  function onBlur(blur: FocusEvent<HTMLInputElement>): void {
    commit(blur.currentTarget.value)
  }

  function onKeyDown(press: KeyboardEvent<HTMLInputElement>): void {
    if (press.key !== 'Enter') return
    commit(press.currentTarget.value)
  }

  return (
    <Field label={label}>
      <div className={cn('flex h-11 rounded-lg border border-rule', WIDTHS['raro almeno'])}>
        <button
          type="button"
          aria-label="meno raro"
          disabled={pending || rarity <= MIN_RARITY}
          onClick={() => burst.nudge(rungBelow)}
          className={cn(STEP, FOCUS)}
        >
          −
        </button>
        <input
          key={rarity}
          type="text"
          inputMode="numeric"
          disabled={pending}
          defaultValue={shown}
          aria-label={label}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={cn(VALUE, FOCUS)}
        />
        <button
          type="button"
          aria-label="più raro"
          disabled={pending || rarity >= MAX_RARITY}
          onClick={() => burst.nudge(rungAbove)}
          className={cn(STEP, FOCUS)}
        >
          +
        </button>
      </div>
    </Field>
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

  function applyDirection(value: string[]): void {
    const [direction] = value
    if (direction !== 'not' && direction !== 'yes') return
    apply({ ...query, direction })
  }

  const selectedEvent = query.events.length === EVENTS.length ? ALL : query.events[0]
  const minLabel = `${unitFor(query.venue)} minimo`

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
            <SelectValue>{(value: string | null) => selectedEventLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className={POPUP}>
            <SelectItem value={ALL} className={ITEM}>
              tutti
            </SelectItem>
            {EVENTS.map((event) => (
              <SelectItem key={event.id} value={event.id} className={ITEM}>
                {eventLabel(event.id, 'yes')}
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

      {/* The domain's own two words, each named positively: a run of the event not happening is a
          ritardo, a run of it happening is a serie. Neither needs a legend to be read. */}
      <ToggleGroup
        spacing={0}
        disabled={pending}
        value={[query.direction]}
        onValueChange={applyDirection}
        className={cn('h-11 rounded-lg border border-rule', WIDTHS.direzione)}
      >
        <ToggleGroupItem value="not" className={cn(TOGGLE, FOCUS)}>
          ritardi
        </ToggleGroupItem>
        <ToggleGroupItem value="yes" className={cn(TOGGLE, FOCUS, 'border-l border-rule')}>
          serie
        </ToggleGroupItem>
      </ToggleGroup>

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

      <MinStepper
        key={query.min}
        value={query.min}
        label={minLabel}
        pending={pending}
        onCommit={(min) => apply({ ...query, min })}
      />

      <RarityStepper
        key={query.rarity}
        value={query.rarity}
        label="raro almeno"
        pending={pending}
        onCommit={(rarity) => apply({ ...query, rarity })}
      />
    </div>
  )
}
