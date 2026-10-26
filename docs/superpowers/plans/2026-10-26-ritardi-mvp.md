# Ritardi MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first Next.js app that lists, across 21 European leagues, every team whose current run without a chosen betting event is at least N matches long.

**Architecture:** Pure functions in `src/lib` do all the maths over plain `Match` objects, and are unit-tested against real CSVs committed as fixtures. A single server component fetches the CSVs (cached 3h), runs those functions and renders one dense table; the only client components are the filter bar, which writes the URL, and the row-detail sheet.

**Tech Stack:** Next.js App Router, TypeScript, pnpm, Biome, Tailwind, shadcn/ui (select, toggle-group, badge, table, sheet), Vitest.

**Spec:** `docs/spec.md`

## Global Constraints

- pnpm only. Biome for lint and format — no ESLint, no Prettier.
- shadcn components limited to `select`, `toggle-group`, `badge`, `table`, `sheet`.
- No horizontal scroll at 390px; 48px table rows.
- UI copy in Italian; code, comments, tests and docs in English.
- No database, no auth, no cron.
- Every filter round-trips through the URL query string.
- Fetch the bare host `https://football-data.co.uk` — `www.` 302-redirects.

## Review Focus

1. **BOM on the header row** (`﻿Div`) — the first column name does not match `"Div"`, so every row parses as empty and the page silently shows nothing. Test in Task 2.
2. **`dd/mm/yyyy` parsed as a US date** — `new Date("22/08/2026")` is `Invalid Date` and `"05/08/2026"` silently becomes 8 May, reordering matches and corrupting every streak. Test in Task 2.
3. **Rows with empty `FTHG`/`FTAG`** (postponed, or listed before kick-off) — they must be dropped, not read as 0-0, which would extend "non segna" runs that never happened. Test in Task 2.
4. **`fixtures.csv` holding only the current round, with dates already past and teams absent** — the next match must come back `null` rather than a fixture that was played yesterday. Test in Task 5.
5. **One league's CSV failing** (404, timeout, truncated body) — the other 20 leagues must still answer and the failed one must be named, not swallowed. Test in Task 5.

---

### Task 1: Scaffold and gate

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml` (omit if single package), `tsconfig.json`, `next.config.ts`, `biome.json`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `components.json`
- Create: `src/lib/leagues.ts`, `tests/leagues.test.ts`

**Interfaces:**
- Produces: `LEAGUES: readonly League[]` where `League = { div: string; name: string; tag: string }`, in the spec's table order; `leagueByDiv(div: string): League | undefined`.

- [ ] **Step 1: Scaffold the app**

`pnpm create next-app` with TypeScript, Tailwind and the App Router, no ESLint, `src/` directory. Then `pnpm add -D @biomejs/biome vitest` and `pnpm dlx shadcn@latest init`, followed by `pnpm dlx shadcn@latest add select toggle-group badge table sheet`. Pin exact versions in `package.json`.

- [ ] **Step 2: Add the verify script**

`"verify": "biome check . && tsc --noEmit && vitest run"` in `package.json`.

- [ ] **Step 3: Write the failing test**

```ts
// tests/leagues.test.ts
test('LEAGUES covers the 21 divisions in fixtures.csv', () => {
  expect(LEAGUES.map((l) => l.div)).toEqual([
    'I1','I2','E0','E1','E2','E3','EC','SP1','SP2','D1','D2',
    'F1','F2','N1','B1','P1','T1','G1','SC0','SC1','SC2',
  ])
})
test('tags are unique', () => {
  expect(new Set(LEAGUES.map((l) => l.tag)).size).toBe(LEAGUES.length)
})
test('leagueByDiv resolves a known division', () => {
  expect(leagueByDiv('I1')).toEqual({ div: 'I1', name: 'Serie A', tag: 'ITA' })
})
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm vitest run tests/leagues.test.ts`
Expected: FAIL, cannot resolve `src/lib/leagues`.

- [ ] **Step 5: Write `src/lib/leagues.ts`**

Transcribe the spec's league table verbatim.

- [ ] **Step 6: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold next+biome+shadcn, add league catalog"
```

---

### Task 2: Parse the CSVs into matches

