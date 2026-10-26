# Ritardi — screen design plan

Read before any component is written. Task 6, Step 1 of
`docs/superpowers/plans/2026-10-26-ritardi-mvp.md`.

## Subject, audience, job

Italian football betting statistics, read by a WhatsApp group of friends on their phones in the
evening. The job of the screen: **scan a ranked list and find the one streak worth a bet**, in
seconds, without reading every row.

The word _ritardo_ is not ours — it is Italian lotto vocabulary. Lotto players have tracked
_numeri ritardatari_, the numbers not drawn for N draws, off published tables for a century. Maio
already has that mental model; the screen should look like the table he expects, not like a
dashboard.

## Direction: Televideo 201

The reference is **Televideo page 201** — the RAI teletext results page every Italian checked on a
Sunday evening. Dark field, rigid numeric columns, figures large enough to read across a room, no
decoration whatsoever. It is the most legible football-results surface ever shipped in Italy, and
it got there by being a grid of numbers on a dark ground.

That is also the argument against the app this replaces. A heatmap encodes magnitude by painting
the cell the text sits in, so it trades the thing you came for — reading the value — for a
gradient you then have to decode. We keep the magnitude cue and move it off the background
entirely: **size and weight carry it, never a fill behind text.**

## Color — 5 roles

**Neither scheme is the default** (owner's call, 2026-10-26): the screen follows
`prefers-color-scheme`, and both are tuned as primary — neither is a port of the other. Defined as
CSS custom properties in `globals.css`, consumed via Tailwind theme tokens — no bespoke hex inside
a component.

| Role       | Dark      | Light     | Job                                            |
| ---------- | --------- | --------- | ---------------------------------------------- |
| `--field`  | `#15181C` | `#FFFFFF` | the ground                                     |
| `--rule`   | `#2A2F36` | `#E4E4E7` | column rules and row separators, hairline only |
| `--figure` | `#F4F4F5` | `#18181B` | the ritardo numeral and team name              |
| `--quiet`  | `#8A9099` | `#71717A` | event code, league tag, dates, chrome          |
| `--tail`   | `#F2C14E` | `#A16207` | reserved for the longest streaks on screen     |

`--tail` is the teletext yellow, and it is the only colour in the palette. It appears on the
numeral of the top rows and nowhere else — not on buttons, not on the filter bar, not as a border.
One colour, one meaning: _this is the exceptional one_.

No green, no red. A streak is neither good nor bad until Maio decides which side of it to bet.

## Type — one family

**Archivo** (Omnibus-Type, Google Fonts) throughout, loaded via `next/font/google` — one family,
one request, weights 400–700. The width axis is **not** loaded: the oversized expanded numeral was
cut (see below), so nothing needs it.

- **700** — the ritardo figure and nothing else.
- **500** — team names. **400** — event code, league tag, dates, chrome.
- `font-variant-numeric: tabular-nums` on every numeric cell. Non-negotiable, and now load-bearing:
  with the figure at text size, **alignment is the only thing left encoding magnitude down the
  column.** A column of streak figures that does not align is a column you cannot scan, which is
  the entire failure being fixed.

Scale (390px): figure 15px/1 at weight 700, team 15px/1.2 at 500, event code 13px, league tag 11px.

Sentence case everywhere. On the phone the event column uses the betting shorthand Maio already
reads — `no X`, `no GF 1T`, `no O2.5` — which also never truncates. Desktop spells them out.

## Layout

One column, no shell, no sidebar. The filter bar sits directly above the table and scrolls away;
the table header sticks.

Content width is `min(100% - 2rem, 84rem)` — 358px at 390, 1344px at both 1440 (93%) and 1920
(70%). The table is the page; there is nothing to put beside it, and nothing worth leaving empty.

Alignment: the ritardo column is right-aligned against the rule, everything else left. Numbers
align on their units digit or they do not align at all.

### 390px

```
┌────────────────────────────────────────┐  16px gutters, 358px content
│ ritardi                     agg. 15:05 │  28px  ·  download time, not
│ Squadre che non registrano un evento   │  render time
│ da almeno 6 turni, ordinate dalle      │  13px quiet, wraps to 2
│ piu rare.                              │  lines at 390 (+43px)
│                                        │
│ ┌─ evento ──┐ ┌─ periodo ─┐            │  filter bar, wraps to 2 rows
│ │ tutti   ▾ │ │ 1°T │ 90' │            │  44px touch targets
│ └───────────┘ └───────────┘            │
│ ┌─ dove ────┐ ┌─ leghe ───┐ ┌─ min ─┐  │
│ │ tutte   ▾ │ │ tutte   ▾ │ │   6   │  │
│ └───────────┘ └───────────┘ └───────┘  │
├────────────────────────────────────────┤
│ DA  SQUADRA      EVENTO   LEGA  1 SU │  sticky, 11px quiet
├────────────────────────────────────────┤
│ 11  Lecce        no X     ITA   174 │  44px row
│  10  Verona         non segna 1°T  ITA │
│   9  Getafe         non pareggia   ESP │
│   8  Le Havre       non segna 1°T  FRA │
│   7  Burnley        non pareggia   ENG │
└────────────────────────────────────────┘
   ^56px      ^flexible       ^86px  ^48px
```

The figure is the left edge of every row, right-aligned on its units digit, so the eye runs down
one column and stops where it wants. Rows are 44px — the touch-target floor, since a row opens the
detail sheet. No horizontal scroll: the event code is chosen so nothing truncates at 390px.

### 1440 / 1920

Same grid, three columns added once there is room — full event label, the date of the last match,
and the next match. The filter bar straightens onto one row. Nothing re-flows into cards.

```
RIT  SQUADRA      EVENTO          PERIODO  LEGA   ULTIMA    PROSSIMA
 11  Lecce        non pareggia    90'      ITA    19/10     Atalanta (c) 26/10
 10  Verona       non segna       1°T      ITA    19/10     Milan (t) 26/10
```

## The memorable element

The oversized teletext numeral was **cut by the owner in favour of density** — roughly 16 rows per
phone screen instead of 10. That was the plan's hero, so something has to carry its job.

What carries it now: **one yellow figure in an otherwise colourless grid.** With size no longer
encoding magnitude, `--tail` stops being a flourish and becomes the only magnitude cue on the
screen, so it is applied strictly — the figure alone, on the rows in the top decile of the visible
streaks, never the row, never a fill, never anything else in the app. A screen of grey figures with
two yellow ones tells you where to look before you have read a single word.

The discipline that makes it work is the grid itself: tabular figures, a right-aligned numeric
column, hairline rules, and nothing competing for attention. Lean is the identity.

## Copy

Italian, sentence case, no filler. `ritardi` as the title, lowercase, because it is a thing not a
brand.

Under the title, one line that makes the screen self-explanatory — added after a UX review found
that nothing on screen explained `DA`, `1 SU`, or why the order was what it was (the DA column reads
7, 10, 10, 9, 8, 13, which looks broken until you know the sort is by rarity):

> Squadre che non registrano un evento da almeno {min} turni, ordinate dalle piu rare.

One line, with the live `min` in it. **No tooltip, no `?` icon, no accordion** — a help affordance
is a confession that the headers failed, and the identity here is a quiet grid. The word _rare_
carries the meaning of `1 SU`, which otherwise reads as betting odds; `docs/spec.md` forbids the UI
from implying odds.

The timestamp reads `agg. 15:05`, the way a results page says it, and it is **the moment the CSVs
were downloaded, not the moment the page rendered** — taken from the cached response's `date` header,
earliest across the bodies. A stamp that always showed the current minute on three-hour-old data was
the first thing that review caught. `agg. --:--` when nothing was fetched.

Empty state: _Nessuna squadra arriva a 6 turni. Abbassa il minimo._ — says what happened and what to
do, in one line, with the number currently in the filter.

Failed league: _Serie B non risponde. Le altre leghe sono aggiornate._ Named, not swallowed. Several:
_Serie B, Liga non rispondono._ The calendar separately: _Il calendario non risponde._

Total outage, when **every** selected league failed: _Dati non disponibili. Riprova tra qualche
minuto._ — and the `min` advice is suppressed, because blaming the user's filter for an outage sends
them to fix the wrong thing. This replaces the per-league notices rather than adding to them.

## Review against the generic defaults

Ran the plan against the list of traits that show up regardless of subject. Three things changed:

0. **Cut the oversized numeral** (owner, after reading the options). It was the plan's memorable
   element; density won. `--tail` inherits its job, which is why the accent rule above is stricter
   than it was.
1. **Cut the per-row magnitude bar.** The first draft gave each row a hairline rule whose length
   was its streak relative to the longest on screen. In a list already sorted by streak descending,
   position _is_ the ranking — the bar restated it and added a second thing to read per row. Chanel's
   mirror: removed.
2. **Rejected the cream-and-terracotta ground** this brief would otherwise have landed on, and the
   near-black-plus-acid-green alternative. The dark field here is argued from Televideo and from
   when the thing is actually opened, and the single accent is teletext yellow, which neither
   default reaches for.
3. **Dropped the all-caps eyebrow and the middle-dot meta string.** The header was going to read
   `STATISTICHE · SERIE A · AGGIORNATO 14:32`. It is now one lowercase word and a timestamp.

Kept deliberately, against the grain of the guidance: **tabular figures**. A monospace-ish face for
small data is listed as a tell, but this is a table whose only job is comparing numbers down a
column. Tabular numerals are a functional requirement here, not a texture — and they are applied to
the figures alone, not to labels or chrome.

## Quality floor

Keyboard focus visible on every control and every sortable header. `prefers-reduced-motion`
respected — the only motion is the sheet opening. Filters acknowledge within the same frame with a
pending state; a filter that looks inert until the server answers is the failure mode to avoid.
Contrast checked in both schemes, including `--quiet` on `--field`.
