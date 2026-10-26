# la statistica è un'opinione

Finds **statistical rarities in football**: teams on an unusually long run of something _not_
happening — or happening — across 21 European leagues.

> Quali sono le squadre che non pareggiano da 5 turni?
> Quali squadre non segnano nel primo tempo in casa da 6 turni?

Those two questions are the whole brief. They came from a friend who could already look up one team
at a time on someone else's app, but had no way to ask them across every team at once.

---

## The idea

A **ritardo** is lottery vocabulary — the number of draws since a number last came up. Italian
betting borrowed it for football. Here it means: **how many of a team's most recent matches in a row
an event did not happen in.**

The non-obvious part is what you do with that number. **Ranking by streak length does not work**, and
this is measured rather than assumed. Across 8 leagues at a minimum of 6 matches, raw streak ordering
returned 210 rows, of which:

- **106 were "no 0-0 yet"**. A 0-0 happens in about 5% of matches, so nearly every team has a long
  run without one. The least informative fact in the dataset crowded out everything else.
- The top was a **tie at the season ceiling** — the longest run was 9 everywhere, because only 6–9
  rounds had been played — so the tie-break handed the first page to whichever league was furthest
  into its season.
- Events that happen _often_ (scoring, conceding, over 1.5) returned **zero** rows, because their
  runs break constantly. One of the two questions above lives in that group.

So rows are ranked by **how unlikely a run that long is, given how often that event actually
happens** in the current season:

```
chance = (1 - p) ** streak     # for a run of NOT happening
chance = p ** streak           # for a run of happening
```

shown in the UI as `1 su N`. Brighton going 4 matches without conceding (conceding happens in 77% of
matches) scores **1 in 387**; Ajax going 9 without a 0-0 scores **1 in 1**. The first is worth a bet,
the second is noise.

`p` uses **Laplace smoothing**, `(hits + 1) / (pairs + 2)`. The raw fraction can be exactly 0 or 1 on
a short early-season sample, and a rate of 1 makes every chance 0 and every `1 su` infinite.

---

## Data flow

```
football-data.co.uk
  ├── mmz4281/{season}/{div}.csv   21 divisions, results
  └── fixtures.csv                 all divisions, CURRENT ROUND ONLY
            │
            │  fetch, 21+1 in parallel, cache: 'force-cache', revalidate 3h
            │  15s timeout each; one league failing never fails the rest
            ▼
      src/lib/csv.ts         strip the UTF-8 BOM, quote-aware split
      src/lib/matches.ts     dd/mm/yyyy by splitting on '/', never new Date(str)
            │                rows with empty full-time goals are DROPPED
            ▼
      src/lib/events.ts      did event X happen, for this team, this period?
            │                12 events × full-time / first-half × both directions
            ▼
      src/lib/streaks.ts     walk newest-first, count until the event flips
            │                venue filter: kept matches are consecutive
            │                among themselves
            ▼
      src/lib/rarity.ts      base rates from this season + (1-p)^n ranking
            ▼
      src/app/page.tsx       static shell + streamed table (PPR)
```

Every step above is a pure function over plain objects except `source.ts`, which is the only thing
that touches the network. That is why the maths is unit-tested against real committed CSVs
(`tests/fixtures/`) rather than mocks.

### Things the upstream data does that will bite you

All verified against the live files, not assumed:

|                 |                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Header row      | starts with a UTF-8 BOM (`\uFEFFDiv`) — the first column name does not match `"Div"`            |
| Dates           | `dd/mm/yyyy`. `new Date("22/08/2026")` is `Invalid Date`; `"05/08/2026"` silently becomes 8 May |
| Host            | `www.` 302-redirects; use the bare host                                                         |
| Postponed rows  | present with empty `FTHG`/`FTAG` — read as 0-0 they invent "didn't score" runs                  |
| No round column | there is no matchday field; a "turno" is inferred, never read                                   |
| `fixtures.csv`  | holds only the current round, so a missing next match is normal, not an error                   |
| Team names      | byte-identical between results and fixtures — no normalisation needed                           |

---

## How the app works

**One screen.** A filter bar over a dense table. Every filter lives in the URL, so a result can be
pasted into a chat and reconstructs exactly.

- **evento** — one of 12, or all of them mixed
- **quando** — whether the run is of the event _not_ happening or _happening_
- **periodo** — full time, or first half only (the CSVs carry half-time goals)
- **dove** — home, away or both. With a venue filter the kept matches are consecutive among
  themselves: an away win between two home draws does not break a home-only run
- **leghe** — any subset of the 21
- **turni minimo** — the floor on the run length

Rows are `team × event`, rarest first. Tapping one opens the next match and the matches that make up
the run.

### The 12 events

Results (`vince` / `pareggia` / `perde`), goals (`segna` / `subisce` / `goal`), and over-under at
0.5 / 1.5 / 2.5. Each works in both halves and both directions.

Result codes are **team-relative** and deliberately avoid `1` and `2`: in Italian betting those are
_absolute_ (home win, away win), so a team-relative `no 2` would mean the inverse of how a bettor
reads it on every away row. They are `V`, `X` and `S` instead.

### Rendering

`cacheComponents` is on, so uncached data outside a `<Suspense>` boundary fails the build. The title,
the explanatory line and the filter bar prerender as a static shell; the table streams in behind a
skeleton at the real row height. The route builds as `◐ Partial Prerender`.

---

## Honest limits

- **The rarity figure is a ranking heuristic, not a probability.** It treats matches as independent,
  which they are not — team quality is exactly _why_ a run persists. A good defence keeping six clean
  sheets is not six coin flips. Read `1 su N` as "roughly how surprising", never as odds.
- **Current season only.** Runs reset in August by design. Until some team anywhere reaches the
  minimum, the default view is empty and says so.
- **Base rates come from the season in progress**, so they are noisy early on. Smoothing keeps them
  usable, not accurate.
- **This is not betting advice.** A long run is a fact about the past. The name is the point.

---

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm verify       # biome + tsc + vitest
pnpm build && pnpm start
pnpm shots / v1   # screenshot 390/1440/1920 in both colour schemes
```

`pnpm shots` drives the installed Chrome over the DevTools Protocol — no Playwright, no extra
dependency. It writes the full page and the fold, reports the measured content width and page height
so they can be checked against a prediction made before anyone looked, and **exits non-zero on
horizontal scroll at phone width**. It is deliberately not part of `pnpm verify`: a headless browser
should never stand between a correct change and a push.

Dates are pinned to `Europe/Rome` in `vitest.config.mts` and must be set the same way in production.
Left to the host, a season boundary computed from a UTC midnight lands in the wrong month west of
UTC — a test caught this by failing in `America/New_York` while passing locally.

### Layout

```
src/lib/        pure domain: csv, season, matches, events, streaks, rarity, query, leagues
src/app/        the single route
src/components/ filter bar, table, row detail
scripts/shots/  screenshot + measurement rig
tests/          unit tests, incl. real CSVs in tests/fixtures/
docs/spec.md    what it does and why, with the measurements behind each decision
docs/design/    the screen's design plan
```

## Data

Results and fixtures from [football-data.co.uk](https://football-data.co.uk/), free for personal use.
This project stores none of it; everything is fetched per request and cached for three hours.
