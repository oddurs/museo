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

## Identity

The identity is typographic, so the mark is not drawn — it is Whitney's own
**M**, lifted out of the font file by `scripts/build-mark.py` and written as an
SVG path. Change the weight or the letter there and the mark follows the type,
because it is the same outline the wordmark is set in.

| Piece | What it is | Where it goes |
| --- | --- | --- |
| **Mark** | Whitney Semibold `M`, paper on cinnabar, cap on an optical centre | Browser tab, app icon, the colophon. 16px minimum |
| **Wordmark** | Whitney Light, uppercase, `--track-wordmark` (0.17em) | The masthead |
| **Wordmark, imprint** | The same, at body size and `--track-imprint` (0.22em) | The colophon |
| **Keyline** | 3px cinnabar across the full width | The top of every page |
| **Deck** | One line saying what this is | Under the wordmark |

The wordmark is tracked **wider as it gets smaller** — the setting opens up
rather than holding one value, which is why there are two tokens rather than
one. Both are `text-transform: uppercase` on mixed-case source, so the word
stays "Museo" to a screen reader and to anyone copying it.

Clear space is the wordmark's own cap height on every side. Minimum mark size
is 16px, which is where Semibold's counters still hold.

**Not this:** the wordmark in another face or another weight; tracking set by
eye instead of from the tokens; the mark and wordmark locked up together (they
do separate jobs — the mark is for a tab, the wordmark for a page); a second
color, since cinnabar *is* the identity and anything else is decoration.

### The colophon

The index is a publication, so it ends the way one does — mark, wordmark, what
it is set in, and where. It lives at the foot of the scroll region, so reaching
the end of the index reaches the end of the publication.

### The tab

`document.title` carries the current view: `Queens — Museo`, `“noguchi” ·
Queens — Museo`. With state in the URL, a filtered view is a different page and
its tab says so.

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

`c2sc` folds capitals into small caps on its own, so `.t-label` needs **no
`text-transform`**. It carried `text-transform: lowercase` for a while; measured
against the same string without it, the rendered width was identical to the
hundredth of a pixel. All the transform did was mangle the source casing and
force an exception for `Nº`, which is why both are gone.

**`font-variant-numeric` does not work in this codebase.** `body` sets
`font-feature-settings`, the low-level property wins wherever both apply, and it
inherits — so a `font-variant-numeric: tabular-nums` on a descendant is inert.
Measured three ways, the same string came out at three different widths. Every
figure set therefore goes through `font-feature-settings` and the `--figures-*`
tokens, consistently.

### Tracking

Whitney is a signage face: it tightens at display sizes and needs the opposite
treatment in small caps, where the counters must stay open.

| Token | Value | Applied to |
| --- | --- | --- |
| `--track-banner` | `-0.035em` | The tally figure at 72px |
| `--track-display` | `-0.028em` | Display and title sizes |
| `--track-heading` | `-0.018em` | Museum names, the search field |
| `--track-normal` | `0` | All running text |
| `--track-smallcap` | `0.09em` | Small-cap labels |
| `--track-wordmark` | `0.17em` | The wordmark only, which absorbs the trailing track with a negative margin |

### Fallbacks that don't reflow

Each stack names a metric-matched fallback ahead of the system faces.
`build-fonts.py` reads each cut's real metrics and emits an `@font-face` that
overrides a local Helvetica/Arial to carry them — `size-adjust` to match
Whitney's x-height, then `ascent-override` and `descent-override` restated
relative to that scale so the line box is identical either way.

Rendering the app with the webfonts blocked and again with them loaded gives
the same height for every region and the same top for the index, to 0.0px. The
swap costs no layout shift.

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

Weight tracks **structural significance** — but it is scaled by *length*, not
only by what the rule separates. A 1px rule at 16.8:1 is a slab when it runs
1600px, whatever it divides. Measured, the page was **33% furniture** above the
first museum, with three full-width rules stacked inside 150px and the heaviest
element on the screen being a black line that divided nothing anyone was
reading.

So the rule is: **nothing full-width is set in ink.** Division at that scale
comes from space and from the page's own structure. Ink is for short runs.

