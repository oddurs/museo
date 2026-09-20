# Museo

A browsable directory of museums across all five boroughs of New York City.
Static HTML/CSS/JS, no build step, no dependencies to install.

```
npm start      # http://localhost:5173
npm run check  # validate data/museums.json
npm run geocode # fill in coordinates for any new entries
```

## What's here

- **107 museums** — Manhattan 58, Brooklyn 16, Queens 15, Bronx 8, Staten Island 10.
- **Map** (Leaflet + OpenStreetMap), pins colored by borough. Clicking a pin scrolls
  the list to that museum; clicking a card flies the map to the pin.
- **Filters** — borough, category, and full-text search over name, neighborhood and
  address. Filters combine, and search terms are matched independently
  ("children brooklyn" works).
- **Only what's on the map** — narrows the list to the current map viewport, so you
  can pan to a neighborhood and see just what's walkable from there.
- Each entry links out to the museum's own site. No photos, by design.

## Layout

```
data/museums.json     the dataset (hand-curated, machine-geocoded)
web/                  the interface — index.html, styles.css, app.js
scripts/serve.mjs     zero-dependency static server
scripts/geocode.mjs   fills missing lat/lng from OpenStreetMap Nominatim
scripts/check-data.mjs validates the dataset
```

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

## Still to come

Pricing and opening hours. The card renderer already displays two optional fields
if they're present on a record, so the first step is populating them:

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
