const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']

const PRIMARY = '#ff3b00'
const INK = '#111111'
const PAPER = '#ffffff'
const LAND = '#f0f0ee'
const COAST = '#dcdcd9'

// Streets arrive only where you need them to find a door: invisible at city
// scale, where the drawn silhouette is the map, and faded up over a zoom and a
// half once you are looking at a neighbourhood.
const STREETS_FROM = 13
const STREETS_FULL = 14.5
const STREETS_MAX_OPACITY = 0.55

// Every pin carries a paper ring. Without it, museums a block apart fuse into
// one lump — in midtown that was most of them — and the map stopped reporting
// how many things are actually there.
const PIN = { radius: 3.6, weight: 1.4, color: PAPER, fillColor: PRIMARY, fillOpacity: 1, opacity: 1 }
const PIN_HOVER = { radius: 5, weight: 1.6, color: PAPER, fillColor: PRIMARY, fillOpacity: 1, opacity: 1 }
const PIN_ACTIVE = { radius: 5, weight: 1.6, color: PAPER, fillColor: INK, fillOpacity: 1, opacity: 1 }

// The selection reads as a ring around the pin rather than a change of size,
// so choosing a museum does not make it look like a different kind of place.
const HALO = { radius: 10, weight: 1.5, color: PRIMARY, opacity: 0.65, fill: false, interactive: false }

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const animate = !reduceMotion

const SORTS = {
  az:      { label: 'A–Z' },
  borough: { label: 'Borough' },
  near:    { label: 'Near me' },
}

const state = {
  museums: [],
  sort: 'az',
  origin: null,    // {lat, lng} once the browser has told us where we are
  query: '',
  boroughs: new Set(),
  categories: new Set(),
  viewportOnly: false,
  activeId: null,
  rows: [],        // what the index is currently showing, in order
  cursor: -1,      // index into rows for roving focus
}

