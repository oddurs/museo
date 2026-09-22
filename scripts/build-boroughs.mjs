#!/usr/bin/env node
/**
 * The drawn city: NYC's five boroughs, from the Department of City Planning.
 *
 *   npm run boroughs
 *
 * Source: "Borough Boundaries (water areas excluded)", NYC Department of City
 * Planning, published on NYC Open Data (dataset gthc-hcne) under the NYC Open
 * Data terms of use. Fetched fresh, then simplified — the published file is
 * ~3MB, which is far more coastline than a map this size can draw.
 */

import { writeFile } from 'node:fs/promises'

const SOURCE = 'https://data.cityofnewyork.us/resource/gthc-hcne.geojson'
const OUT = new URL('../data/boroughs.json', import.meta.url)

// Douglas–Peucker tolerance in degrees (~40m) and the smallest island kept.
const TOLERANCE = 0.00035
const MIN_AREA = 0.0000012

const perpendicular = ([x, y], [x1, y1], [x2, y2]) => {
  const dx = x2 - x1, dy = y2 - y1
  if (!dx && !dy) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

function simplify(points, tol) {
  if (points.length < 3) return points
  let max = 0, at = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicular(points[i], points[0], points[points.length - 1])
    if (d > max) { max = d; at = i }
  }
  if (max <= tol) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, at + 1), tol).slice(0, -1), ...simplify(points.slice(at), tol)]
}

const area = (ring) => Math.abs(ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length]
  return sum + (p[0] * q[1] - q[0] * p[1])
}, 0) / 2)

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`NYC Open Data answered ${res.status}`)
const source = await res.json()

let before = 0, after = 0
const features = source.features.map((f) => {
  const name = f.properties.boroname
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  const kept = polygons
    .map((polygon) => polygon.map((ring) => {
      before += ring.length
      const out = simplify(ring.map(([x, y]) => [+x, +y]), TOLERANCE).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])
      after += out.length
      return out
    }).filter((ring) => ring.length > 3 && area(ring) > MIN_AREA))
    .filter((polygon) => polygon.length)
  return { type: 'Feature', properties: { name }, geometry: { type: 'MultiPolygon', coordinates: kept } }
})

const out = {
  type: 'FeatureCollection',
  source: 'NYC Department of City Planning, Borough Boundaries (water areas excluded), via NYC Open Data (gthc-hcne)',
  features,
}
const json = JSON.stringify(out)
await writeFile(OUT, json)
console.log(`${features.map((f) => f.properties.name).join(', ')}`)
console.log(`${before} points → ${after}, ${(json.length / 1024).toFixed(0)}KB`)
