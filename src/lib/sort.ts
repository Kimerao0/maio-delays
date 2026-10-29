import type { RawSearchParams } from '@/lib/query'

export type Dir = 'asc' | 'desc'

export type SortKey = 'raro' | 'da' | 'squadra' | 'evento' | 'lega' | 'ultima'
export type Sort = { key: SortKey; dir: Dir }

const SORT_KEYS: readonly SortKey[] = ['raro', 'da', 'squadra', 'evento', 'lega', 'ultima']

// Numeric columns read biggest-first, text columns A-Z, until the header is clicked again.
export const DEFAULT_DIR: Record<SortKey, Dir> = {
  raro: 'desc',
  da: 'desc',
  squadra: 'asc',
  evento: 'asc',
  lega: 'asc',
  ultima: 'desc',
}

export const DEFAULT_SORT: Sort = { key: 'raro', dir: DEFAULT_DIR.raro }

function readDir(raw: string | string[] | undefined, key: SortKey): Dir {
  if (raw === 'asc' || raw === 'desc') return raw
  return DEFAULT_DIR[key]
}

export function parseSort(sp: RawSearchParams): Sort {
  const key = SORT_KEYS.find((candidate) => candidate === sp.sort) ?? 'raro'
  return { key, dir: readDir(sp.dir, key) }
}

// Empty when the sort is the default one, the way toQuery leaves out a default filter.
export function toSort(sort: Sort): URLSearchParams {
  const params = new URLSearchParams()
  if (sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir) return params
  params.set('sort', sort.key)
  params.set('dir', sort.dir)
  return params
}
