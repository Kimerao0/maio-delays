# Ritardi — screen design plan

Read before any component is written. Task 6, Step 1 of
`docs/superpowers/plans/2026-10-26-ritardi-mvp.md`.

## Subject, audience, job

Italian football betting statistics, read by a WhatsApp group of friends on their phones in the
evening. The job of the screen: **scan a ranked list and find the one streak worth a bet**, in
seconds, without reading every row.

The word *ritardo* is not ours — it is Italian lotto vocabulary. Lotto players have tracked
*numeri ritardatari*, the numbers not drawn for N draws, off published tables for a century. Maio
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

Dark is the default scheme: the audience opens this at night, and the reference is a dark field.
Light is the same grid on paper. Defined as CSS custom properties in `globals.css`, consumed via
Tailwind theme tokens — no bespoke hex inside a component.

| Role | Dark | Light | Job |
|---|---|---|---|
| `--field` | `#15181C` | `#FFFFFF` | the ground |
| `--rule` | `#2A2F36` | `#E4E4E7` | column rules and row separators, hairline only |
| `--figure` | `#F4F4F5` | `#18181B` | the ritardo numeral and team name |
| `--quiet` | `#8A9099` | `#71717A` | event code, league tag, dates, chrome |
| `--tail` | `#F2C14E` | `#A16207` | reserved for the longest streaks on screen |

`--tail` is the teletext yellow, and it is the only colour in the palette. It appears on the
numeral of the top rows and nowhere else — not on buttons, not on the filter bar, not as a border.
One colour, one meaning: *this is the exceptional one*.

No green, no red. A streak is neither good nor bad until Maio decides which side of it to bet.

## Type — one family, two cuts

**Archivo** (Omnibus-Type, Google Fonts) throughout, loaded via `next/font/google` — one family,
one request. **Verified 2026-10-26:** it is a variable font exposing `font-weight: 400 700` and
`font-stretch: 62% 125%`, so the two cuts below are axis positions, not a second download.
("Archivo Expanded" is not a separate Google family; requesting it 404s.)

- **`font-stretch: 125%`, weight 700** — the ritardo numeral only. This is the page-number figure
  from teletext: wide, flat-sided, unmistakable at 390px.
- **`font-stretch: 100%`, weights 400–600** — everything else. Team names at 500, chrome at 400.
- `font-variant-numeric: tabular-nums` on every numeric cell. Non-negotiable: a column of streak
  figures that does not align is a column you cannot scan, which is the entire failure being fixed.

Load as `Archivo({ subsets: ['latin'], axes: ['wdth'] })` so the width axis survives to the browser.

Scale (390px): numeral 28px/1, team 15px/1.2, event code 13px, league tag 11px. The numeral is
roughly twice the team name — in a table row that is an unreasonable size, and that is the point.

Sentence case everywhere. Event labels read as Maio says them: *non pareggia*, *non segna 1°T*.

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
│ ritardi                     agg. 14:32 │  28px  ·  quiet timestamp
│                                        │
│ ┌─ evento ──┐ ┌─ periodo ─┐            │  filter bar, wraps to 2 rows
│ │ tutti   ▾ │ │ 1°T │ 90' │            │  44px touch targets
│ └───────────┘ └───────────┘            │
│ ┌─ dove ────┐ ┌─ leghe ───┐ ┌─ min ─┐  │
│ │ tutte   ▾ │ │ tutte   ▾ │ │   6   │  │
│ └───────────┘ └───────────┘ └───────┘  │
├────────────────────────────────────────┤
│ RIT  SQUADRA        EVENTO        LEGA │  sticky, 11px quiet
├────────────────────────────────────────┤
│  11  Lecce          non pareggia   ITA │  48px row
│  10  Verona         non segna 1°T  ITA │
│   9  Getafe         non pareggia   ESP │
│   8  Le Havre       non segna 1°T  FRA │
│   7  Burnley        non pareggia   ENG │
└────────────────────────────────────────┘
   ^56px      ^flexible       ^86px  ^48px
```

The numeral is the left edge of every row, so the eye runs down one column of figures and stops
where it wants. No horizontal scroll: the event label truncates before the league tag is pushed.

### 1440 / 1920

Same grid, three columns added once there is room — full event label, the date of the last match,
and the next match. The filter bar straightens onto one row. Nothing re-flows into cards.

```
RIT  SQUADRA      EVENTO          PERIODO  LEGA   ULTIMA    PROSSIMA
 11  Lecce        non pareggia    90'      ITA    19/10     Atalanta (c) 26/10
 10  Verona       non segna       1°T      ITA    19/10     Milan (t) 26/10
```

## The memorable element

**The ritardo numeral.** It is sized like a teletext page number inside a table row, set in the one
expanded cut in the whole app, and it is the only thing that ever takes the yellow. Everything
else — filters, headers, tags, dates — is deliberately quiet so that a column of figures is the
first and last thing you see.

## Copy

Italian, sentence case, no filler. `ritardi` as the title, lowercase, because it is a thing not a
brand. The timestamp reads `agg. 14:32`, the way a results page says it.

Empty state: *Nessuna squadra arriva a 6 turni. Abbassa il minimo.* — says what happened and what
to do, in one line, and the number is the one currently in the filter.

Failed league: *Serie B non risponde. Le altre leghe sono aggiornate.* Named, not swallowed.

## Review against the generic defaults

Ran the plan against the list of traits that show up regardless of subject. Three things changed:

1. **Cut the per-row magnitude bar.** The first draft gave each row a hairline rule whose length
   was its streak relative to the longest on screen. In a list already sorted by streak descending,
   position *is* the ranking — the bar restated it and added a second thing to read per row. Chanel's
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
