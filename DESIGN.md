# The design of Museo

One visual world: the city after dark, seen from above. A single theme by
intent, so every colour is stated and the page holds on any ground.

## Colour

Graphite with a blue bias — a chosen neutral, not inherited black.

| token | value | what it is |
| --- | --- | --- |
| `--ground`, `--water` | `#0b0c0e` | the harbour, and everything under the page |
| `--land` | `#1c1f24` | the five boroughs |
| `--land-hi` | `#22262b` | the borough you have filtered to |
| `--shore` | `white 17%` | the coastline |
| `--ink` | `#f2f3f5` | type |
| `--ink-2`, `--ink-3` | `62%`, `34%` | secondary and quiet type |
| `--accent` | `#ff4a1f` | vermilion |

Vermilion is the one saturated thing on the page. It marks the museum you have
chosen and nothing else — the selected pin, its halo, the row in the index, the
category tag, the one filled button. Nothing else in the interface carries a
hue, so colour always means *this one*. It holds 5.4:1 as type on the panel and
4.9:1 as a mark on the land; white on the filled button would be 3.4:1, so that
button's label is near-black instead.

The wordmark's glyph stays in ink for the same reason: a logo is not the museum
you have chosen.

## Type

The system sans, at its two optical sizes: `SF Pro Text` for reading, `SF Pro
Display` (`.display`) for anything set large, tracked in. No font file is
served. The page looks native because it is set in the reader's own type, and
a site that ships no fonts cannot ship a licence problem.

Numbers that change in place — the tally, the scale, the borough counts — are
tabular, so nothing shifts as they count.

## Glass

Panels sit over the city and are carried by opacity, edge and shadow. There is
deliberately no `backdrop-filter`: measured against this map a 34px blur moved
the pixels by 0.06 of 255, and it re-blurred the whole panel on every frame of
every drag to do it.

## The map

Drawn, not tiled — there is no tile server and no key.

- **Boroughs** are filled paths from NYC City Planning, projected into a
  1000×1000 frame (Web Mercator fitted to the borough bounds).
- **Streets** are 112,489 polylines on a canvas, indexed into a spatial grid
  and culled to the viewport. The arterials fade in from zoom 4; the full grid
  waits until zoom 7, which is both the honest cartography — a whole borough of
  side streets at once is a smear — and the cheap one.
- **Street names** appear from zoom 10.5. They are chosen in *map* space, not
  screen space: the slot grid is laid over the city and the lowest-indexed
  street wins its slot, so panning moves the type with the map instead of
  reshuffling which streets are named.
- **Water** is named along its own centrelines, letter by letter, following the
  bends. A name appears only once the visible stretch of its water is long
  enough to carry it, and its tracking opens until it spans it. So the harbour
  names itself first and the creeks last.
- **Pins** are zero-length paths with round caps and a non-scaling stroke: the
  browser holds them at a constant size through every zoom without the script
  writing to them.

## State

The search, the borough and the selected museum are written to the address bar
with `replaceState` — enough that a view survives a reload and travels in a
link, without filling anyone's back button with keystrokes. A restored link
sets the view directly rather than animating to it: you arrive where you were
sent.

Where you are is deliberately **not** in the link. It belongs to the device, not
to the view, and a shared URL should never make someone else's browser ask for
their location.

## Where the framework stops

Svelte owns the panel and the card. They change when you do something — a
keystroke, a click — which is exactly what a reactive framework is for.

Svelte does not own the map. The view changes sixty times a second while you
drag, and a component update per frame is the wrong shape for that, so
`src/lib/map.js` keeps `view` as a plain object and writes to the canvas and the
SVG directly. The page tells it what to show (`setVisible`, `setChosen`,
`fitTo`); it tells the page what was clicked. That boundary is the whole
architecture, and it is why the port cost nothing in frame budget.

One consequence worth stating: mounting the map is not a reaction to anything.
It belongs in `onMount`. Written as an `$effect` it depends on everything it
touches, so a keystroke re-runs it — which, the first time round, quietly reset
the search on every character typed.

## Motion

One `requestAnimationFrame` per frame does every write; pointer events only
mark the view dirty, and nothing reads layout afterwards. While the map is
moving the canvas is drawn at one device pixel per CSS pixel instead of two — a
quarter of the raster work for the one moment nobody is reading hairlines — and
it returns to full resolution the moment you let go.

`prefers-reduced-motion` removes the flights and the transitions entirely.

## Focus

A focus ring is amber, offset from the thing it marks, and appears only for
keyboard users (`:focus-visible`). Never a box around the map.
