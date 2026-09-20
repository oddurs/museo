# Museo — Design System

A typographic exhibition set in Whitney. Warm paper, a twelve-step neutral ramp,
and one primary color. Light mode only.

The system lives in three files, loaded in this order:

| File | Holds |
| --- | --- |
| `web/fonts.css` | `@font-face` rules — generated, never edited by hand |
| `web/system.css` | Tokens, reset, type primitives, elements |
| `web/components.css` | Composite pieces shared by the app and the specimen |

`web/app.css` sits on top and does composition only. **A raw number or color in
`app.css` is a bug in the system, not a shortcut in the page.**

The living specimen is at **`/web/design/`**. It is rendered from the system's
own custom properties and measured in the browser — the contrast ratios there
are computed, not transcribed — so it cannot drift out of sync with the tokens.

---

## Principles

**1. Systems before screens.** The ramp, the scale and the figure sets were
settled and measured before any component was composed.

**2. One color, and it must earn its place.** Cinnabar marks the exhibition bar,
the current selection, the pins and focus — the things you act on. It is never
decoration, and there is never a second accent.

**3. Twelve grays, because detail needs range.** Hairlines, marks and text each
get their own steps. Borrowing one value for two jobs is what makes an interface
look approximate.

**4. Set the type, don't just style it.** True small caps, old-style figures in
prose, lining tabular figures in columns, the real ordinal glyph.

**5. Rules and whitespace instead of boxes.** No radius, no shadow, no gradient.
Nothing moves on selection — weight and color carry it.

---

## The neutral ramp

Warm, not gray: every step holds the same red-over-blue bias as the paper, so
nothing reads as cold against it. Ratios are against `--paper`.

| Token | Value | Ratio | Role |
| --- | --- | --- | --- |
| `--gray-000` | `#fbf9f5` | 1.00 | Paper |
| `--gray-050` | `#f5f2eb` | 1.06 | Sunk — hover beds |
| `--gray-100` | `#ede8df` | 1.16 | Wash — inset panels |
| `--gray-150` | `#e3dcd0` | 1.30 | Hairline, light |
| `--gray-200` | `#d6cebf` | 1.49 | Hairline, standard |
| `--gray-300` | `#bcb2a0` | 1.99 | Hairline, strong |
| `--gray-400` | `#9e9482` | 2.85 | Boundary — draw only |
| `--gray-500` | `#7b7260` | 4.52 | Metadata — **lightest text allowed** |
| `--gray-600` | `#645c4c` | 6.29 | Supporting text |
| `--gray-700` | `#4a4335` | 9.31 | Secondary text |
| `--gray-800` | `#312c22` | 13.19 | Strong text |
| `--gray-900` | `#1c1810` | 16.82 | Ink — primary text, edges |

The 4.5:1 line falls between 400 and 500, and it is a hard floor. `--gray-500`
was originally `#7e7563` at 4.33:1 — close enough to look fine and not close
enough to pass, so it was darkened by three values until it did.

`--gray-400` has no semantic alias. It is the last step before text becomes
legal, kept in the ramp as the boundary marker; an alias naming a role that no
component plays is noise.

Components reference the **semantic aliases** (`--ink`, `--ink-secondary`,
`--rule`, `--paper-sunk` …), never the ramp directly, so the ramp can be retuned
in one place.

---

## The primary — cinnabar

| Token | Value | Ratio | Use |
| --- | --- | --- | --- |
| `--primary` | `#c0361b` | 5.28 | The bar, selection, pins, focus |
| `--primary-deep` | `#8e2812` | 8.11 | Hover, and the primary as small text |
| `--primary-line` | `#e7c6b9` | 1.52 | Keylines, link underlines |
| `--primary-wash` | `#f7eae4` | 1.12 | The selected row's bed |

Chosen from twelve candidates by contrast: it is the warmest red that still
clears 4.5:1 on this paper and so may carry text, not only marks.

---

## Type

Three cuts of one family. The choice between them is a **size threshold, not a
preference**.

