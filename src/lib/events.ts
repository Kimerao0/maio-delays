import type { Match } from '@/lib/matches'

export type EventId =
  | 'win'
  | 'draw'
  | 'loss'
  | 'scores'
  | 'concedes'
  | 'btts'
  | 'over05'
  | 'over15'
  | 'over25'
  | 'under05'
  | 'under15'
  | 'under25'

export type Period = 'ft' | 'ht'
export type Side = 'home' | 'away'

// Which way a run points: a run of non-occurrences, or a run of occurrences.
export type Direction = 'not' | 'yes'

export type EventDef = {
  id: EventId
  labelNot: string
  labelYes: string
  shortNot: string
  shortYes: string
}

// Both directions are spelled out rather than composed: Italian negates `btts` as `no goal`, never
// as `non goal`, so a `non ` prefix rule would be wrong for it.
export const EVENTS: readonly EventDef[] = [
  { id: 'win', labelNot: 'non vince', labelYes: 'vince', shortNot: 'no V', shortYes: 'V' },
  { id: 'draw', labelNot: 'non pareggia', labelYes: 'pareggia', shortNot: 'no X', shortYes: 'X' },
  { id: 'loss', labelNot: 'non perde', labelYes: 'perde', shortNot: 'no S', shortYes: 'S' },
  { id: 'scores', labelNot: 'non segna', labelYes: 'segna', shortNot: 'no GF', shortYes: 'GF' },
  {
    id: 'concedes',
    labelNot: 'non subisce',
    labelYes: 'subisce',
    shortNot: 'no GS',
    shortYes: 'GS',
  },
  { id: 'btts', labelNot: 'no goal', labelYes: 'goal', shortNot: 'no GG', shortYes: 'GG' },
  {
    id: 'over05',
    labelNot: 'non over 0.5',
    labelYes: 'over 0.5',
    shortNot: 'no O0.5',
    shortYes: 'O0.5',
  },
  {
    id: 'over15',
    labelNot: 'non over 1.5',
    labelYes: 'over 1.5',
    shortNot: 'no O1.5',
    shortYes: 'O1.5',
  },
  {
    id: 'over25',
    labelNot: 'non over 2.5',
    labelYes: 'over 2.5',
    shortNot: 'no O2.5',
    shortYes: 'O2.5',
  },
  {
    id: 'under05',
    labelNot: 'non under 0.5',
    labelYes: 'under 0.5',
    shortNot: 'no U0.5',
    shortYes: 'U0.5',
  },
  {
    id: 'under15',
    labelNot: 'non under 1.5',
    labelYes: 'under 1.5',
    shortNot: 'no U1.5',
    shortYes: 'U1.5',
  },
  {
    id: 'under25',
    labelNot: 'non under 2.5',
    labelYes: 'under 2.5',
    shortNot: 'no U2.5',
    shortYes: 'U2.5',
  },
]

// A table of hundreds of rows asks for a label per row, so the lookup is built once.
const EVENT_BY_ID: ReadonlyMap<EventId, EventDef> = new Map(EVENTS.map((e) => [e.id, e]))

export function eventLabel(id: EventId, dir: Direction): string {
  const event = EVENT_BY_ID.get(id)
  if (!event) return id
  if (dir === 'yes') return event.labelYes
  return event.labelNot
}

export function eventShort(id: EventId, dir: Direction): string {
  const event = EVENT_BY_ID.get(id)
  if (!event) return id
  if (dir === 'yes') return event.shortYes
  return event.shortNot
}

function goals(match: Match, side: Side, period: Period): { own: number; opp: number } {
  const home = period === 'ft' ? match.ftHome : match.htHome
  const away = period === 'ft' ? match.ftAway : match.htAway
  if (side === 'home') return { own: home, opp: away }
  return { own: away, opp: home }
}

// Plain occurrence: the direction is the UI framing, and the streak layer is what applies it.
export function occurred(id: EventId, match: Match, side: Side, period: Period): boolean {
  const { own, opp } = goals(match, side, period)
  const total = own + opp
  switch (id) {
    case 'win':
      return own > opp
    case 'draw':
      return own === opp
    case 'loss':
      return own < opp
    case 'scores':
      return own > 0
    case 'concedes':
      return opp > 0
    case 'btts':
      return own > 0 && opp > 0
    case 'over05':
      return total > 0.5
    case 'over15':
      return total > 1.5
    case 'over25':
      return total > 2.5
    case 'under05':
      return total < 0.5
    case 'under15':
      return total < 1.5
    case 'under25':
      return total < 2.5
    default: {
      const unreachable: never = id
      throw new Error(`Unknown event: ${unreachable}`)
    }
  }
}