**Files:**
- Create: `src/lib/csv.ts`, `src/lib/season.ts`, `src/lib/matches.ts`
- Create: `tests/csv.test.ts`, `tests/season.test.ts`, `tests/matches.test.ts`
- Use: `tests/fixtures/I1-2627.csv`, `tests/fixtures/fixtures.csv` (already committed, downloaded 2026-10-26)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseCsv(text: string): Record<string, string>[]` — strips the BOM, skips blank lines, tolerates trailing commas.
  - `currentSeasonCode(now: Date): string`
  - `type Match = { div: string; date: Date; home: string; away: string; ftHome: number; ftAway: number; htHome: number; htAway: number }`
  - `type Fixture = { div: string; date: Date; home: string; away: string }`
  - `parseMatches(text: string): Match[]` — chronological, oldest first.
  - `parseFixtures(text: string): Fixture[]`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/csv.test.ts
test('strips the UTF-8 BOM from the first column name', () => {
  const rows = parseCsv('﻿Div,Date\nI1,22/08/2026\n')
  expect(rows[0].Div).toBe('I1')
})
test('ignores blank and whitespace-only lines', () => {
  expect(parseCsv('A,B\n1,2\n\n   \n')).toHaveLength(1)
})
test('keeps a field containing a quoted comma intact', () => {
  expect(parseCsv('A,B\n"x,y",2\n')[0].A).toBe('x,y')
})

// tests/season.test.ts
test.each([
  ['2026-10-26', '2627'],
  ['2026-07-01', '2627'],
  ['2026-06-30', '2526'],
  ['2027-01-15', '2627'],
])('%s is season %s', (iso, code) => {
  expect(currentSeasonCode(new Date(iso))).toBe(code)
})

// tests/matches.test.ts
const i1 = readFileSync('tests/fixtures/I1-2627.csv', 'utf8')

test('parses every played match in the real Serie A file', () => {
  expect(parseMatches(i1)).toHaveLength(70)
})
test('reads dd/mm/yyyy as a day, not a month', () => {
  const first = parseMatches(i1)[0]
  expect(first.date.getMonth()).toBe(7) // August
  expect(first.date.getDate()).toBe(22)
})
test('returns matches oldest first', () => {
  const dates = parseMatches(i1).map((m) => m.date.getTime())
  expect(dates).toEqual([...dates].sort((a, b) => a - b))
})
test('reads full-time and half-time goals', () => {
  const inter = parseMatches(i1).find((m) => m.home === 'Inter' && m.away === 'Monza')
  expect(inter).toMatchObject({ ftHome: 4, ftAway: 1, htHome: 1, htAway: 1 })
})
test('drops a row whose full-time goals are empty', () => {
  const text = '﻿Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG\n'
    + 'I1,22/08/2026,Inter,Monza,,,,\n'
    + 'I1,23/08/2026,Roma,Lazio,1,0,0,0\n'
  expect(parseMatches(text).map((m) => m.home)).toEqual(['Roma'])
})
test('parses the real fixtures file', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  expect(fx).toHaveLength(10)
  expect(fx.every((f) => f.div === 'I1')).toBe(true)
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run tests/csv.test.ts tests/season.test.ts tests/matches.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three modules**

Hand-roll `parseCsv`; do not add a CSV dependency for a file this regular. Parse dates by splitting on `/` — never pass a `dd/mm/yyyy` string to the `Date` constructor.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: parse football-data CSVs into matches"
```

---

### Task 3: The event catalog

**Files:**
- Create: `src/lib/events.ts`, `tests/events.test.ts`

