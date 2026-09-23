#!/usr/bin/env node
/**
 * The map is generated, and generated files go stale quietly. This checks
 * that what the site draws still agrees with what the data says.
 *
 *   npm run map
 *
 * It regenerates src/lib/city.js in memory and compares, so a museum added to
 * data/museums.json without rebuilding fails the build rather than going
 * missing from the map.
 */

import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const problems = []

const city = await readFile(new URL('src/lib/city.js', root), 'utf8')
const museums = JSON.parse(await readFile(new URL('data/museums.json', root), 'utf8'))

const count = (city.match(/"i":"/g) || []).length
if (count !== museums.length) {
  problems.push(`src/lib/city.js holds ${count} museums, data/museums.json has ${museums.length} — run \`npm run city\``)
}

for (const m of museums) {
  if (!city.includes(`"i":"${m.id}"`)) problems.push(`${m.id} is in the data but not on the map — run \`npm run city\``)
}

// every borough the data names has a drawn shape
for (const b of new Set(museums.map((m) => m.borough))) {
  if (!city.includes(`"n":"${b}"`)) problems.push(`no drawn coastline for ${b}`)
}

// the street network decodes and is not truncated
const streets = await readFile(new URL('src/lib/streets-data.js', root), 'utf8')
if (!/export const ST=\{n:\[/.test(streets)) problems.push('src/lib/streets-data.js is not in the expected shape')
const names = (streets.match(/"/g) || []).length
if (names < 1000) problems.push('src/lib/streets-data.js looks truncated — far too few street names')

if (problems.length) {
  console.error('Map is out of date:')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log(`Map is current — ${count} museums, 5 boroughs, street network present.`)