| Token | Value | Separates |
| --- | --- | --- |
| `--edge` | gray-900 | Short runs that need a hard boundary — a popup, a framed specimen. Never across a pane. |
| `--hairline-strong` | gray-300 | The page's real divisions — the filter bar, the index-to-map seam, the colophon |
| `--hairline` | gray-200 | A control's own affordance, or a boundary inside one component — the field's baseline, a popup's foot |
| `--hairline-light` | gray-150 | Repeating separators in a list — one per entry, where a heavier value would stripe the column |

After the pass: **25% chrome, two full-width rules, none in ink.** The masthead
lost its closing rule entirely — it and the controls are one header, divided
from the index by a single line — and the index's column heads float on space
instead of sitting in a ruled band.

The filter bar was originally `--hairline`, making it *lighter* than the column
heads inside the pane below it and inverting the hierarchy. It is
`--hairline-strong` now, and the column heads carry no rule at all.

---

## Elements

**Toggle** — the only interactive control. States selection with a 2px rule in
the primary, never a fill and never a pill. Facets are multi-select and use
`aria-pressed`; the order is single-select and uses radio semantics
(`role="radio"`, `aria-checked`). Both wear the same rule. `Reset` is an action rather than a
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

The **name is a button** — selecting a museum puts it on the map — and the
outbound link is a second, separate action beside it. The row is deliberately
not a button that contains a link, which is what it was until the interaction
layer was rebuilt: nested interactive elements announce as one control and hide
the link from assistive technology.

Four states: resting, hovered, **peeked** (its pin is under the cursor on the
map, shown with a `--primary-line` inset rule, which never steals the current
selection), and selected — a primary rule at the left edge, a warm bed, the
figure going to the primary, and the name stepping from Book to Medium. Nothing
moves.

---

## Setting the data

The dataset is set, not typed. Contractions and possessives take a typographic
apostrophe (`’`, U+2019); seven museum names shipped with straight ones
before this was checked. `npm run check` fails on a straight apostrophe between
letters, or on a stray quotation mark, in any name, address or neighborhood.

---

## Components

**The pin carries a paper ring.** Without one, museums a block apart fused into
a single lump — in midtown that was most of them — and the map stopped
reporting how many things are actually there. A 1.4px ring in `--paper`
separates them at every zoom.

**Selection is a ring, not a size.** The chosen pin takes an ink fill and a
separate halo layer draws a cinnabar circle around it, so choosing a museum
does not make it look like a different *kind* of place. A selection the filters
have since excluded is cleared rather than left as a halo on empty map with the
URL still naming it.

**The popup points at its pin.** Leaflet's tip is a rotated square clipped by
its container, which leaves exactly the two bordered edges the callout needs.
Its address takes `text-wrap: pretty`, so a zip code never lands alone on a
line.

**Small caps take old-style figures.** A count beside a small-cap label is the
one place lining figures look wrong — they stand a head taller than the letters
next to them. `.toggle .tally` therefore overrides to `--figures-text`, which
is the classic pairing and the reason both figure sets are in the system.

**The field clears itself.** The native `-webkit-search-cancel-button` is a
heavy black glyph at the far end of a very wide rule, so it is hidden and
replaced by a small-cap `Clear` that only exists while there is something to
clear. It clears the *search*; `Reset` clears every filter, which is not what
someone retyping a query wants.

**Hovering a row reveals its link.** The outbound underline is transparent at
rest so a list of 107 stays calm, `--primary-line` while the row is hovered,
and `--primary` on the link itself.

---

## The map

**The basemap's colour is rebalanced per channel, not merely turned down.**

It was fully desaturated once, which looked disciplined and read badly: the
Hudson was the same value as the city either side of it, so the map could not
tell water from land. Turning saturation back up fixed that and introduced a
worse problem — CSS `saturate()` treats every hue alike, so OpenStreetMap's
motorway network came back as a dusty pink web in the same family as the pins.
The map went muddy and the cinnabar stopped separating.

A filter cannot desaturate one hue selectively, but a colour matrix can. The
basemap now runs through `#basemap`, an `feColorMatrix` built from

```
out = luminance + k · (channel − luminance)      k = 0.10 / 0.26 / 0.60
```

Almost none of the red survives, a little of the green, most of the blue: roads
go neutral, water stays water, parks stay parks, and **cinnabar is the only
warm thing on the page.** Chosen by rendering ten treatments — four `saturate`
variants, three matrices and two alternative keyless tile styles — of the same
view side by side.

