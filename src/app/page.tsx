import { cache, Suspense } from 'react'
import { FilterShell } from '@/components/filter-shell'
import { Filters, FiltersSkeleton } from '@/components/filters'
import { parseSort, RitardiTable, RitardiTableSkeleton } from '@/components/ritardi-table'
import { leagueByDiv } from '@/lib/leagues'
import { parseQuery, type RawSearchParams } from '@/lib/query'
import { baseRates, rankByRarity } from '@/lib/rarity'
import { loadSnapshot } from '@/lib/source'
import { computeRitardi, streakRuns } from '@/lib/streaks'

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

function stamp(fetchedAt: Date | null): string {
  if (!fetchedAt) return '--:--'
  return TIME.format(fetchedAt)
}

async function Freshness({ searchParams }: { searchParams: Params }) {
  const query = parseQuery(await searchParams)
  const snapshot = await snapshotOf(query.divs.join(','))
  return <p>agg. {stamp(snapshot.fetchedAt)}</p>
}

// Only the numeral is request-time, so the sentence itself prerenders with the rest of the shell.
async function MinTurns({ searchParams }: { searchParams: Params }) {
  return <>{parseQuery(await searchParams).min}</>
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
    venue: query.venue,
    min: query.min,
  })
  const ranked = rankByRarity(rows, baseRates(snapshot.matches, query.period, query.venue))
  const runs = streakRuns(snapshot.matches, rows, query.period, query.venue)
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
      {ranked.length === 0 && (
        <p className={`${FRAME} py-8 text-[13px] text-quiet`}>
          Nessuna squadra arriva a {query.min} turni. Abbassa il minimo.
        </p>
      )}
      {ranked.length > 0 && (
        <RitardiTable
          rows={ranked}
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
        <div className="flex h-7 items-center justify-between text-[15px] text-quiet">
          <h1>ritardi</h1>
          <Suspense fallback={<p>agg. --:--</p>}>
            <Freshness searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="text-[13px] text-quiet">
          Squadre che non registrano un evento da almeno{' '}
          <Suspense fallback={<span className="tabular-nums">--</span>}>
            <MinTurns searchParams={searchParams} />
          </Suspense>{' '}
          turni, ordinate dalle più rare.
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
