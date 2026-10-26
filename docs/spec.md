# Ritardi — spec

A web app that answers, on demand: **which teams have not had event X in their last N matches?**,
across the main European leagues, for any of the betting categories on
<https://77wznc-giovanni-roman0.shinyapps.io/statistical_delay/>.

## Why

Maio (the user who asked for this) can already see one team at a time on a friend's Shiny app. He
cannot ask "which teams haven't drawn in 5 rounds?" — the app has no cross-team view beyond a
heatmap he described as _"non si legge un cazzo"_. This app is that cross-team view, made legible.

Maio confirmed the friend's categories are the right ones: _"Le categorie sono quelle del sito del
mio amico. Vanno benissimo."_

## Scope

In: the query surface and the streak maths. Out: accounts, odds, predictions, historical records,
probability of a streak, multi-season carry-over.

## Global constraints

- Next.js App Router, TypeScript, **pnpm**, **Biome** (no ESLint, no Prettier).
- Tailwind + **shadcn/ui, minimal components only**: `select`, `toggle-group`, `badge`, `table`,
  `sheet`. No other UI dependency.
- **Phone first.** Designed at 390px, widened for desktop. No horizontal scroll at 390px.
- **UI copy in Italian.** Code, comments and docs in English.
- No database, no auth, no cron. Public, unlisted URL on Vercel.
- All filter state lives in the URL query string, so a result can be pasted into WhatsApp.

## Data source

`football-data.co.uk`, fetched server-side. **Verified 2026-10-26**, not assumed:

- Results: `https://football-data.co.uk/mmz4281/{season}/{div}.csv` — all 21 divisions below return
  200 for season `2627`. Requests to the `www.` host 302-redirect; use the bare host.
- Fixtures: `https://football-data.co.uk/fixtures.csv`, all divisions in one file.
- Header row starts with a **UTF-8 BOM** (`﻿Div`).
- Date format is **`dd/mm/yyyy`**.
- Columns used: `Div`, `Date`, `Time`, `HomeTeam`, `AwayTeam`, `FTHG`, `FTAG`, `FTR`, `HTHG`,
  `HTAG`, `HTR`. There is **no matchday/round column**.
- Fixtures columns used: `Div`, `Date`, `Time`, `HomeTeam`, `AwayTeam`.
- Team names are **byte-identical** between results and fixtures (checked for I1). No normalisation.
- `fixtures.csv` holds only the **current round** — on 2026-10-26 it spanned 23–26/10 across all
  divisions, and held exactly 10 I1 matches, those spanning 23–25/10. It can contain dates already
  in the past, and a team can be absent.
- All dates are treated in **Europe/Rome**, pinned in the Vitest config and in the Vercel `TZ` env
  var. A calendar-day comparison must mean the same thing in tests, locally and in production.

### Leagues

The 21 divisions present in `fixtures.csv`, with Italian display names and a 3-letter tag for the
phone table:

| Div | Nome               | Tag  |
| --- | ------------------ | ---- |
| I1  | Serie A            | ITA  |
| I2  | Serie B            | ITA2 |
| E0  | Premier League     | ENG  |
| E1  | Championship       | ENG2 |
| E2  | League One         | ENG3 |
| E3  | League Two         | ENG4 |
| EC  | National League    | ENG5 |
| SP1 | Liga               | ESP  |
| SP2 | Liga 2             | ESP2 |
| D1  | Bundesliga         | GER  |
| D2  | 2. Bundesliga      | GER2 |
| F1  | Ligue 1            | FRA  |
| F2  | Ligue 2            | FRA2 |
| N1  | Eredivisie         | NED  |
| B1  | Jupiler Pro League | BEL  |
| P1  | Primeira Liga      | POR  |
| T1  | Süper Lig          | TUR  |
| G1  | Super League       | GRE  |
| SC0 | Premiership        | SCO  |
| SC1 | Championship (SCO) | SCO2 |
| SC2 | League One (SCO)   | SCO3 |

### Season

**Current season only.** Streaks reset in August; this is deliberate. The season code is derived
from the date: month >= 7 → `YY(YY+1)`, else `(YY-1)YY`. October 2026 → `2627`.

## Domain

### Match

One row of a results CSV with both full-time goals present. A row with an empty `FTHG` or `FTAG`
is **not a match** and is dropped (postponed or not yet played).

### Event

An event either **occurred** or **did not occur** in a match, from one team's point of view. The 12
events, in UI order:

