# Museo

An index of every museum in the five boroughs of New York City, on a drawn map
of the city after dark.

**<https://oddurs.github.io/museo/>**

[![Deploy](https://github.com/oddurs/museo/actions/workflows/pages.yml/badge.svg)](https://github.com/oddurs/museo/actions/workflows/pages.yml)
[![Checks](https://github.com/oddurs/museo/actions/workflows/checks.yml/badge.svg)](https://github.com/oddurs/museo/actions/workflows/checks.yml)
[![Links](https://github.com/oddurs/museo/actions/workflows/links.yml/badge.svg)](https://github.com/oddurs/museo/actions/workflows/links.yml)

Static HTML, one stylesheet and four scripts. No framework, no build step for
development, no dependencies at runtime, no tile server and no map key — the
city is drawn from its own coastline and its own street centrelines.

```
npm start        # http://localhost:5173
npm run check    # validate the dataset, including its typography
npm run map      # the drawn city still matches the data
npm run links    # check every outbound museum link
npm run site     # assemble the public site in _site/, as Pages serves it
```

## What's here

- **107 museums** — Manhattan 58, Brooklyn 16, Queens 15, Bronx 8,
  Staten Island 10. Each links out to the museum's own site. No photos, by
  design. One museum (Garibaldi-Meucci) has no working website, and the entry
  says so rather than offering a dead link.
- **A drawn city.** The five boroughs from NYC Planning's shoreline, and
  112,489 street centrelines that arrive as you come down: arterials from zoom
  4, the full grid at 7, street names at 10.5. New York is navigated by cross
  street, so the grid has to be there when you are close enough to walk it —
  and absent when you are not.
- **Named water.** The harbour is not empty space. Names are set along the
  visible stretch of each river, bay and kill, following its bends, appearing
  only when there is room to carry them.
- **Filters** — every borough visible at once, and full-text search over name,
  neighbourhood and address. Terms match independently, so "children brooklyn"
  works.
- **A real scale bar**, reading in feet until feet stop being useful.
- **Keyboard** — `/` jumps to search, `↑` `↓` move through the index and fly the
  map along, `Enter` opens the museum's site, `Escape` clears.

## A note on the typeface

This site is set in the reader's own system sans — SF Pro on Apple platforms,
Segoe UI on Windows, whatever `system-ui` resolves to elsewhere. It serves no
font files at all. A GitHub Pages site serves its fonts to anyone who asks,
which a font licence does not generally allow; a page set in the reader's own
type cannot have that problem, and looks native besides.

The deploy workflow fails if a font file ever reaches `_site/`.

An earlier version of this site was designed in Whitney, with a documented
design system and a living specimen. It is preserved at the **`whitney-light`**
tag.

## Layout

```
data/museums.json        the dataset (hand-curated, machine-geocoded)
data/boroughs.json       the five boroughs' shoreline from NYC Planning
data/README.md           where each file comes from, and its terms
web/index.html           the page
web/museo.css            the whole visual system
web/city.js              generated: boroughs as paths, museums as points
web/streets-data.js      generated: the street network, delta-encoded
web/cartography.js       decoding and drawing the streets and the water
web/app.js               behaviour
web/mark.svg             the favicon
scripts/build-city.mjs   data/*.json         -> web/city.js
scripts/build-streets.mjs NYC Open Data      -> web/streets-data.js
scripts/build-boroughs.mjs fetches and simplifies the borough shoreline
scripts/geocode.mjs      fills missing lat/lng from OpenStreetMap Nominatim
scripts/check-data.mjs   validates the dataset
scripts/check-map.mjs    catches a generated map that has gone stale
scripts/check-links.mjs  checks every outbound museum link
scripts/serve.mjs        zero-dependency static server
scripts/build-site.mjs   assembles the public site for GitHub Pages
.github/workflows/       deploy on push to main; checks on every push; links weekly
```

See **[DESIGN.md](DESIGN.md)** for the system behind it, and **[NOTICE](NOTICE)**
for what is licensed how.

## Data

One object per museum:

```json
{
  "id": "noguchi",
  "name": "The Noguchi Museum",
  "borough": "Queens",
  "neighborhood": "Long Island City",
  "address": "9-01 33rd Road, Queens, NY 11106",
  "url": "https://www.noguchi.org",
  "category": "Art",
  "lat": 40.76699,
  "lng": -73.937607,
  "geocode": { "matched": "...", "query": "..." }
}
```

`id`, `name`, `borough`, `address`, `url` and `category` are hand-entered.
`url` is optional — an entry without a link beats an entry with a dead one.
`lat`, `lng` and `geocode` are written by `npm run geocode`.

Both generated files under `web/` are rebuilt from this data:
`npm run city` is instant; `npm run streets` re-downloads the centreline from
NYC Open Data and takes a few minutes, which is why its output is committed.
