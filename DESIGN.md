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
| `--amber` | `#e9b872` | gallery light |

Amber is the one warm thing on the page. It marks the museum you have chosen
and nothing else — the selected pin, its halo, the row in the index, the
category tag, the one filled button. Nothing else in the interface is allowed
to be warm, so warmth always means *this one*.

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
