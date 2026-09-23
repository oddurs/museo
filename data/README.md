# Data

Two source files here, from two sources, under two sets of terms — plus a
third source, the street centreline, which is fetched straight into the
generated `web/streets-data.js` rather than kept raw (it is 5.7 MB of GeoJSON
and nothing reads it twice).

## `museums.json`

107 New York City museums across the five boroughs.

| Field | Source |
| --- | --- |
| `name`, `borough`, `neighborhood`, `address`, `category`, `url` | Compiled by hand for this project. Every `url` is checked by `npm run links`. |
| `lat`, `lng`, `geocode` | [OpenStreetMap](https://www.openstreetmap.org), via the [Nominatim](https://nominatim.org) geocoder (`npm run geocode`). |

Because its coordinates are derived from OpenStreetMap, **this file is made
available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/)**.
Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
If you reuse it, keep that attribution, and share a derived database under the
same licence.

## `boroughs.json`

The five boroughs' shoreline — what the map draws instead of tiles.

**Source:** *Borough Boundaries (water areas excluded)*, NYC Department of City
Planning, published on [NYC Open Data](https://data.cityofnewyork.us/d/gthc-hcne)
and used under the [NYC Open Data Terms of Use](https://www.nyc.gov/home/terms-of-use.page).

Rebuilt by `npm run boroughs`, which fetches the current release and simplifies
it — Douglas–Peucker at about 40 m, specks smaller than a city block dropped —
from 81,085 points to 3,811, and about 3 MB to 67 KB.

## The street network

`web/streets-data.js` is generated, not stored here, by `npm run streets`.

**Source:** *NYC Street Centerline (CSCL)*, NYC Department of Information
Technology and Telecommunications, published on
[NYC Open Data](https://data.cityofnewyork.us/d/inkn-q76z) as dataset
`inkn-q76z`. Only `rw_type` 1, 2 and 3 are taken — the streets and highways
people navigate by, not driveways, ferry routes or paper streets.

**Terms:** the [NYC Open Data Terms of Use](https://www.nyc.gov/html/data/terms.html).
Attribution is carried in the page's colophon and in [NOTICE](../NOTICE).

The geometry is projected into the same 1000×1000 frame as `web/city.js`,
simplified with Douglas–Peucker at a 1.5-unit tolerance, and delta-encoded as
varints in a 64-character alphabet: 112,489 polylines in about 1.2 MB, which
the page decodes after its first paint.
