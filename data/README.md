# Data

Two files, from two sources, under two sets of terms.

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