| Token | Family | Used for |
| --- | --- | --- |
| `--font-display` | Whitney | 16px and up |
| `--font-text` | Whitney ScreenSmart | Below 16px, and all small caps |
| `--font-figure` | Whitney Condensed | Numeric columns |

### Figure sets

Whitney carries four, and using the right one is most of what separates set type
from typed text.

| Token | Features | Where |
| --- | --- | --- |
| `--figures-text` | `onum`, `pnum` | Running text and addresses — figures sit *in* the line |
| `--figures-tabular` | `lnum`, `tnum` | Columns and counts — equal width, so nothing shifts |
| `--figures-superior` | `sups` | Ordinals and footnote marks |

`sups` in Whitney maps **the ten digits and nothing else** — it does not
substitute letters. The numero sign is therefore the real `ordmasculine` glyph
(`º`, U+00BA), typed as a character rather than faked by raising an `o`. An
earlier version raised an `o` and rendered a plain "No".

Small caps are **true small caps** (`smcp` / `c2sc`), not uppercase at a smaller
size — which would be heavier than the text beside it and sit wrong on the line.

### Scale

Eight sizes, spaced by eye rather than by ratio.

| Primitive | Size | Weight | Family |
| --- | --- | --- | --- |
| `.t-banner` | 72px | 300 | Whitney |
| `.t-display` | 48px | 300 | Whitney |
| `.t-title` | 30px | 300 | Whitney |
| `.t-heading` | 21px | 400 | Whitney |
| `.t-body` | 15px | 400 | ScreenSmart |
| `.t-small` | 13px | 400 | ScreenSmart |
| `.t-fine` | 12px | 500 | ScreenSmart |
| `.t-label` | 11px | 600 | ScreenSmart, true small caps |

A strict modular scale put a museum's name and its address too close together.
The interval from `--size-heading` to `--size-small` is deliberately wider than
a ratio would give, and it is the most important one in the system.

`.t-heading` is Book rather than Light on purpose: at 21px Light begins to break
up against paper, and museum names are the one thing here people actually read.

Each primitive sets family, size, weight, leading, tracking **and figure set**
together. Compose with them; don't set font properties by hand.

---

## Space

A 4px base: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`. These are the only
spacing values in the system, and `npm run audit` fails the build if a raw one
appears in a composition layer.

### One gutter

Every region shares a single left edge — `--gutter`. The index's rows carry a
2px selection marker on their left border, so they and their column heads
**absorb it into their padding**:

```css
padding-left: calc(var(--gutter) - var(--stroke-marker));
```

Without that, the marker pushes the whole column 2px right and every row sits
off the header it belongs to. That was the defect this rule exists to prevent,
and the audit now asserts the two stay in step at every breakpoint.

### Region padding

Vertical padding descends with the weight of the region:

| Region | Padding | Why |
| --- | --- | --- |
| `.masthead` | 32 / 24 | Top is heavier to clear the exhibition bar above it |
| `.search-bar` | 24 / 0 | The field supplies its own 8px baseline padding |
| `.filters` | 24 / 24 | Symmetric — the toggles carry their own 4px and 2px marker |
| `.index__head` | 12 | A label strip, not a region |
| `.entry` | 16 | Optical gaps land at 21.7px above the name, 20.1px below the link |

The entry's figures come from Whitney's own metrics rather than from eyeballing:
at 21px on a 1.2 line the name's box-top sits 5.67px above its cap, and the
link's baseline sits 4.08px above its box-bottom. Equal 16px padding therefore
reads as balanced even though the numbers differ.

---

## Strokes & the border ladder

Borders run on their own scale, not the spacing scale:

| Token | Width | Use |
| --- | --- | --- |
| `--stroke-hairline` | 1px | Every rule and edge |
| `--stroke-marker` | 2px | Selection markers, toggle underlines |
| `--stroke-keyline` | 3px | The exhibition bar |

Weight tracks **structural significance**, so the hierarchy of the page can be
read from the rules alone. Pick by what the rule separates, never by how it
looks in isolation:

| Token | Value | Separates |
| --- | --- | --- |
| `--edge` | gray-900 | Outermost structural divisions — masthead from body, index from map. The only rule set in ink. |
| `--hairline-strong` | gray-300 | Regions inside a pane — the filter bar, the index's column heads, a field's baseline |
| `--hairline` | gray-200 | Boundaries inside a single component — a popup's foot, a specimen frame |
| `--hairline-light` | gray-150 | Repeating separators in a list — one per entry, where a heavier value would stripe the column |

The filter bar was originally `--hairline`, making it *lighter* than the column
heads inside the pane below it and inverting the hierarchy. It is
`--hairline-strong` now.

---

## Elements

**Toggle** — the only interactive control. States selection with a 2px rule in
the primary, never a fill and never a pill. `Reset` is an action rather than a
selection, so it never takes the rule.

**Field** — an input reduced to a baseline; the rule goes primary on focus.

**Link** — the underline carries the color, the word stays in ink.

**Mark** — search hits take a primary underline, not a highlighter.

**Focus** — 2px solid primary, 3px offset, square. Always visible.

---

## The index entry

The application's one composite component, in `components.css`. A catalogue row,
not a card.

```
001   The Metropolitan Museum of Art          MANHATTAN
      Upper East Side · 1000 Fifth Avenue           ART
      metmuseum.org ↗
