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

export type EventDef = { id: EventId; label: string; short: string }

export const EVENTS: readonly EventDef[] = [
  { id: 'win', label: 'non vince', short: 'no V' },
  { id: 'draw', label: 'non pareggia', short: 'no X' },
  { id: 'loss', label: 'non perde', short: 'no S' },
  { id: 'scores', label: 'non segna', short: 'no GF' },
  { id: 'concedes', label: 'non subisce', short: 'no GS' },
  { id: 'btts', label: 'no goal', short: 'no GG' },
  { id: 'over05', label: 'non over 0.5', short: 'no O0.5' },
  { id: 'over15', label: 'non over 1.5', short: 'no O1.5' },
  { id: 'over25', label: 'non over 2.5', short: 'no O2.5' },
  { id: 'under05', label: 'non under 0.5', short: 'no U0.5' },
  { id: 'under15', label: 'non under 1.5', short: 'no U1.5' },
  { id: 'under25', label: 'non under 2.5', short: 'no U2.5' },
]

function goals(match: Match, side: Side, period: Period): { own: number; opp: number } {
  const home = period === 'ft' ? match.ftHome : match.htHome
  const away = period === 'ft' ? match.ftAway : match.htAway
  if (side === 'home') return { own: home, opp: away }
  return { own: away, opp: home }
}

// Plain occurrence: the "non ..." labels are the UI framing, the streak layer inverts this.
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