**Interfaces:**
- Consumes: `Match` from Task 2.
- Produces:
  - `type EventId = 'win' | 'draw' | 'loss' | 'scores' | 'concedes' | 'btts' | 'over05' | 'over15' | 'over25' | 'under05' | 'under15' | 'under25'`
  - `type Period = 'ft' | 'ht'`
  - `type Side = 'home' | 'away'`
  - `EVENTS: readonly { id: EventId; label: string; short: string }[]` — the spec's table, in its order.
  - `occurred(id: EventId, match: Match, side: Side, period: Period): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
const m = (ftHome: number, ftAway: number, htHome = 0, htAway = 0): Match => ({
  div: 'I1', date: new Date(2026, 7, 22), home: 'A', away: 'B', ftHome, ftAway, htHome, htAway,
})

test.each<[EventId, Side, boolean]>([
  ['win', 'home', true], ['win', 'away', false],
  ['loss', 'home', false], ['loss', 'away', true],
  ['draw', 'home', false],
  ['scores', 'home', true], ['concedes', 'home', true],
  ['btts', 'home', true],
  ['over25', 'home', true], ['under25', 'home', false],
  ['over05', 'home', true], ['under05', 'home', false],
])('2-1 full time: %s for %s is %s', (id, side, expected) => {
  expect(occurred(id, m(2, 1), side, 'ft')).toBe(expected)
})

test('a 0-0 draw occurs as draw, under and not btts', () => {
  expect(occurred('draw', m(0, 0), 'home', 'ft')).toBe(true)
  expect(occurred('under05', m(0, 0), 'home', 'ft')).toBe(true)
  expect(occurred('btts', m(0, 0), 'home', 'ft')).toBe(false)
})

test('half time reads the half-time goals, not the full-time ones', () => {
  const match = m(3, 0, 0, 1) // 0-1 at the break, 3-0 at the end
  expect(occurred('win', match, 'home', 'ht')).toBe(false)
  expect(occurred('loss', match, 'home', 'ht')).toBe(true)
  expect(occurred('scores', match, 'home', 'ht')).toBe(false)
  expect(occurred('over15', match, 'home', 'ht')).toBe(false)
})

test('the catalog holds all 12 events with unique ids and labels', () => {
  expect(EVENTS).toHaveLength(12)
  expect(new Set(EVENTS.map((e) => e.short)).size).toBe(12)
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run tests/events.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/events.ts`**

Derive the result events from the chosen period's goals, not from `FTR`/`HTR`. One `switch` over `EventId`, early return per branch — no nested ternaries.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add the 12-event occurrence catalog"
```

---

### Task 4: Compute the ritardi

**Files:**
- Create: `src/lib/streaks.ts`, `tests/streaks.test.ts`

**Interfaces:**
- Consumes: `Match` (Task 2), `EventId` / `Period` / `occurred` (Task 3).
- Produces:
  - `type Venue = 'home' | 'away' | 'all'`
  - `type Ritardo = { div: string; team: string; event: EventId; period: Period; streak: number; lastMatch: Date }`
  - `computeRitardi(matches: Match[], opts: { events: EventId[]; period: Period; venue: Venue; min: number }): Ritardo[]` — sorted by `streak` descending, ties by `div` then `team`.
  - `streakMatches(matches: Match[], team: string, event: EventId, period: Period, venue: Venue): Match[]` — the matches making up the run, newest first, for the detail sheet.

- [ ] **Step 1: Write the failing tests**

```ts
test('counts consecutive non-occurrences back from the newest match', () => {
  const out = computeRitardi(fixtureMatches, { events: ['win'], period: 'ft', venue: 'all', min: 1 })
  expect(out.find((r) => r.team === 'C')?.streak).toBe(3)
})
test('a team whose newest match had the event has a streak of 0 and is filtered out by min 1', () => {
  const out = computeRitardi(fixtureMatches, { events: ['win'], period: 'ft', venue: 'all', min: 1 })
  expect(out.find((r) => r.team === 'B')).toBeUndefined()
})
test('venue home counts only home matches, consecutively among themselves', () => {
  // A's away win sits between its two home draws: it breaks the all-venue run but not the home one.
  const all = computeRitardi(fixtureMatches, { events: ['win'], period: 'ft', venue: 'all', min: 1 })
  const home = computeRitardi(fixtureMatches, { events: ['win'], period: 'ft', venue: 'home', min: 1 })
  expect(all.find((r) => r.team === 'A')?.streak).toBe(1)
  expect(home.find((r) => r.team === 'A')?.streak).toBe(2)
})
test('min filters out shorter runs', () => {
  expect(computeRitardi(fixtureMatches, { events: ['win'], period: 'ft', venue: 'all', min: 99 })).toEqual([])
})
test('sorts by streak descending, then division, then team', () => {
  const out = computeRitardi(fixtureMatches, { events: ['win', 'draw'], period: 'ft', venue: 'all', min: 1 })
  expect(out).toEqual([...out].sort((a, b) => b.streak - a.streak || a.div.localeCompare(b.div) || a.team.localeCompare(b.team)))
})
test('a team with no matches produces no row', () => {
  expect(computeRitardi([], { events: ['win'], period: 'ft', venue: 'all', min: 1 })).toEqual([])
})
test('real Serie A data produces a ritardo no longer than the matches played', () => {
  const played = 7 // rounds in tests/fixtures/I1-2627.csv
  const out = computeRitardi(parseMatches(i1), { events: ['draw'], period: 'ft', venue: 'all', min: 1 })
  expect(Math.max(...out.map((r) => r.streak))).toBeLessThanOrEqual(played)
})
test('streakMatches returns the run newest first', () => {
  const run = streakMatches(fixtureMatches, 'C', 'win', 'ft', 'all')
  expect(run).toHaveLength(3)
  expect(run[0].date.getTime()).toBeGreaterThan(run[1].date.getTime())
})
```

`fixtureMatches` is a hand-built `Match[]` local to this test file, with explicit ascending dates, laid out so that:

| Team | oldest → newest | `win` ritardo, venue `all` | venue `home` |
|---|---|---|---|
| A | home draw, away win, home draw | 1 | 2 |
| B | away loss, home win, away win | 0 | 0 |
| C | home draw, away draw, home draw | 3 | 2 |

Do not reuse the real CSV for the ordering assertions.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run tests/streaks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/streaks.ts`**

