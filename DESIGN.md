# Museo — Design System

Light mode only. Black, white and four grays. Set entirely in Whitney.

The system lives in three files, loaded in this order:

| File | Holds |
| --- | --- |
| `web/fonts.css` | `@font-face` rules — generated, never edited by hand |
| `web/system.css` | Tokens, reset, type primitives, elements |
| `web/components.css` | Composite pieces shared by the app and the specimen |

`web/app.css` sits on top and does composition only. **If a raw number or color
appears in `app.css`, that's a bug in the system, not a shortcut.**

A living specimen of everything below renders at **`/web/design/`**. It is built
from the system's own custom properties — contrast ratios are computed at runtime,
not typed in — so it cannot drift out of sync with `system.css`.

---

## Principles

**1. Achromatic without exception.** Color is never used to encode meaning, so
nothing in the interface depends on it. This extends to the map: OpenStreetMap
tiles are desaturated and flattened in CSS so the basemap joins the system rather
than fighting it, and Leaflet's own link color is overridden.

The cost is real and worth naming: boroughs can't be color-coded on the map. They
are distinguished instead by the filters, by the index, and by position — which is
what a map is for. All 107 pins are identical black dots.

**2. Type carries the hierarchy.** Size, weight and case do the work that color,
fills and shadows do elsewhere. Whitney was drawn by Tobias Frere-Jones for the
Whitney Museum's wayfinding; it is used here the way signage uses it.

**3. Rules and whitespace instead of boxes.** No border radius, no shadow, no
gradient. Structure is drawn with hairlines and the space between things.

**4. Nothing moves that doesn't have to.** Transitions are 120ms and linear,
limited to color and background. Selection adds weight; it never shifts position.

---

## Color

Seven values. The ratio is against `--paper`.

| Token | Value | Ratio | Use |
| --- | --- | --- | --- |
| `--paper` | `#ffffff` | — | Every background |
| `--paper-sunk` | `#f7f7f7` | 1.0 | Hover beds, insets |
| `--ink` | `#000000` | 21.0 | Primary text, structural edges |
| `--ink-secondary` | `#4d4d4d` | 8.6 | Supporting text |
| `--ink-tertiary` | `#767676` | 4.5 | Metadata, labels — the lightest text allowed |
| `--ink-quiet` | `#b4b4b4` | 2.1 | Borders and marks — **never text** |
| `--rule` | `#e4e4e4` | — | Hairline separators |

The 4.5:1 floor is a hard rule. It cost a revision: numerals, disciplines, filter
tallies and group names were all originally set in `--ink-quiet`, which reads as
elegant restraint and fails WCAG AA. They are `--ink-tertiary` now.

---

## Type

Three cuts of one family. The choice between them is a **size threshold, not a
preference**.

| Token | Family | Used for |
| --- | --- | --- |
| `--font-display` | Whitney | Anything 16px and up |
| `--font-text` | Whitney ScreenSmart | Anything below 16px |
| `--font-label` | Whitney Condensed | Uppercase labels only |

ScreenSmart's wider apertures and looser spacing hold up at small sizes where the
display cut closes in on itself. Condensed is never set lowercase and never runs
longer than three words.

### Scale

Seven sizes, spaced by eye rather than by ratio. A strict modular scale put a
museum's name and its address too close together to tell apart at a glance; the
gap from `--size-heading` (21px) to `--size-small` (13px) is deliberately wider
than a ratio would give, and it is the most important interval in the system.

| Primitive | Size | Weight | Family |
| --- | --- | --- | --- |
| `.t-display` | 56px | 300 Light | Whitney |
| `.t-title` | 32px | 300 Light | Whitney |
| `.t-heading` | 21px | 400 Book | Whitney |
| `.t-body` | 15px | 400 | ScreenSmart |
| `.t-small` | 13px | 400 | ScreenSmart |
| `.t-fine` | 12px | 500 | ScreenSmart |
| `.t-label` | 10.5px | 600 | Condensed, uppercase, `0.14em` |

`.t-heading` is Book rather than Light on purpose: at 21px Light begins to break
up against white, and museum names are the one thing here people actually read.

Each primitive sets family, size, weight, leading **and** tracking together.
Compose with them; don't set font properties by hand.

### Tracking

Whitney is a signage face — it tightens well at display sizes and needs the
opposite treatment in small caps, where counters must stay open.
Display `-0.03em` · heading `-0.018em` · labels `0.14em` · wordmark `0.16em`.

---

## Space

A 4px base. These eight steps are the only spacing values in the system:
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

---

## Elements

**Toggle** — the only interactive control. States selection with a 2px rule
beneath it, never a fill and never a pill. Counts ride alongside in a lighter
value. `Reset` is an action rather than a selection, so it never takes the rule.

**Field** — an input reduced to a baseline. 24px Whitney Light; the rule goes
black on focus.

**Link** — underlines on hover only, so a list of 107 stays calm.

**Mark** — search hits take an underline (`inset` box-shadow), not a highlighter.

**Focus** — 2px solid black, 3px offset, square. Always visible.

---

## The index entry

The application's one composite component, in `components.css`. A catalogue row,
not a card.

```
001   The Metropolitan Museum of Art          MANHATTAN
      Upper East Side · 1000 Fifth Avenue           ART
      metmuseum.org ↗
```

Three columns — number, subject, classification — on a shared **first baseline**,
so the numeral and the borough sit on the name's line. That's CSS
`align-items: baseline` doing the work, not padding nudges.

Everything categorical is uppercase Condensed; everything read is mixed case.
That split is what lets the eye skip the labels when scanning names, and find
them instantly when scanning for a borough.

Selected state: a black bar at the left edge, a sunk background, and the name
stepping from Book to Medium. Nothing moves.

---

## Adding to the system

1. Check whether a primitive already covers it. Most things need a `.t-*` class
   and a space token, nothing more.
2. New values go in `system.css` §1 as tokens, with a comment explaining the
   constraint they encode — not just what they are.
3. Anything composite and reusable goes in `components.css` so the specimen can
   render it.
4. Add it to `/web/design/` in the same commit. A component that isn't in the
   specimen will drift.

## Rebuilding the fonts

Whitney is licensed from Hoefler & Co. The source OTFs live outside this repo and
the generated `.woff2` files are gitignored.

```
npm run fonts                          # reads ~/Fonts/Master Library
python3 scripts/build-fonts.py --src "/some/other/folder"
```

Eleven faces, subset to Latin plus punctuation and arrows — 186 KB total. The
script regenerates `web/fonts.css`; don't edit that file.
