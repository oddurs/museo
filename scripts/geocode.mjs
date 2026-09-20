#!/usr/bin/env node
// Fills in lat/lng for any museum missing them, using OpenStreetMap Nominatim.
// Idempotent: entries that already have coordinates are left alone.
// Usage: node scripts/geocode.mjs [--force id1,id2]

import { readFile, writeFile } from 'node:fs/promises'

const DATA = new URL('../data/museums.json', import.meta.url)
const UA = 'museo/0.1 (NYC museum directory; contact oddurs@gmail.com)'
const NYC = { minLat: 40.46, maxLat: 40.95, minLng: -74.32, maxLng: -73.66 }

const force = new Set(
  (process.argv.find((a) => a.startsWith('--force='))?.split('=')[1] ?? '')
    .split(',')
    .filter(Boolean),
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function nominatim(params) {
  const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', ...params })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
  })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  return res.json()
}

function inNYC(lat, lng) {
  return lat >= NYC.minLat && lat <= NYC.maxLat && lng >= NYC.minLng && lng <= NYC.maxLng
}

// Try the most specific query first, then progressively looser ones.
function queriesFor(m) {
  const street = m.address.split(',')[0].trim()
  return [
    { q: `${m.name}, ${m.address}` },
    { q: `${m.name}, ${m.borough}, New York` },
    { q: `${street}, ${m.borough}, New York` },
  ]
}

const museums = JSON.parse(await readFile(DATA, 'utf8'))
const todo = museums.filter((m) => force.has(m.id) || m.lat == null || m.lng == null)
console.log(`${todo.length} of ${museums.length} need coordinates`)

const failed = []
for (const [i, m] of todo.entries()) {
  let hit = null
  for (const params of queriesFor(m)) {
    await sleep(1100) // Nominatim usage policy: max 1 request/second
    let out
    try {
      out = await nominatim(params)
    } catch (err) {
      console.warn(`  ! ${m.id}: ${err.message}`)
      continue
    }
    const r = out[0]
    if (!r) continue
    const lat = Number(r.lat)
    const lng = Number(r.lon)
    if (!inNYC(lat, lng)) continue
    hit = { lat, lng, matched: r.display_name, query: params.q }
    break
  }
  if (!hit) {
    failed.push(m.id)
    console.log(`[${i + 1}/${todo.length}] MISS ${m.id}`)
    continue
  }
  m.lat = Number(hit.lat.toFixed(6))
  m.lng = Number(hit.lng.toFixed(6))
  m.geocode = { matched: hit.matched, query: hit.query }
  console.log(`[${i + 1}/${todo.length}] ${m.id} -> ${m.lat},${m.lng}  (${hit.matched.slice(0, 70)})`)
}

await writeFile(DATA, JSON.stringify(museums, null, 2) + '\n')
console.log(`\nwrote ${museums.length} records; ${failed.length} unresolved${failed.length ? ': ' + failed.join(', ') : ''}`)