```

Three columns — figure, subject, classification — on a shared **first baseline**,
so the numeral and the borough sit on the museum's own line. That is
`align-items: baseline` doing the work, not padding nudges.

Case does the sorting: everything categorical is small caps, everything read is
mixed case. That split is what lets the eye skip the labels when scanning names
and find them instantly when scanning for a borough.

Selected: a primary rule at the left edge, a warm bed, the figure going to the
primary, and the name stepping from Book to Medium. Nothing moves.

---

## The map

The basemap is desaturated *and warmed to the paper's temperature*
(`grayscale(1) sepia(0.32) saturate(0.55)`), so it reads as part of the system
rather than a window cut through it. Leaflet's own link color is overridden —
nothing in the interface carries a stray hue.

Pins are the primary: 107 cinnabar dots on warm gray. The selected pin takes an
ink fill with a wide, low-opacity primary halo.

The cost is worth naming: **boroughs are not color-coded.** One primary means
one hue, so the filters and the index carry that distinction instead — which is
what a map is for.

---

## Adding to the system

1. Check whether a primitive already covers it. Most things need a `.t-*` class
   and a space token, nothing more.
2. New values go in `system.css` §1 as tokens, with a comment explaining the
   *constraint they encode*, not just what they are.
3. Anything composite and reusable goes in `components.css`, so the specimen can
   render it.
4. Add it to `/web/design/` in the same commit. A component that isn't in the
   specimen will drift.

**The audit.** `npm run audit` is a static linter over the composition layers.
It fails on a raw color, a spacing value off the 4px scale, a border width off
the stroke scale, an unknown token, or any divergence between `.entry` and
`.index__head` — comparing their *effective* column shape at every breakpoint,
with the cascade applied in load order. A line may opt out with a trailing
`/* system-exempt: reason */`, and the report lists every exemption.

**Setting OpenType features from JavaScript:** assign them as style *properties*,
never by interpolating into a `style="..."` attribute. A value like `"smcp" 1`
contains double quotes that terminate the attribute and silently drop the
declaration — which is exactly how four of the five specimens in §05 shipped
broken before they were measured.

## Rebuilding the fonts

Whitney is licensed from Hoefler & Co. The source OTFs live outside this repo and
the generated `.woff2` files are gitignored.

```
npm run fonts                          # reads ~/Fonts/Master Library
python3 scripts/build-fonts.py --src "/some/other/folder"
```

Eleven faces — 259 KB, subset to Latin plus punctuation and arrows, retaining
`smcp`, `c2sc`, `onum`, `lnum`, `pnum`, `tnum`, `sups`, `frac` and friends.
Retaining a feature also retains the glyphs it reaches, which is how the
small-cap alphabet survives subsetting. The script regenerates `web/fonts.css`;
don't edit that file.