| Id         | Etichetta     | Codice    | Occurs when           |
| ---------- | ------------- | --------- | --------------------- |
| `win`      | non vince     | `no V`    | the team won          |
| `draw`     | non pareggia  | `no X`    | the match was drawn   |
| `loss`     | non perde     | `no S`    | the team lost         |
| `scores`   | non segna     | `no GF`   | the team scored ≥ 1   |
| `concedes` | non subisce   | `no GS`   | the team conceded ≥ 1 |
| `btts`     | no goal       | `no GG`   | both teams scored     |
| `over05`   | non over 0.5  | `no O0.5` | total goals > 0.5     |
| `over15`   | non over 1.5  | `no O1.5` | total goals > 1.5     |
| `over25`   | non over 2.5  | `no O2.5` | total goals > 2.5     |
| `under05`  | non under 0.5 | `no U0.5` | total goals < 0.5     |
| `under15`  | non under 1.5 | `no U1.5` | total goals < 1.5     |
| `under25`  | non under 2.5 | `no U2.5` | total goals < 2.5     |

Both directions of each pair are present on purpose: the _ritardo_ of `concedes` is a clean-sheet
run, and the _ritardo_ of `under25` is a run of overs. No separate "clean sheet" event is needed.

### Period

`ft` (full time, `FTHG`/`FTAG`) or `ht` (first half, `HTHG`/`HTAG`). Every event works in both
periods, including the result events, which are derived from the period's goals rather than from
`FTR`/`HTR`.

### Venue

`home`, `away` or `all`. With `home`, only the team's home matches are counted, consecutively
among themselves — the away matches in between are skipped, not treated as breaks.

### Ritardo (streak)

Walk the team's matches, newest first, within the chosen venue. The _ritardo_ is how many
consecutive matches the event did not occur in. If it occurred in the newest match, the ritardo is
0. A team with no matches has no row.

## The surface

**One screen.** Filters on top, one dense table below.

### Filters

- **Evento** — `tutti` (default) or one of the 12.
- **Periodo** — `ft` (default) / `ht`.
- **Dove** — `tutte` (default) / `casa` / `trasferta`.
- **Leghe** — multi-select, `tutte` by default.
- **Ritardo minimo** — number, **default 6**.

### Table

One row per (team, event) with ritardo ≥ N, all events mixed, **sorted by rarity descending**, so
row 1 is the most exceptional thing in Europe whatever event it is. Every column is sortable.

### Why rarity and not streak length

Raw streak length was the original decision and was **measured against the live CSVs on 2026-10-26**
before the screen was finished. Across 8 leagues at min 6 it returned 210 rows, of which:

- **106 were `no U0.5`** and 46 `no U1.5` — 72% of the list. A 0-0 happens in 5% of matches, so
  virtually every team has a long run without one. The least informative event crowded out the rest.
- The **top was a tie at the season ceiling**: the longest streak was 9 everywhere, because only
  6–9 rounds had been played, so the league-name tie-break handed page one to whichever league was
  furthest into its season.
- `no GF`, `no GS`, `no GG` and `no O2.5` returned **zero** rows — those events occur in 60–95% of
  matches, so their runs break constantly. Maio's own example (_non segnano nel primo tempo in casa
  da 6 turni_) lives in that group.

Rarity is `(1 - p)^streak`, where `p` is the event's base rate **computed from this season's own
matches**, over the same period and venue the query asks for. It is reported as `1 su N`. Brighton
going 4 matches without conceding (`p = 0.77`) therefore outranks Ajax going 9 without a 0-0.

The base rate uses **Laplace smoothing**, `(hits + 1) / (pairs + 2)`: the raw fraction can be exactly
0 or 1 on a short early-season sample, and a rate of 1 makes every rarity 0 and every `1 su` value
infinite.

This treats matches as independent, which they are not — team quality is exactly why a streak
persists. It is a ranking heuristic, not a probability, and the UI must not present it as odds.

At 390px: four compact columns, 44px rows, no horizontal scroll. The fourth column is `1 SU`;
`LEGA` returns on wider viewports.

```
RIT  SQUADRA     EVENTO     LEGA
 11  Lecce       no X       ITA
 10  Verona      no GF 1T   ITA
  9  Getafe      no X       ESP
  8  Le Havre    no GF 1T   FRA
  7  Burnley     no X       ENG
```

Wider viewports add the full event label, the league, the date of the last match and the next match.

The screen is in Next's Cache Components mode (`cacheComponents: true`, the scaffold's own default),
so the title and the filter bar render from the prerendered shell and the table streams in behind a
`<Suspense>` boundary whose fallback is a skeleton at the real 44px row height. Uncached data
accessed outside a boundary fails the build outright in this mode.

### Row detail

Tapping a row opens a sheet with: the next match (opponent, date, home or away) and the matches
that make up the ritardo, newest first, each with its score.

When a team has no upcoming fixture in `fixtures.csv`, the next match reads `—`. Fixtures dated
before today are not shown as upcoming.

### Freshness

The CSVs are fetched with `{ cache: 'force-cache', next: { revalidate: 10800 } }` — 3 hours.
**Verified against Next 16.4.3's own docs:** caching is opt-in, so `force-cache` is what enters
the cache at all and `revalidate` only sets the lifetime. The page reads `searchParams`, a
request-time API, so without `force-cache` every visitor re-downloads all 21 CSVs. The screen states when the data was
fetched. If one league's CSV fails, the other leagues still answer and the failed league is named.
