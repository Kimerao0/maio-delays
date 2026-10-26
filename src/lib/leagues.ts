export type League = { div: string; name: string; tag: string }

export const LEAGUES: readonly League[] = [
  { div: 'I1', name: 'Serie A', tag: 'ITA' },
  { div: 'I2', name: 'Serie B', tag: 'ITA2' },
  { div: 'E0', name: 'Premier League', tag: 'ENG' },
  { div: 'E1', name: 'Championship', tag: 'ENG2' },
  { div: 'E2', name: 'League One', tag: 'ENG3' },
  { div: 'E3', name: 'League Two', tag: 'ENG4' },
  { div: 'EC', name: 'National League', tag: 'ENG5' },
  { div: 'SP1', name: 'Liga', tag: 'ESP' },
  { div: 'SP2', name: 'Liga 2', tag: 'ESP2' },
  { div: 'D1', name: 'Bundesliga', tag: 'GER' },
  { div: 'D2', name: '2. Bundesliga', tag: 'GER2' },
  { div: 'F1', name: 'Ligue 1', tag: 'FRA' },
  { div: 'F2', name: 'Ligue 2', tag: 'FRA2' },
  { div: 'N1', name: 'Eredivisie', tag: 'NED' },
  { div: 'B1', name: 'Jupiler Pro League', tag: 'BEL' },
  { div: 'P1', name: 'Primeira Liga', tag: 'POR' },
  { div: 'T1', name: 'Süper Lig', tag: 'TUR' },
  { div: 'G1', name: 'Super League', tag: 'GRE' },
  { div: 'SC0', name: 'Premiership', tag: 'SCO' },
  { div: 'SC1', name: 'Championship (SCO)', tag: 'SCO2' },
  { div: 'SC2', name: 'League One (SCO)', tag: 'SCO3' },
]

const BY_DIV: ReadonlyMap<string, League> = new Map(LEAGUES.map((l) => [l.div, l]))

export function leagueByDiv(div: string): League | undefined {
  return BY_DIV.get(div)
}