Group matches by team, filter by venue, sort newest first, count until `occurred` is true. Small functions, early returns.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: compute ritardi from matches"
```

---

### Task 5: Fetch and cache the source

**Files:**
- Create: `src/lib/source.ts`, `tests/source.test.ts`

**Interfaces:**
- Consumes: `LEAGUES` (Task 1), `parseMatches` / `parseFixtures` / `currentSeasonCode` (Task 2).
- Produces:
  - `type Snapshot = { matches: Match[]; fixtures: Fixture[]; fetchedAt: Date; failed: string[] }`
  - `loadSnapshot(divs: string[], now?: Date): Promise<Snapshot>` — `fetch` with `{ next: { revalidate: 10800 } }`, the 21 leagues in parallel.
  - `nextFixture(fixtures: Fixture[], div: string, team: string, now: Date): Fixture | null` — the earliest fixture on or after `now`'s calendar day involving that team, or `null`.

- [ ] **Step 1: Write the failing tests**

```ts
test('one failing league does not fail the snapshot, and is named', async () => {
  // stub fetch: I1 ok, E0 -> 404
  const snap = await loadSnapshot(['I1', 'E0'])
  expect(snap.matches.length).toBeGreaterThan(0)
  expect(snap.failed).toEqual(['E0'])
})
test('a truncated body is reported as a failure, not parsed as zero matches', async () => {
  // stub fetch: I1 -> "﻿Div,Date" with no rows
  const snap = await loadSnapshot(['I1'])
  expect(snap.failed).toEqual(['I1'])
})
test('nextFixture ignores a fixture whose date is already past', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  expect(nextFixture(fx, 'I1', 'Inter', new Date(2027, 0, 1))).toBeNull()
})
test('nextFixture returns null for a team absent from the file', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  expect(nextFixture(fx, 'I1', 'Chievo', new Date(2026, 9, 23))).toBeNull()
})
test('nextFixture includes a fixture later today', () => {
  const fx = parseFixtures(readFileSync('tests/fixtures/fixtures.csv', 'utf8'))
  const f = nextFixture(fx, 'I1', fx[0].home, fx[0].date)
  expect(f?.home).toBe(fx[0].home)
})
test('requests the bare host and the derived season', async () => {
  const spy = vi.spyOn(globalThis, 'fetch')
  await loadSnapshot(['I1'], new Date(2026, 9, 26))
  expect(spy).toHaveBeenCalledWith('https://football-data.co.uk/mmz4281/2627/I1.csv', expect.anything())
})
```

Stub `globalThis.fetch` with `vi.stubGlobal`. No network in tests.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run tests/source.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/source.ts`**

`Promise.allSettled` over the divisions. A non-200, a thrown fetch or a parse yielding zero matches all land in `failed`. Compare fixture dates by calendar day, not by timestamp.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: fetch and cache league CSVs with per-league failure isolation"
```

---

### Task 6: The screen

**Files:**
- Create: `src/app/page.tsx`, `src/components/filters.tsx`, `src/components/ritardi-table.tsx`, `src/lib/query.ts`
- Create: `tests/query.test.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `parseQuery(sp: Record<string, string | string[] | undefined>): { events: EventId[]; period: Period; venue: Venue; divs: string[]; min: number }` and `toQuery(q): URLSearchParams`.