It costs nothing: 16.7ms median frame interval idle and while panning, which is
60fps either way. Leaflet's own link colour and its attribution flag are still
overridden — nothing else carries a stray hue.

**One movement, landing correctly.** Choosing a museum used to centre its pin
and then let the popup auto-pan the map a second time. The view is now placed
deliberately: the centre is offset by half the room a popup needs, so the pin
sits below the middle with its label above it, and the popup no longer pans
itself at all.

**Animated zoom is capped at 1.5 steps.** A canvas renderer scales its whole
surface during a zoom animation and only redraws when it ends, so every pin
swells by the zoom factor and snaps back — measured at **16.8×** across a
city-wide fly. Under a step and a half that is imperceptible and the movement
is worth having; beyond it the view is placed outright, which looks deliberate
where a swelling, popping zoom looks broken. Panning between museums once
zoomed in is a pure pan, and stays smooth.

Other smoothness settings: continuous zoom (`zoomSnap: 0`) rather than quarter
steps, a slower wheel, a canvas margin of 0.6 so pins do not pop in at the edge
of the frame while panning, and `keepBuffer: 4` so panning has no white edge.

Pins are the primary: 107 cinnabar dots on warm gray. The selected pin takes an
ink fill with a wide, low-opacity primary halo.

The cost is worth naming: **boroughs are not color-coded.** One primary means
one hue, so the filters and the index carry that distinction instead — which is
what a map is for.

---

## Interaction

**The index is two tab stops, not two hundred.** A roving tabindex keeps only
the cursor row's button and link reachable; `↑` `↓` `Home` `End` `PageUp`
`PageDown` move through the results and fly the map along, so the whole index
can be read from the keyboard. `/` returns to the search field from anywhere
that isn't already a text field, `↓` from the field steps into the index, and
`Escape` clears the field, then the selection.

Re-rendering the index replaces every row, which drops keyboard focus back to
the top of the document. `update()` therefore restores focus to the cursor row
whenever focus was inside the list before the render.

**Facets count what choosing them would yield.** Each facet is tallied against
every *other* filter, so with Brooklyn selected the disciplines read `Art 4`,
`History 8`, `Design 0` — and a zero is disabled rather than left looking
available. Before this, the counts stayed global and `Design 7` led to an empty
list.

**"On map only" never empties the list under you.** With it on, the list *is*
the map's contents, so choosing a row pans only as far as `panInside` needs to
bring the pin into view instead of zooming to it. Selecting a row used to
collapse the list from 107 rows to 5.

**Grouped by borough, the index grows section rules.** The borough name and
its count head each run, and the per-row borough label — which would otherwise
repeat 58 times under a heading that already says it — comes off the screen
while staying in the document for assistive technology. The column head follows
the column: it reads *Discipline* while grouped, because that is what is in it.

**Three orders, one of them yours.** A–Z, by borough (in the boroughs' own
order, matching the filter bar), and by distance. Distance asks the browser
where you are and does nothing until it answers, so a refused or slow
permission prompt leaves the index exactly as it was — a declined permission
says so in a line under the controls rather than failing silently. Your
position draws as a hollow marker that cannot be mistaken for a museum, and the
map pans only far enough to bring it into view, never changing zoom.

Distances appear on the rows only while distance is the order, and are
measured, not estimated: great-circle miles from the verified coordinates, in
feet under a tenth of a mile.

**State lives in the URL** — `?q=`, `&borough=`, `&type=`, `&sort=`, `&onmap=1`, `&at=`.
A view can be reloaded or shared, and the selected museum comes back with it.

Motion respects `prefers-reduced-motion`: map movement and scrolling both go
instant, as well as the CSS transitions.

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

**One home per component.** A class defined in two layers drifts. The wordmark
was styled in both `app.css` and `specimen.css` while the imprint lived only in
`app.css` — so the specimen, which does not load `app.css`, rendered it
unstyled. Anything shared belongs in `components.css`. The audit enforces this:
a bare single-class selector at base level may define a component in only one
layer, while `.colophon .wordmark {}` and rules inside `@media` stay free,
being contextual and responsive rather than second definitions.

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

## Rebuilding the mark

```
npm run mark    # reads ~/Fonts/Master Library, writes web/mark.svg
```

Emits `mark.svg` and `mark-reverse.svg` — 319 bytes each, one `rect` and one
`path`. The letter, the weight and the two colors are constants at the top of
the script.

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
