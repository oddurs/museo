# Museo

An index of every museum in the five boroughs of New York City.

**<https://oddurs.github.io/museo/>**

[![Deploy](https://github.com/oddurs/museo/actions/workflows/pages.yml/badge.svg)](https://github.com/oddurs/museo/actions/workflows/pages.yml)
[![Checks](https://github.com/oddurs/museo/actions/workflows/checks.yml/badge.svg)](https://github.com/oddurs/museo/actions/workflows/checks.yml)
[![Links](https://github.com/oddurs/museo/actions/workflows/links.yml/badge.svg)](https://github.com/oddurs/museo/actions/workflows/links.yml)

Set in type on white, with one accent — vermilion — and the city drawn from its
own coastline rather than tiled. Static HTML, CSS and JavaScript on a documented
design system. No framework, no build step for development, nothing to install.

```
npm start       # http://localhost:5173
npm run check   # validate the dataset, including its typography
npm run audit   # lint the design system — spacing, strokes, tokens
npm run links   # check every outbound museum link
npm run site    # assemble the public site in _site/, as Pages serves it
```

The design system and a living specimen of it:
[DESIGN.md](DESIGN.md) · <https://oddurs.github.io/museo/design/>

## A note on the typeface

Museo is designed in **Whitney**, a licensed typeface from Hoefler & Co. It is
not in this repository and is not served on the public site: a GitHub Pages site
serves its font files to anyone who asks, which a font licence does not
generally allow.

The public site is therefore set in your system's sans, restated to Whitney's
metrics so nothing reflows and the layout holds; small caps are synthesised
where the face has none. It says so in its colophon.

With your own licensed copy of Whitney, the real faces build locally:

```
npm run fonts   # subsets the OTFs from ~/Fonts/Master Library (or --src)
npm run mark    # cuts the mark from Whitney Bold
```

`npm run site` never includes them unless you pass `--with-whitney`, and the
deploy workflow refuses to publish if a font file ever reaches `_site/`.

## What's here

- **107 museums** — Manhattan 58, Brooklyn 16, Queens 15, Bronx 8, Staten Island 10.
- **Map** — the five boroughs drawn from NYC Planning's shoreline, with
  OpenStreetMap streets fading in only once you zoom to neighbourhood level.
  Clicking a pin centres that museum in the index; clicking an entry brings its
  pin into view.
- **Filters** — borough, category, and full-text search over name, neighborhood and
  address. Filters combine, and search terms are matched independently
  ("children brooklyn" works).
- **On map only** — narrows the index to the current map viewport, so you can pan
  to a neighborhood and see just what's walkable from there.
- **Order** — A–Z, by borough, or by distance from where you are. Distances are
  great-circle miles from the verified coordinates, in feet up close.
- Each entry links out to the museum's own site. No photos, by design. Links
  are verified with `npm run links`; one museum (Garibaldi-Meucci) has no
  working website and the entry says so rather than offering a dead link.
- **Keyboard** — `/` jumps to search, `↓` steps into the index, `↑` `↓` `Home`
  `End` move through results and fly the map along, `Escape` clears.
- **Shareable** — filters, search and the selected museum live in the URL, so a
  view survives a reload and can be sent to someone.

## Layout

```
data/museums.json       the dataset (hand-curated, machine-geocoded)
data/boroughs.json      the five boroughs' shoreline from NYC Planning, 67KB
data/README.md          where each file comes from, and its terms
web/index.html          the app
web/app.js              behaviour
web/system.css          design system — tokens, primitives, elements
web/components.css      shared composite pieces (index entry, map popup)
web/app.css             composition only; tokens, never raw values
web/fonts.css           generated @font-face rules (gitignored)
web/fonts.fallback.css  metric-matched fallbacks only, no font data
web/fonts/              generated .woff2 (gitignored — licensed)
web/design/             living specimen of the design system
scripts/build-fonts.py  subsets Whitney OTFs into web fonts
scripts/build-mark.py   lifts the M out of Whitney as an SVG mark
scripts/serve.mjs       zero-dependency static server
scripts/build-site.mjs  assembles the public site for GitHub Pages
scripts/build-boroughs.mjs fetches and simplifies the borough shoreline
scripts/geocode.mjs     fills missing lat/lng from OpenStreetMap Nominatim
scripts/check-data.mjs  validates the dataset
scripts/audit-design.mjs lints spacing, borders and tokens
scripts/check-links.mjs  checks every outbound museum link
.github/workflows/      deploy on push to main; checks on every push; links weekly
```

See **[DESIGN.md](DESIGN.md)** for the system: principles, color, type scale,
space, elements, and how to extend it.

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

Categories in use: Art, Children, Culture, Design, History, Science, Specialty.

### Adding a museum

Append an entry without `lat`/`lng`, then:

```
npm run geocode   # only touches records missing coordinates
npm run check
```

`geocode` tries `name + address` first and falls back to looser queries, rejecting
anything outside the NYC bounding box. It sleeps 1.1s between calls to respect the
[Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).
To re-geocode an existing record: `node scripts/geocode.mjs --force=some-id,other-id`.

Coordinates were spot-checked against known positions; the ten landmarks sampled
were all within 40m.

### Checking the links

```
npm run links            # all of them, six at a time
npm run links -- --slow  # one at a time
```

A 403 or 429 is reported as *unverifiable*, not broken: nine of the larger
museums sit behind bot protection that refuses any automated request. Those
still need a human eye — the stale Met Cloisters and NMAI paths were both
hiding behind a block.

## Still to come

Pricing and opening hours. The index entry already renders two optional fields if
they're present on a record, so the first step is populating them:

```json
{ "admission": "$30 suggested", "hoursSummary": "Wed–Mon 10–5, closed Tue" }
```

`web/app.js` → `facts()` is where that renders.

## Notes on scope

Included: collecting institutions, historic house museums, and a few cultural
centers with permanent public exhibition space (Snug Harbor, Wave Hill, Socrates
Sculpture Park). Excluded: zoos, botanical gardens, commercial "experiences," and
institutions currently without a physical venue (e.g. the Rubin, which closed its
West 17th Street building in 2024).

## Deploying

Every push to `main` runs the data and design checks, assembles the public site
with `npm run site`, refuses to continue if a font file is in it, and deploys to
GitHub Pages. `npm run site` reproduces that build locally.

Locally the app lives in `web/` and reads `../data/`. A project site is served
under `/museo/`, where `../` would climb out of the project, so the build
flattens `web/` to the root and moves the app's single data path to match.

## Licence

The code is [MIT](LICENSE). The data carries its own terms — see
[data/README.md](data/README.md):

- **`museums.json`** — [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/),
  because its coordinates come from OpenStreetMap. © OpenStreetMap contributors.
- **`boroughs.json`** — NYC Department of City Planning, under the NYC Open
  Data Terms of Use.
- **Map tiles** — © OpenStreetMap contributors, credited on the map.

Whitney is © Hoefler & Co. and is not part of this project.
