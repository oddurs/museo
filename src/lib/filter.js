/** Matching, highlighting and distance — all pure, none of it reactive. */

import { M } from './city.js'

export const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
const hay = (m) => fold([m.n, m.b, m.h, m.a, m.c].join(' '))
export const terms = (query) => fold(query).split(/\s+/).filter(Boolean)

export const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function matches(m, query, borough) {
  if (borough && m.b !== borough) return false
  const t = terms(query)
  if (!t.length) return true
  const h = hay(m)
  return t.every((x) => h.includes(x))
}

/** The matched runs, marked, with everything else escaped. */
export function mark(text, query) {
  const t = terms(query)
  if (!t.length) return esc(text)
  const re = new RegExp('(' + t.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi')
  let out = '', last = 0
  for (const hit of fold(text).matchAll(re)) {
    out += esc(text.slice(last, hit.index)) + '<mark>' + esc(text.slice(hit.index, hit.index + hit[0].length)) + '</mark>'
    last = hit.index + hit[0].length
  }
  return out + esc(text.slice(last))
}

/* Distance is the question a museum index actually gets asked in the
   city: not what exists, but what is near. */
const R_MILES = 3958.8
const rad = (d) => (d * Math.PI) / 180
export function milesFrom(a, lat, lng) {
  const dLat = rad(lat - a.lat), dLng = rad(lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Close up, New York answers in blocks, so this answers in feet. */
export function howFar(mi) {
  const ft = mi * 5280
  if (ft < 1000) return `${Math.round(ft / 50) * 50} ft`
  if (mi < 10) return `${mi.toFixed(1)} mi`
  return `${Math.round(mi)} mi`
}

export function select(query, borough, here) {
  const rows = M.filter((m) => matches(m, query, borough))
  if (here) {
    for (const m of rows) m._mi = milesFrom(here, m.lat, m.lng)
    rows.sort((a, b) => a._mi - b._mi)
  }
  return rows
}

/** Faceted: each borough counts what it would show, ignoring the borough
    filter but honouring the search. */
export function counts(query) {
  const out = { All: 0 }
  for (const b of BOROUGHS) out[b] = 0
  for (const m of M) {
    if (!matches(m, query, null)) continue
    out.All++
    out[m.b]++
  }
  return out
}