const els = {
  list: document.getElementById('list'),
  scroll: document.getElementById('scroll'),
  colophonCount: document.getElementById('colophon-count'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
  boroughFilters: document.getElementById('borough-filters'),
  categoryFilters: document.getElementById('category-filters'),
  viewportOnly: document.getElementById('viewport-only'),
  count: document.getElementById('count'),
  countLabel: document.getElementById('count-label'),
  reset: document.getElementById('reset'),
  searchClear: document.getElementById('search-clear'),
  status: document.getElementById('status'),
  notice: document.getElementById('notice'),
  sortOptions: document.getElementById('sort-options'),
}

const toggles = { borough: new Map(), category: new Map() }
const markers = new Map()
const sortToggles = new Map()
let map
let halo
let hereMarker

/* ---------------------------------------------------------------- text --- */

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const terms = () => norm(state.query).split(/\s+/).filter(Boolean)

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const ordinal = (n) => String(n).padStart(3, '0')

/** Great-circle distance in miles. The index is walked, so miles read better
    than kilometres here and a tenth of a mile is as precise as it gets. */
function milesBetween(a, b) {
  const R = 3958.8
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Under a tenth of a mile, feet are the honest unit — rounded to ten, which
    is about as much as a street address and a phone's fix can support. */
function formatMiles(mi) {
  if (mi < 0.1) return `${Math.max(10, Math.round((mi * 5280) / 10) * 10)} ft`
  if (mi < 10) return `${mi.toFixed(1)} mi`
  return `${Math.round(mi)} mi`
}

/** The city/state/zip tail is the same on every record; the index drops it. */
const street = (address) =>
  address.replace(/,\s*(New York|Brooklyn|Queens|Bronx|Staten Island),\s*NY.*$/i, '')

/** Marks search hits by slicing the original string, so accents survive. */
function highlight(text) {
  const t = terms()
  if (!t.length) return escapeHtml(text)
  const re = new RegExp(`(${t.map(escapeRe).join('|')})`, 'gi')
  let html = ''
  let last = 0
  for (const hit of norm(text).matchAll(re)) {
    html += escapeHtml(text.slice(last, hit.index))
    html += `<mark>${escapeHtml(text.slice(hit.index, hit.index + hit[0].length))}</mark>`
    last = hit.index + hit[0].length
  }
  return html + escapeHtml(text.slice(last))
}

/* ----------------------------------------------------------- filtering --- */

const haystack = (m) => norm([m.name, m.borough, m.neighborhood, m.address, m.category].join(' '))

const matchesText = (m) => terms().every((t) => haystack(m).includes(t))

/**
 * A museum passes when every filter agrees. `except` skips one facet, which is
 * how each facet counts what selecting it would actually yield.
 */
function matches(m, except) {
  if (except !== 'borough' && state.boroughs.size && !state.boroughs.has(m.borough)) return false
  if (except !== 'category' && state.categories.size && !state.categories.has(m.category)) return false
  return matchesText(m)
}

function inViewport(m) {
  if (!state.viewportOnly || !map) return true
  return map.getBounds().contains([m.lat, m.lng])
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en')

/** The index's order. Distance falls back to A–Z until the browser has placed
    us, so choosing "Near me" never empties or scrambles the list while the
    permission prompt is open. */
function ordered(rows) {
  if (state.sort === 'borough') {
    return [...rows].sort(
      (a, b) => BOROUGHS.indexOf(a.borough) - BOROUGHS.indexOf(b.borough) || byName(a, b),
    )
  }
  if (state.sort === 'near' && state.origin) {
    return [...rows].sort(
      (a, b) => milesBetween(state.origin, a) - milesBetween(state.origin, b) || byName(a, b),
    )
  }
  return [...rows].sort(byName)
}

const visible = () => ordered(state.museums.filter((m) => matches(m) && inViewport(m)))

/* ----------------------------------------------------------- url state --- */

function writeUrl() {
  const p = new URLSearchParams()
  if (state.query) p.set('q', state.query)
  if (state.boroughs.size) p.set('borough', [...state.boroughs].join(','))
  if (state.categories.size) p.set('type', [...state.categories].join(','))
  if (state.sort !== 'az') p.set('sort', state.sort)
  if (state.viewportOnly) p.set('onmap', '1')
  if (state.activeId) p.set('at', state.activeId)
  const url = p.toString() ? `?${p}` : location.pathname
  history.replaceState(null, '', url)
}

function readUrl() {
  const p = new URLSearchParams(location.search)
  state.query = p.get('q') ?? ''
  const known = (set, values) => values.filter(Boolean).forEach((v) => set.add(v))
  known(state.boroughs, (p.get('borough') ?? '').split(',').filter((b) => BOROUGHS.includes(b)))
  known(state.categories, (p.get('type') ?? '').split(',').filter(Boolean))
  const sort = p.get('sort')
  if (sort && sort in SORTS) state.sort = sort
  state.viewportOnly = p.get('onmap') === '1'
  state.activeId = p.get('at')
  els.search.value = state.query
}

/* -------------------------------------------------------------- index --- */

// Pricing and opening hours land here later; render whatever exists today.
function facts(m) {
  const bits = [m.admission, m.hoursSummary].filter(Boolean)
  return bits.length ? `<p class="entry__meta t-small">${escapeHtml(bits.join(' · '))}</p>` : ''
}

const showDistance = () => state.sort === 'near' && !!state.origin
const isGrouped = () => state.sort === 'borough'

/** A section rule announcing each borough. Presentational: every row still
    carries its borough for assistive technology, just not on screen. */
function sectionRow(borough, count) {
  const li = document.createElement('li')
  li.className = 'index__section'
  li.setAttribute('aria-hidden', 'true')
  li.innerHTML =
    `<span class="index__section-name t-label">${escapeHtml(borough)}</span>` +
    `<span class="index__section-count t-figure">${count}</span>`
  return li
}

function renderIndex() {
  state.rows = visible()
  const active = state.rows.findIndex((m) => m.id === state.activeId)
  state.cursor = active >= 0 ? active : state.rows.length ? 0 : -1

  const grouped = isGrouped()
  const counts = {}
  if (grouped) for (const m of state.rows) counts[m.borough] = (counts[m.borough] ?? 0) + 1
  let section = null
  const children = []

  els.list.classList.toggle('is-grouped', grouped)
  els.list.replaceChildren(
    ...state.rows.flatMap((m, i) => {
      const before = []
      if (grouped && m.borough !== section) {
        section = m.borough
        before.push(sectionRow(m.borough, counts[m.borough]))
      }
      const li = document.createElement('li')
      li.innerHTML = `
        <article class="entry" data-id="${escapeHtml(m.id)}">
          <span class="entry__no t-figure" aria-hidden="true">${ordinal(i + 1)}</span>
          <div class="entry__body">
            <h2 class="entry__name t-heading">
              <button type="button" class="entry__select" tabindex="-1">${highlight(m.name)}</button>
            </h2>
            <p class="entry__meta t-small">${
              showDistance() ? `<span class="entry__distance">${formatMiles(milesBetween(state.origin, m))}</span> &middot; ` : ''
            }${m.neighborhood ? highlight(m.neighborhood) + ' &middot; ' : ''
            }${highlight(street(m.address))}</p>
            ${m.url
              ? `<a class="entry__link t-fine" href="${escapeHtml(m.url)}" tabindex="-1"
                    target="_blank" rel="noopener noreferrer">${escapeHtml(hostOf(m.url))} &#8599;</a>`
              : '<span class="entry__link entry__link--none t-fine">No website</span>'}
            ${facts(m)}
          </div>
          <span class="entry__class">
            <span class="entry__borough t-label${grouped ? ' sr-only' : ''}">${escapeHtml(m.borough)}</span>
            <span class="entry__discipline t-label">${escapeHtml(m.category)}</span>
          </span>
        </article>`
      return [...before, li]
    }),
  )

  els.empty.hidden = state.rows.length > 0
  els.count.textContent = state.rows.length
  els.countLabel.textContent =
    state.rows.length === state.museums.length
      ? state.rows.length === 1 ? 'Museum' : 'Museums'
      : `of ${state.museums.length}`

  announce()
  title()
  syncActive()
  syncRoving()
}

/** The tab says what is on screen — a filtered view is a different page. */
function title() {
  const parts = []
  if (state.query) parts.push(`“${state.query}”`)
  if (state.boroughs.size) parts.push([...state.boroughs].join(' + '))
  if (state.categories.size) parts.push([...state.categories].join(' + '))
  document.title = parts.length ? `${parts.join(' · ')} — Museo` : 'Museo — New York City Museums'
}

function announce() {
  const bits = []
  if (state.query) bits.push(`matching “${state.query}”`)
  if (state.boroughs.size) bits.push(`in ${[...state.boroughs].join(', ')}`)
  if (state.categories.size) bits.push(`${[...state.categories].join(', ')}`)
  if (state.viewportOnly) bits.push('within the map view')
  els.status.textContent =
    `${state.rows.length} ${state.rows.length === 1 ? 'museum' : 'museums'}${bits.length ? ' ' + bits.join(', ') : ''}.`
}

const entryFor = (id) => els.list.querySelector(`.entry[data-id="${CSS.escape(id)}"]`)

function syncActive() {
  for (const entry of els.list.querySelectorAll('.entry')) {
    entry.classList.toggle('is-active', entry.dataset.id === state.activeId)
  }
  for (const [id, marker] of markers) {
    marker.setStyle(id === state.activeId ? PIN_ACTIVE : PIN)
  }

  // A pin the filters have removed cannot be the selection: its halo would sit
  // on empty map and the URL would still name it.
  const marker = state.activeId ? markers.get(state.activeId) : null
  const active = marker && map && map.hasLayer(marker) ? marker : null
  if (active && map) {
    halo.setLatLng(active.getLatLng())
    if (!map.hasLayer(halo)) halo.addTo(map)
    active.bringToFront()
  } else if (halo && map && map.hasLayer(halo)) {
    map.removeLayer(halo)
  }
}

/** Roving tabindex: the list is two tab stops, not two hundred. */
function syncRoving() {
  const entries = [...els.list.querySelectorAll('.entry')]
  entries.forEach((entry, i) => {
    const on = i === state.cursor ? '0' : '-1'
    entry.querySelector('.entry__select')?.setAttribute('tabindex', on)
    entry.querySelector('a.entry__link')?.setAttribute('tabindex', on)
  })
}

function moveCursor(delta, { focus = true } = {}) {
  if (!state.rows.length) return
  const next = Math.min(Math.max(state.cursor + delta, 0), state.rows.length - 1)
  if (next === state.cursor) return
  state.cursor = next
  syncRoving()
  const m = state.rows[next]
  select(m.id, { scroll: true, focus })
}

function setCursorTo(index, { focus = true } = {}) {
  if (!state.rows.length) return
  state.cursor = Math.min(Math.max(index, 0), state.rows.length - 1)
  syncRoving()
  select(state.rows[state.cursor].id, { scroll: true, focus })
}

/* ---------------------------------------------------------- selection --- */

const POPUP_ROOM = 150   // vertical clearance a popup needs above its pin

const targetZoom = () => Math.max(map.getZoom(), 15)

/* A canvas renderer scales its whole surface during a zoom animation and only
   redraws when the animation ends, so every pin swells by the zoom factor and
   snaps back — measured at 16.8× across a city-wide fly. Under a step and a
   half that magnification is imperceptible and the movement is worth having;
   beyond it, placing the view outright looks deliberate where a swelling,
   popping zoom looks broken. */
const ANIMATABLE_ZOOM_STEP = 1.5

function moveTo(centre, zoom, { duration = 0.6 } = {}) {
  const far = Math.abs(zoom - map.getZoom()) > ANIMATABLE_ZOOM_STEP
  if (!animate || far) map.setView(centre, zoom, { animate: false })
  else map.flyTo(centre, zoom, { animate: true, duration, easeLinearity: 0.22 })
}

/** Where the map should centre so the pin sits below the middle and its popup
    has room above — one movement that lands correctly, rather than a centre
    followed by an auto-pan correction. */
function centreFor(latlng) {
  const z = targetZoom()
  return map.unproject(map.project(latlng, z).subtract([0, POPUP_ROOM / 2]), z)
}

function select(id, { pan = true, scroll = false, focus = false, center = false } = {}) {
  state.activeId = id
  const i = state.rows.findIndex((m) => m.id === id)
  if (i >= 0) { state.cursor = i; syncRoving() }
  syncActive()

  const marker = markers.get(id)
  if (marker && pan) {
    // With "on map only" on, the list is the map's contents — changing the
    // zoom would empty it out from under whoever just chose a row. Nudge the
    // view only as far as it takes to bring the pin inside.
    if (state.viewportOnly) {
      map.panInside(marker.getLatLng(), { padding: [48, POPUP_ROOM], animate })
    } else {
      moveTo(centreFor(marker.getLatLng()), targetZoom(), { duration: 0.7 })
    }
  }
  if (marker) {
    marker.openPopup()
    // The popup opens above the pin; make room for it without a second jump.
    if (!pan) map.panInside(marker.getLatLng(), { padding: [48, POPUP_ROOM], animate })
  }

  const entry = entryFor(id)
  if (scroll) {
    entry?.scrollIntoView({ block: center ? 'center' : 'nearest', behavior: animate ? 'smooth' : 'auto' })
  }
  if (focus) entry?.querySelector('.entry__select')?.focus({ preventScroll: true })
  writeUrl()
}

els.list.addEventListener('click', (e) => {
  if (e.target.closest('a')) return // let the outbound link through
  const entry = e.target.closest('.entry')
  if (entry) select(entry.dataset.id)
})

els.list.addEventListener('keydown', (e) => {
  const entry = e.target.closest('.entry')
  if (!entry) return
  const at = state.rows.findIndex((m) => m.id === entry.dataset.id)
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); state.cursor = at; moveCursor(1); break
    case 'ArrowUp':   e.preventDefault(); state.cursor = at; moveCursor(-1); break
    case 'Home':      e.preventDefault(); setCursorTo(0); break
    case 'End':       e.preventDefault(); setCursorTo(state.rows.length - 1); break
    case 'PageDown':  e.preventDefault(); state.cursor = at; moveCursor(10); break
    case 'PageUp':    e.preventDefault(); state.cursor = at; moveCursor(-10); break
  }
})

/* ---------------------------------------------------------------- map --- */

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    // Continuous zoom rather than quarter steps, and a slower wheel, so the
    // map glides instead of clicking between stops.
    zoomSnap: 0,
    zoomDelta: 0.6,
    wheelPxPerZoomLevel: 130,
    wheelDebounceTime: 20,
    zoomAnimation: true,
    fadeAnimation: true,
    inertia: true,
    easeLinearity: 0.22,
    // A generous canvas margin: at the default 10% the pins pop in at the edge
    // of the frame while panning.
    preferCanvas: true,
    renderer: L.canvas({ padding: 0.6 }),
  }).setView([40.7128, -73.96], 11)

  // The city is drawn, not tiled: borough coastline from NYC Planning,
  // simplified to 44KB, in its own pane beneath the street tiles so streets —
  // when they appear — read as linework laid over the land.
  map.createPane('land')
  map.getPane('land').style.zIndex = 150

  fetch('../data/boroughs.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((geo) => {
      L.geoJSON(geo, {
        pane: 'land',
        interactive: false,
        style: { fillColor: LAND, fillOpacity: 1, color: COAST, weight: 1, lineJoin: 'round' },
      }).addTo(map)
    })
    .catch((err) => console.warn('museo: borough outlines unavailable', err))

  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    opacity: 0,
    keepBuffer: 4,
    updateWhenZooming: false,
    attribution:
      'Boroughs: NYC Planning · Streets: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  const streetOpacity = () => {
    const z = map.getZoom()
    const t = Math.min(1, Math.max(0, (z - STREETS_FROM) / (STREETS_FULL - STREETS_FROM)))
    streets.setOpacity(t * STREETS_MAX_OPACITY)
  }
  map.on('zoomend', streetOpacity)
  streetOpacity()

  halo = L.circleMarker([0, 0], { ...HALO })

  for (const m of state.museums) {
    const marker = L.circleMarker([m.lat, m.lng], { ...PIN })

    marker.bindPopup(
      `<div class="pop">
         <div class="pop__name">${escapeHtml(m.name)}</div>
         <div class="pop__meta">${escapeHtml(m.address)}</div>
         <div class="pop__foot">
           <span class="t-label">${escapeHtml(m.borough)} &middot; ${escapeHtml(m.category)}</span>
           ${m.url
             ? `<a class="link t-small" href="${escapeHtml(m.url)}" target="_blank"
                   rel="noopener noreferrer">${escapeHtml(hostOf(m.url))} &#8599;</a>`
             : '<span class="t-small u-quiet">No website</span>'}
         </div>
       </div>`,
      { closeButton: false, offset: [0, -10], autoPan: false },
    )

    marker.on('click', () => select(m.id, { pan: false, scroll: true, center: true }))
    marker.on('mouseover', () => {
      if (m.id !== state.activeId) marker.setStyle(PIN_HOVER)
      entryFor(m.id)?.classList.add('is-peeked')
    })
    marker.on('mouseout', () => {
      if (m.id !== state.activeId) marker.setStyle(PIN)
      entryFor(m.id)?.classList.remove('is-peeked')
    })

    markers.set(m.id, marker)
  }

  map.on('moveend', () => {
    if (state.viewportOnly) { renderIndex(); writeUrl() }
  })
}

function syncMarkers() {
  const shown = new Set(state.museums.filter((m) => matches(m)).map((m) => m.id))
  for (const [id, marker] of markers) {
    const on = shown.has(id)
    if (on && !map.hasLayer(marker)) marker.addTo(map)
    if (!on && map.hasLayer(marker)) map.removeLayer(marker)
  }
}

function fitToResults() {
  const rows = state.museums.filter((m) => matches(m))
  if (!rows.length) return
  const bounds = L.latLngBounds(rows.map((m) => [m.lat, m.lng]))
  const zoom = Math.min(map.getBoundsZoom(bounds, false, L.point(32, 32)), 15)
  moveTo(bounds.getCenter(), zoom)
}

/* ------------------------------------------------------------ controls --- */

function buildSort() {
  for (const [key, { label }] of Object.entries(SORTS)) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'toggle'
    btn.dataset.sort = key
    btn.setAttribute('role', 'radio')
    btn.setAttribute('aria-checked', String(state.sort === key))
    btn.textContent = label
    btn.addEventListener('click', () => chooseSort(key))
    sortToggles.set(key, btn)
    els.sortOptions.append(btn)
  }
}

function chooseSort(key) {
  if (key === 'near' && !state.origin) {
    locate()
    return
  }
  state.sort = key
  notice('')
  update()
}

/** Ask the browser where we are. The order only changes once it answers, so a
    refused or slow prompt leaves the index exactly as it was. */
function locate() {
  if (!navigator.geolocation) {
    notice('This browser cannot share a location.')
    return
  }
  notice('Finding you…')
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      state.origin = { lat: coords.latitude, lng: coords.longitude }
      state.sort = 'near'
      showHere()
      const nearest = Math.min(...state.museums.map((m) => milesBetween(state.origin, m)))
      notice(nearest > 50 ? 'You are some way from New York — distances are as the crow flies.' : '')
      update()
    },
    (err) => {
      notice(
        err.code === err.PERMISSION_DENIED
          ? 'Location permission was declined, so the index stays in alphabetical order.'
          : 'Your location is not available right now.',
      )
      syncToggles()
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  )
}

function notice(text) {
  els.notice.textContent = text
  els.notice.hidden = !text
}

/** A hollow marker, so it cannot be mistaken for one of the museums. */
function showHere() {
  if (!map || !state.origin) return
  const at = [state.origin.lat, state.origin.lng]
  if (hereMarker) hereMarker.setLatLng(at)
  else {
    hereMarker = L.circleMarker(at, {
      radius: 5, weight: 2, color: INK, fillColor: PAPER, fillOpacity: 1, interactive: false,
    })
  }
  if (!map.hasLayer(hereMarker)) hereMarker.addTo(map)
  // Bring it into view only if it is not already there, and never change the
  // zoom: the map's framing is the reader's, not ours.
  map.panInside(at, { padding: [48, 48], animate })
}

function buildFilters() {
  for (const b of BOROUGHS) {
    els.boroughFilters.append(makeToggle('borough', b, () => toggleValue(state.boroughs, b, { refit: true })))
  }
  const cats = [...new Set(state.museums.map((m) => m.category))].sort()
  for (const c of cats) {
    els.categoryFilters.append(makeToggle('category', c, () => toggleValue(state.categories, c, { refit: false })))
  }
}

function makeToggle(facet, label, onClick) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'toggle'
  btn.dataset.value = label
  btn.setAttribute('aria-pressed', 'false')
  btn.innerHTML = `${escapeHtml(label)}<span class="tally" aria-hidden="true"></span>`
  btn.addEventListener('click', () => onClick())
  toggles[facet].set(label, btn)
  return btn
}

/**
 * Each facet counts what choosing it would actually yield, given every OTHER
 * filter. A count of zero means the option is a dead end, so it is disabled
 * rather than left to look available.
 */
function syncToggles() {
  for (const [facet, key, set] of [
    ['borough', 'borough', state.boroughs],
    ['category', 'category', state.categories],
  ]) {
    const pool = state.museums.filter((m) => matches(m, facet))
    for (const [value, btn] of toggles[facet]) {
      const n = pool.filter((m) => m[key] === value).length
      const on = set.has(value)
      btn.setAttribute('aria-pressed', String(on))
      btn.querySelector('.tally').textContent = n
      const dead = n === 0 && !on
      btn.disabled = dead
      btn.classList.toggle('is-empty', dead)
      btn.setAttribute('aria-label', `${value}, ${n} ${n === 1 ? 'museum' : 'museums'}`)
    }
  }
  els.viewportOnly.setAttribute('aria-pressed', String(state.viewportOnly))
  for (const [key, btn] of sortToggles) btn.setAttribute('aria-checked', String(state.sort === key))
  const dirty = !!(state.query || state.boroughs.size || state.categories.size ||
                   state.viewportOnly || state.sort !== 'az')
  els.reset.disabled = !dirty
  els.reset.hidden = !dirty
  els.searchClear.hidden = !state.query
}

function toggleValue(set, value, { refit }) {
  set.has(value) ? set.delete(value) : set.add(value)
  update({ refit })
}

function update({ refit = false, keepScroll = false } = {}) {
  // renderIndex replaces every row, so anyone reading the index by keyboard
  // would be dropped back to the top of the document. Put them back.
  const hadFocus = els.list.contains(document.activeElement)

  // A selection the filters have excluded is no longer a selection.
  if (state.activeId) {
    const chosen = state.museums.find((m) => m.id === state.activeId)
    if (!chosen || !matches(chosen)) {
      state.activeId = null
      map?.closePopup()
    }
  }

  syncToggles()
  syncMarkers()
  if (refit) fitToResults()
  renderIndex()
  if (!keepScroll) els.scroll.scrollTo({ top: 0 })

  if (hadFocus && state.cursor >= 0) {
    const row = els.list.querySelectorAll('.entry')[state.cursor]
    row?.querySelector('.entry__select')?.focus({ preventScroll: true })
  }
  writeUrl()
}

let searchTimer
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    state.query = els.search.value.trim()
    update()
  }, 90)
})

els.search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (els.search.value) { els.search.value = ''; state.query = ''; update() }
    else els.search.blur()
  }
  if (e.key === 'ArrowDown' && state.rows.length) { e.preventDefault(); setCursorTo(0) }
  if (e.key === 'Enter' && state.rows.length) { e.preventDefault(); setCursorTo(0) }
})

els.searchClear.addEventListener('click', () => {
  els.search.value = ''
  state.query = ''
  update()
  els.search.focus()
})

els.viewportOnly.addEventListener('click', () => {
  state.viewportOnly = !state.viewportOnly
  update()
})

els.reset.addEventListener('click', () => {
  reset()
  els.search.focus()
})

function reset() {
  state.query = ''
  state.sort = 'az'
  notice('')
  if (hereMarker && map?.hasLayer(hereMarker)) map.removeLayer(hereMarker)
  state.boroughs.clear()
  state.categories.clear()
  state.viewportOnly = false
  state.activeId = null
  els.search.value = ''
  map?.closePopup()
  update({ refit: true })
}

els.empty.querySelector('.empty__reset')?.addEventListener('click', () => {
  reset()
  els.search.focus()
})

/* Type-anywhere: "/" jumps to the field the way a reader reaches for an index. */
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    els.search.focus()
    els.search.select()
  }
  if (e.key === 'Escape' && !typing && state.activeId) {
    state.activeId = null
    map?.closePopup()
    syncActive()
    writeUrl()
  }
})

/* --------------------------------------------------------- modality --- */

/* Leaflet focuses its container on every pointer press, and Chrome counts that
   programmatic focus as :focus-visible — so a mouse user got a ring round the
   whole map each time they touched it. Record how the last input arrived, and
   let the stylesheet show the map's focus only after a key. Capture phase, so
   this runs before Leaflet's own handlers move focus. */
const setModality = (how) => { document.documentElement.dataset.input = how }
document.addEventListener('pointerdown', () => setModality('pointer'), true)
document.addEventListener('keydown', () => setModality('keyboard'), true)

/* --------------------------------------------------------------- boot --- */

function fail(message) {
  els.list.replaceChildren()
  els.empty.hidden = false
  els.empty.innerHTML =
    `<span class="t-label">${escapeHtml(message)}</span>` +
    '<button type="button" class="empty__reset toggle toggle--plain">Try again</button>'
  els.empty.querySelector('.empty__reset').addEventListener('click', () => location.reload())
  els.count.textContent = '—'
  els.countLabel.textContent = 'Unavailable'
}

try {
  const res = await fetch('../data/museums.json')
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  state.museums = (await res.json())
    .filter((m) => typeof m.lat === 'number' && typeof m.lng === 'number')
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  if (!state.museums.length) throw new Error('no records')
  els.colophonCount.textContent = state.museums.length

  document.body.classList.remove('is-loading')
  readUrl()
  buildSort()
  buildFilters()
  initMap()
  if (state.sort === 'near' && !state.origin) locate()
  syncToggles()
  syncMarkers()
  renderIndex()

  if (state.activeId && markers.has(state.activeId)) {
    select(state.activeId, { scroll: true })
  } else {
    state.activeId = null
    fitToResults()
  }
  writeUrl()
} catch (err) {
  console.error('museo:', err)
  document.body.classList.remove('is-loading')
  fail('The index could not be loaded')
}
