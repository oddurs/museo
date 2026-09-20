const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']

const state = {
  museums: [],
  query: '',
  boroughs: new Set(),
  categories: new Set(),
  viewportOnly: false,
  activeId: null,
}

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
  boroughFilters: document.getElementById('borough-filters'),
  categoryFilters: document.getElementById('category-filters'),
  viewportOnly: document.getElementById('viewport-only'),
  count: document.getElementById('count'),
  countLabel: document.getElementById('count-label'),
  reset: document.getElementById('reset'),
}

const PIN = { radius: 3.5, weight: 1.5 }
const PIN_ACTIVE = { radius: 6.5, weight: 2 }

const markers = new Map()
let map

// ---------- data ----------

const res = await fetch('../data/museums.json')
if (!res.ok) throw new Error(`could not load museums.json (${res.status})`)
state.museums = (await res.json())
  .filter((m) => typeof m.lat === 'number' && typeof m.lng === 'number')
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

// ---------- text ----------

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

// ---------- filtering ----------

const haystack = (m) => norm([m.name, m.borough, m.neighborhood, m.address, m.category].join(' '))

function matchesFilters(m) {
  if (state.boroughs.size && !state.boroughs.has(m.borough)) return false
  if (state.categories.size && !state.categories.has(m.category)) return false
  return terms().every((term) => haystack(m).includes(term))
}

function visible() {
  const out = state.museums.filter(matchesFilters)
  if (!state.viewportOnly || !map) return out
  const bounds = map.getBounds()
  return out.filter((m) => bounds.contains([m.lat, m.lng]))
}

// Pricing and opening hours land here later; render whatever exists today.
function facts(m) {
  const bits = [m.admission, m.hoursSummary].filter(Boolean)
  return bits.length
    ? `<p class="entry__meta t-small">${escapeHtml(bits.join(' · '))}</p>`
    : ''
}

// ---------- index ----------

function renderIndex() {
  const rows = visible()

  els.list.replaceChildren(
    ...rows.map((m, i) => {
      const li = document.createElement('li')
      li.innerHTML = `
        <article class="entry" data-id="${escapeHtml(m.id)}" tabindex="0" role="button"
                 aria-label="${escapeHtml(m.name)} — show on map">
          <span class="entry__no t-numeral">${ordinal(i + 1)}</span>
          <div class="entry__body">
            <h2 class="entry__name t-heading">${highlight(m.name)}</h2>
            <p class="entry__meta t-small">${
              m.neighborhood ? highlight(m.neighborhood) + ' &middot; ' : ''
            }${highlight(street(m.address))}</p>
            <a class="entry__link t-fine" href="${escapeHtml(m.url)}"
               target="_blank" rel="noopener noreferrer">${escapeHtml(hostOf(m.url))} &#8599;</a>
            ${facts(m)}
          </div>
          <span class="entry__class">
            <span class="entry__borough t-label">${escapeHtml(m.borough)}</span>
            <span class="entry__discipline t-label">${escapeHtml(m.category)}</span>
          </span>
        </article>`
      return li
    }),
  )

  els.empty.hidden = rows.length > 0
  els.count.textContent = rows.length
  els.countLabel.textContent =
    rows.length === state.museums.length
      ? rows.length === 1 ? 'Museum' : 'Museums'
      : `of ${state.museums.length}`

  syncActive()
}

const entryFor = (id) => els.list.querySelector(`.entry[data-id="${CSS.escape(id)}"]`)

function syncActive() {
  for (const entry of els.list.querySelectorAll('.entry')) {
    entry.classList.toggle('is-active', entry.dataset.id === state.activeId)
  }
  for (const [id, marker] of markers) {
    marker.setStyle(id === state.activeId ? PIN_ACTIVE : PIN)
    if (id === state.activeId) marker.bringToFront()
  }
}

function select(id, { pan = true, scroll = false } = {}) {
  state.activeId = id
  syncActive()
  const marker = markers.get(id)
  if (marker) {
    if (pan) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), { animate: true })
    marker.openPopup()
  }
  if (scroll) entryFor(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

els.list.addEventListener('click', (e) => {
  if (e.target.closest('a')) return // let the outbound link through
  const entry = e.target.closest('.entry')
  if (entry) select(entry.dataset.id)
})

els.list.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return
  const entry = e.target.closest('.entry')
  if (!entry || e.target.tagName === 'A') return
  e.preventDefault()
  select(entry.dataset.id)
})

// ---------- map ----------

