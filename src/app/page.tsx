import { cache, Suspense } from 'react'
import { FilterShell } from '@/components/filter-shell'
import { Filters, FiltersSkeleton } from '@/components/filters'
import { parseSort, RitardiTable, RitardiTableSkeleton } from '@/components/ritardi-table'
import { leagueByDiv } from '@/lib/leagues'
import { parseQuery, type Query, type RawSearchParams } from '@/lib/query'
import { atLeastAsRareAs, baseRates, rankByRarity } from '@/lib/rarity'
import { loadSnapshot } from '@/lib/source'
import { computeRitardi, streakRuns, unitFor } from '@/lib/streaks'

type Params = Promise<RawSearchParams>

const TIME = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })

const FRAME = 'mx-auto w-full max-w-[min(100%-2rem,84rem)]'

// One snapshot per request although three boundaries ask for it; `cache` keys on the argument, so
// the key is the primitive the three of them can agree on.
const snapshotOf = cache((divs: string) => loadSnapshot(divs.split(',')))

function leagueNotice(divs: string[]): string | null {
  if (divs.length === 0) return null
  const names = divs.map((div) => leagueByDiv(div)?.name ?? div).join(', ')
  const verb = divs.length === 1 ? 'non risponde' : 'non rispondono'
  return `${names} ${verb}. Le altre leghe sono aggiornate.`
}

function notices(failed: string[]): string[] {
  const messages: string[] = []
  const leagues = leagueNotice(failed.filter((div) => div !== 'fixtures'))
  if (leagues) messages.push(leagues)
  if (failed.includes('fixtures')) messages.push('Il calendario non risponde.')
  return messages
}

// Every selected league down is an outage, not a filter that happened to match nothing: there are
// no other leagues to call aggiornate, and the minimum is not what emptied the table.
function isOutage(failed: string[], divs: string[]): boolean {
  return failed.filter((div) => div !== 'fixtures').length === divs.length
}

// With a rarity floor set high the rows are there and the floor hid them, so the minimum is the
// wrong thing to blame.
function emptyMessage(query: Query, hiddenByRarity: boolean): string {
  if (hiddenByRarity) return 'Nessuna squadra è così rara. Abbassa la soglia.'
  return `Nessuna squadra arriva a ${query.min} ${unitFor(query.venue)}. Abbassa il minimo.`
}

function stamp(fetchedAt: Date | null): string {
  if (!fetchedAt) return '--:--'
  return TIME.format(fetchedAt)
}

async function Freshness({ searchParams }: { searchParams: Params }) {
  const query = parseQuery(await searchParams)
  const snapshot = await snapshotOf(query.divs.join(','))
  return <p>agg. {stamp(snapshot.fetchedAt)}</p>
}

// Only the verb, the count and its unit are request-time, so the rest of the sentence prerenders
// with the shell. With `occ=si` the run is of the event itself, and the "non" would invert it.
async function Verb({ searchParams }: { searchParams: Params }) {
  const query = parseQuery(await searchParams)
  if (query.direction === 'yes') return <>registrano</>
  return <>non registrano</>
}

async function MinCount({ searchParams }: { searchParams: Params }) {
  const query = parseQuery(await searchParams)
  return <>{`${query.min} ${unitFor(query.venue)}`}</>
}

async function FilterBar({ searchParams }: { searchParams: Params }) {
  return <Filters query={parseQuery(await searchParams)} />
}

async function RitardiSection({ searchParams }: { searchParams: Params }) {
  const params = await searchParams
  const query = parseQuery(params)
  const snapshot = await snapshotOf(query.divs.join(','))

  if (isOutage(snapshot.failed, query.divs)) {
    return (
      <p className={`${FRAME} py-8 text-[13px] text-quiet`}>
        Dati non disponibili. Riprova tra qualche minuto.
      </p>
    )
  }

  const rows = computeRitardi(snapshot.matches, {
    events: query.events,
    period: query.period,
    direction: query.direction,
    venue: query.venue,
    min: query.min,
  })
  const ranked = rankByRarity(rows, baseRates(snapshot.matches, query.period, query.venue))
  const rare = atLeastAsRareAs(ranked, query.rarity)
  const runs = streakRuns(snapshot.matches, rows, query.period, query.direction, query.venue)
  const messages = notices(snapshot.failed)

  return (
    <div className="flex flex-col gap-4">
      {messages.length > 0 && (
        <div className={`${FRAME} text-[13px] text-quiet`}>
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      {rare.length === 0 && (
        <p className={`${FRAME} py-8 text-[13px] text-quiet`}>
          {emptyMessage(query, ranked.length > 0)}
        </p>
      )}
      {rare.length > 0 && (
        <RitardiTable
          rows={rare}
          runs={runs}
          fixtures={snapshot.fixtures}
          // Request time, not the snapshot's: which fixture is next turns over at midnight whatever
          // hour the bodies were downloaded.
          now={new Date()}
          query={query}
          sort={parseSort(params)}
        />
      )}
    </div>
  )
}

// Request-time data never reaches this component, so the title and the frames prerender as the
// static shell and each boundary below streams into it.
export default function Page({ searchParams }: { searchParams: Params }) {
  return (
    <main className="flex flex-1 flex-col gap-4 py-4">
      <div className={`${FRAME} flex flex-col gap-1`}>
        <div className="flex h-7 items-center justify-between gap-3 text-[15px] text-quiet">
          <h1>la statistica è un’opinione</h1>
          <Suspense fallback={<p>agg. --:--</p>}>
            <Freshness searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="text-[13px] text-quiet">
          Squadre che{' '}
          <Suspense fallback={<>non registrano</>}>
            <Verb searchParams={searchParams} />
          </Suspense>{' '}
          un evento da almeno{' '}
          <Suspense fallback={<span className="tabular-nums">--</span>}>
            <MinCount searchParams={searchParams} />
          </Suspense>
          , ordinate dalle più rare.
        </p>
      </div>
      <FilterShell
        bar={
          <Suspense fallback={<FiltersSkeleton />}>
            <FilterBar searchParams={searchParams} />
          </Suspense>
        }
      >
        <Suspense fallback={<RitardiTableSkeleton />}>
          <RitardiSection searchParams={searchParams} />
        </Suspense>
      </FilterShell>
    </main>
  )
}
