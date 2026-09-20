#!/usr/bin/env node
// Validates data/museums.json. Run with `npm run check`.
import { readFile } from 'node:fs/promises'

const museums = JSON.parse(await readFile(new URL('../data/museums.json', import.meta.url), 'utf8'))
const BOROUGHS = new Set(['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'])
const NYC = { minLat: 40.46, maxLat: 40.95, minLng: -74.32, maxLng: -73.66 }

const problems = []
const seenIds = new Set()
const seenNames = new Set()

for (const m of museums) {
  const where = m.id ?? m.name ?? '(unnamed)'
  for (const field of ['id', 'name', 'borough', 'address', 'url', 'category']) {
    if (!m[field]) problems.push(`${where}: missing ${field}`)
  }
  if (seenIds.has(m.id)) problems.push(`${where}: duplicate id`)
  seenIds.add(m.id)
  if (seenNames.has(m.name)) problems.push(`${where}: duplicate name`)
  seenNames.add(m.name)
  if (!BOROUGHS.has(m.borough)) problems.push(`${where}: unknown borough "${m.borough}"`)
  if (typeof m.lat !== 'number' || typeof m.lng !== 'number') {
    problems.push(`${where}: missing coordinates`)
  } else if (
    m.lat < NYC.minLat || m.lat > NYC.maxLat ||
    m.lng < NYC.minLng || m.lng > NYC.maxLng
  ) {
    problems.push(`${where}: coordinates outside NYC (${m.lat}, ${m.lng})`)
  }
  // Typography: the dataset is set, not typed. A straight apostrophe between
  // letters is a contraction and belongs as U+2019.
  for (const field of ['name', 'address', 'neighborhood']) {
    if (m[field] && /(?<=\w)'(?=\w)/.test(m[field])) {
      problems.push(`${where}: straight apostrophe in ${field} — use \u2019 ("${m[field]}")`)
    }
    if (m[field] && /["\u201c\u201d]/.test(m[field])) {
      problems.push(`${where}: quotation mark in ${field} — unexpected ("${m[field]}")`)
    }
  }

  try {
    const u = new URL(m.url)
    if (u.protocol !== 'https:') problems.push(`${where}: url is not https`)
  } catch {
    problems.push(`${where}: invalid url "${m.url}"`)
  }
}

// two museums at the same coordinates is fine (Snug Harbor), identical to 6dp is not
const byCoord = new Map()
for (const m of museums) {
  const key = `${m.lat},${m.lng}`
  byCoord.set(key, [...(byCoord.get(key) ?? []), m.id])
}
for (const [key, ids] of byCoord) {
  if (ids.length > 1) problems.push(`identical coordinates ${key}: ${ids.join(', ')}`)
}

const byBorough = {}
for (const m of museums) byBorough[m.borough] = (byBorough[m.borough] ?? 0) + 1

console.log(`${museums.length} museums`, byBorough)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(' -', p)
  process.exit(1)
}
console.log('all checks passed')