function initMap() {
  map = L.map('map', { zoomControl: true, preferCanvas: true, zoomSnap: 0.25 })
    .setView([40.7128, -73.96], 11)

  // OpenStreetMap, stripped of color and flattened by CSS so the map reads as
  // part of the achromatic system. (Keyless tile hosts that ship a quiet
  // basemap no longer exist — CARTO and Stadia both watermark now.)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  for (const m of state.museums) {
    const marker = L.circleMarker([m.lat, m.lng], {
      ...PIN,
      color: '#000000',
      fillColor: '#000000',
      fillOpacity: 1,
      opacity: 1,
    })

    marker.bindPopup(
      `<div class="pop">
         <div class="pop__name">${escapeHtml(m.name)}</div>
         <div class="pop__meta">${escapeHtml(m.address)}</div>
         <div class="pop__foot">
           <span class="t-label">${escapeHtml(m.borough)} &middot; ${escapeHtml(m.category)}</span>
           <a class="link t-small" href="${escapeHtml(m.url)}" target="_blank"
              rel="noopener noreferrer">${escapeHtml(hostOf(m.url))} &#8599;</a>
         </div>
       </div>`,
      { closeButton: false, offset: [0, -4], autoPanPadding: [24, 24] },
    )

    marker.on('click', () => select(m.id, { pan: false, scroll: true }))
    markers.set(m.id, marker)
  }

  map.on('moveend', () => {
    if (state.viewportOnly) renderIndex()
  })

  syncMarkers()
  fitToResults()
}

function syncMarkers() {
  const shown = new Set(state.museums.filter(matchesFilters).map((m) => m.id))
  for (const [id, marker] of markers) {
    const on = shown.has(id)
    if (on && !map.hasLayer(marker)) marker.addTo(map)
    if (!on && map.hasLayer(marker)) map.removeLayer(marker)
  }
}

function fitToResults() {
  const rows = state.museums.filter(matchesFilters)
  if (!rows.length) return
  map.fitBounds(L.latLngBounds(rows.map((m) => [m.lat, m.lng])), {
    padding: [32, 32],
    maxZoom: 15,
  })
}

// ---------- controls ----------

function buildFilters() {
  const tally = (key) =>
    state.museums.reduce((acc, m) => ((acc[m[key]] = (acc[m[key]] || 0) + 1), acc), {})

  const boroughTally = tally('borough')
  for (const b of BOROUGHS) {
    els.boroughFilters.append(
      makeToggle(b, boroughTally[b] ?? 0, () => toggleValue(state.boroughs, b, { refit: true })),
    )
  }

  const categoryTally = tally('category')
  for (const c of Object.keys(categoryTally).sort()) {
    els.categoryFilters.append(
      makeToggle(c, categoryTally[c], () => toggleValue(state.categories, c, { refit: false })),
    )
  }
}

function makeToggle(label, count, onClick) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'toggle'
  btn.dataset.value = label
  btn.setAttribute('aria-pressed', 'false')
  btn.innerHTML = `${escapeHtml(label)}<span class="tally">${count}</span>`
  btn.addEventListener('click', () => onClick(btn))
  return btn
}

function toggleValue(set, value, { refit }) {
  set.has(value) ? set.delete(value) : set.add(value)
  syncToggles()
  update({ refit })
}

function syncToggles() {
  for (const btn of els.boroughFilters.children) {
    btn.setAttribute('aria-pressed', String(state.boroughs.has(btn.dataset.value)))
  }
  for (const btn of els.categoryFilters.children) {
    btn.setAttribute('aria-pressed', String(state.categories.has(btn.dataset.value)))
  }
  els.viewportOnly.setAttribute('aria-pressed', String(state.viewportOnly))
}

function update({ refit = false } = {}) {
  syncMarkers()
  if (refit) fitToResults()
  renderIndex()
  els.list.scrollTo({ top: 0 })
}

els.search.addEventListener('input', () => {
  state.query = els.search.value.trim()
  update()
})

els.viewportOnly.addEventListener('click', () => {
  state.viewportOnly = !state.viewportOnly
  syncToggles()
  renderIndex()
  els.list.scrollTo({ top: 0 })
})

els.reset.addEventListener('click', () => {
  state.query = ''
  state.boroughs.clear()
  state.categories.clear()
  state.viewportOnly = false
  state.activeId = null
  els.search.value = ''
  map?.closePopup()
  syncToggles()
  update({ refit: true })
})

// ---------- go ----------

buildFilters()
initMap()
renderIndex()
