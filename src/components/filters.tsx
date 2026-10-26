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
import { MAX_STREAK, MIN_STREAK, type Query, toQuery } from '@/lib/query'
import { unitFor, type Venue } from '@/lib/streaks'

const ALL = 'tutti'

// A burst of taps on the stepper has to settle into one navigation, not one per tap.
const IDLE_MS = 400

// The sort lives outside Query, so these are the params a filter change has to carry over by hand.
const SORT_PARAMS = ['sort', 'dir'] as const

const VENUES: readonly { value: Venue; label: string }[] = [
  { value: 'all', label: 'tutte' },
  { value: 'home', label: 'casa' },
  { value: 'away', label: 'trasferta' },
]

// Shared by the bar and its placeholder, so the controls land without moving the table.
// The sum per line is what keeps the bar at two rows inside the 358px phone frame: 136+104+96
// wraps after `quando`, 120+120+100 after the stepper.
const WIDTHS = {
  evento: 'w-[136px]',
  periodo: 'w-[104px]',
  quando: 'w-[96px]',
  dove: 'w-[120px]',
  leghe: 'w-[120px]',
  'turni minimo': 'w-[100px]',
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

// The event reads bare here, the negation is the `quando` toggle's job: `vince` + `non`.
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

type MinStepperProps = {
  value: number
  label: string
  pending: boolean
  onCommit: (min: number) => void
}

// The value is local so a tap acknowledges in the same frame, and the push waits for the burst to
// end: five taps are one navigation and one history entry. Re-arming on every render keeps the
// pushed query current if another filter moves meanwhile, and `committed` is what stops a
// re-render from pushing the same value twice. Keyed on the query's own min by the caller, so Back
// and a server answer both reset it.
function MinStepper({ value, label, pending, onCommit }: MinStepperProps) {
  const [min, setMin] = useState(value)
  const committed = useRef(value)

  useEffect(() => {
    if (min === committed.current) return
    const timer = setTimeout(() => {
      committed.current = min
      onCommit(min)
    }, IDLE_MS)
    return () => clearTimeout(timer)
  }, [min, onCommit])

  function nudge(step: number): void {
    setMin((current) => Math.min(MAX_STREAK, Math.max(MIN_STREAK, current + step)))
  }

  // Typing keeps its own contract: the stepper is for nudging, Enter and blur commit at once.
  function commit(raw: string): void {
    const typed = Number.parseInt(raw, 10)
    if (!Number.isInteger(typed) || typed === min) return
    committed.current = typed
    setMin(typed)
    onCommit(typed)
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

      {/* Reads as a sentence with the event: `vince` plus `non` is a run without a win. */}
      <Field label="quando">
        <ToggleGroup
          spacing={0}
          disabled={pending}
          value={[query.direction]}
          onValueChange={applyDirection}
          className={cn('h-11 rounded-lg border border-rule', WIDTHS.quando)}
        >
          <ToggleGroupItem value="not" aria-label="non accade" className={cn(TOGGLE, FOCUS)}>
            non
          </ToggleGroupItem>
          <ToggleGroupItem
            value="yes"
            aria-label="accade"
            className={cn(TOGGLE, FOCUS, 'border-l border-rule')}
          >
            sì
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

      <MinStepper
        key={query.min}
        value={query.min}
        label={minLabel}
        pending={pending}
        onCommit={(min) => apply({ ...query, min })}
      />
    </div>
  )
}