- [ ] **Step 1: Design the surface before writing it**

Invoke the `frontend-design` skill and write the plan into `docs/design/ritardi-screen.md`: colour roles as CSS variables (no bespoke hex), type roles, an ASCII wireframe with the measurements it implies at 390 / 1440 / 1920, and the one memorable element. Then review it against that skill's generic-default list and say what changed. **The owner reads this before any component is written.**

- [ ] **Step 2: Write the failing test**

```ts
test('defaults match the spec', () => {
  expect(parseQuery({})).toEqual({
    events: EVENTS.map((e) => e.id), period: 'ft', venue: 'all',
    divs: LEAGUES.map((l) => l.div), min: 6,
  })
})
test('round-trips a narrowed query', () => {
  const q = { events: ['draw'] as EventId[], period: 'ht' as const, venue: 'home' as const, divs: ['I1'], min: 8 }
  expect(parseQuery(Object.fromEntries(toQuery(q)))).toEqual(q)
})
test('rejects an unknown event id and falls back to all events', () => {
  expect(parseQuery({ events: 'nonsense' }).events).toHaveLength(12)
})
test('clamps min below 1 and above 60', () => {
  expect(parseQuery({ min: '0' }).min).toBe(1)
  expect(parseQuery({ min: '999' }).min).toBe(60)
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm vitest run tests/query.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `src/lib/query.ts`**

- [ ] **Step 5: Build the page**

`src/app/page.tsx` is an async server component: `parseQuery` → `loadSnapshot` → `computeRitardi` → render. It states `fetchedAt` and names any `failed` league.

`filters.tsx` is a client component using shadcn `select` and `toggle-group`, pushing to the router on change, with a same-frame pending state — a filter that looks inert until the server answers is the failure mode to avoid.

`ritardi-table.tsx` renders the four compact columns at 390px (`RIT`, `SQUADRA`, `EVENTO`, `LEGA`, 48px rows, league as a `badge`), revealing the full event label, last-match date and next match at `md`. Column headers are sort links that write the URL.

Predict, in the commit message, the content width and total page height at 390 / 1440 / 1920 in both colour schemes. Task 8 checks the prediction against the screenshots.

- [ ] **Step 6: Verify**

Run: `pnpm verify && pnpm build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: ritardi screen with URL-driven filters"
```

---

### Task 7: Row detail

**Files:**
- Create: `src/components/row-detail.tsx`
- Modify: `src/components/ritardi-table.tsx`

**Interfaces:**
- Consumes: `streakMatches` (Task 4), `nextFixture` (Task 5).

- [ ] **Step 1: Build the sheet**

Tapping a row opens a shadcn `sheet` with the next match (opponent, date, casa/trasferta, or `—` when `nextFixture` returns `null`) and the matches making up the run, newest first with their scores. The rows for each team are computed on the server and passed down — the sheet fetches nothing.

- [ ] **Step 2: Verify**

Run: `pnpm verify && pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: row detail sheet with next match and the run"
```

---

### Task 8: Look at it

**Files:**
- Create: `scripts/shots/index.ts` (ported from plotmate's `app/scripts/shots/`, pnpm, no auth cookie — this app has no login)
- Modify: `package.json` (`"shots": "tsx scripts/shots/index.ts"`)

- [ ] **Step 1: Port the shots script**

Drive the installed Chrome over the DevTools Protocol. Write `shots/<label>-<width>-<scheme>.png`, gitignored, at **390 / 1440 / 1920** in both colour schemes. Keep its one assertion: read `location.pathname` back and exit non-zero on a mismatch. Do **not** add it to `verify` or to any hook.

- [ ] **Step 2: Photograph the screen**

```bash
pnpm build && pnpm start &
pnpm shots / v1
```

- [ ] **Step 3: Open the PNGs and check the prediction**

Open every file. Report the predicted and the measured content width and page height side by side. A disagreement is a finding to fix, not a rounding error. Confirm there is no horizontal scroll at 390px.

- [ ] **Step 4: Run `ux-flow-review`**

Invoke the `ux-flow-review` agent on the finished screen: reachability, discoverability, empty state (no team reaches `min`), error state (a failed league), loading state, exit paths, 390-vs-1920 parity.

- [ ] **Step 5: Hand it over with the pictures**

Present the screenshots and the review findings. Not a checklist of things to click.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add shots script and verify the screen"
```
