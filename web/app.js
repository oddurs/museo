const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']

const BOROUGH_COLOR = {
  Manhattan: 'var(--manhattan)',
  Brooklyn: 'var(--brooklyn)',
  Queens: 'var(--queens)',
  Bronx: 'var(--bronx)',
  'Staten Island': 'var(--statenisland)',
}

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
  reset: document.getElementById('reset'),
}

const markers = new Map()
let map
let cssColor // resolves CSS custom properties to real colors for canvas markers

// ---------- data ----------

const res = await fetch('../data/museums.json')
if (!res.ok) throw new Error(`could not load museums.json (${res.status})`)
state.museums = (await res.json())
  .filter((m) => typeof m.lat === 'number' && typeof m.lng === 'number')
  .sort((a, b) => a.name.localeCompare(b.name))

// ---------- helpers ----------

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

function haystack(m) {
  return norm([m.name, m.borough, m.neighborhood, m.address, m.category].join(' '))
}

function matchesText(m) {
  if (!state.query) return true
  // every whitespace-separated term must appear somewhere in the record
  return norm(state.query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack(m).includes(term))
}

function matchesFilters(m) {
  if (state.boroughs.size && !state.boroughs.has(m.borough)) return false
  if (state.categories.size && !state.categories.has(m.category)) return false
  return matchesText(m)
}

function visible() {
  let out = state.museums.filter(matchesFilters)
  if (state.viewportOnly && map) {
    const b = map.getBounds()
    out = out.filter((m) => b.contains([m.lat, m.lng]))
  }
  return out
}

function highlight(text) {
  const terms = norm(state.query).split(/\s+/).filter(Boolean)
  if (!terms.length) return escapeHtml(text)
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi')
  // match against the normalized string but slice from the original so
  // accented characters survive
  const flat = norm(text)
  let html = ''
  let last = 0
  for (const hit of flat.matchAll(re)) {
    html += escapeHtml(text.slice(last, hit.index))
    html += `<mark>${escapeHtml(text.slice(hit.index, hit.index + hit[0].length))}</mark>`
    last = hit.index + hit[0].length
  }
  return html + escapeHtml(text.slice(last))
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Pricing and hours land here later; render whatever exists today.
function facts(m) {
  const bits = []
  if (m.admission) bits.push(m.admission)
  if (m.hoursSummary) bits.push(m.hoursSummary)
  return bits.length ? `<span class="facts">${escapeHtml(bits.join(' · '))}</span>` : ''
}

// ---------- list ----------

function renderList() {
  const rows = visible()
  els.list.replaceChildren(
    ...rows.map((m) => {
      const li = document.createElement('li')
      li.innerHTML = `
        <article class="card" tabindex="0" role="button" data-id="${m.id}"
                 style="--swatch:${BOROUGH_COLOR[m.borough] ?? 'var(--line)'}"
                 aria-label="${escapeHtml(m.name)} — show on map">
          <h2>${highlight(m.name)}</h2>
          <p class="where">${highlight(m.borough)}${m.neighborhood ? ' · ' + highlight(m.neighborhood) : ''}</p>
          <p class="addr">${highlight(m.address)}</p>
          <p class="row">
            <span class="tag">${escapeHtml(m.category)}</span>
            <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(hostOf(m.url))} ↗</a>
            ${facts(m)}
          </p>
        </article>`
      return li
    }),
  )
  els.empty.hidden = rows.length > 0
  els.count.textContent = `${rows.length} of ${state.museums.length}`
  syncActive()
  return rows
}

function cardFor(id) {
  return els.list.querySelector(`.card[data-id="${CSS.escape(id)}"]`)
}

function syncActive() {
  for (const card of els.list.querySelectorAll('.card')) {
    card.classList.toggle('is-active', card.dataset.id === state.activeId)
  }
}

function select(id, { pan = true, scroll = true } = {}) {
  state.activeId = id
  syncActive()
  const marker = markers.get(id)
  if (marker) {
    if (pan) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), { animate: true })
    marker.openPopup()
  }
  if (scroll) cardFor(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

els.list.addEventListener('click', (e) => {
  if (e.target.closest('a')) return // let the outbound link through
  const card = e.target.closest('.card')
  if (card) select(card.dataset.id, { scroll: false })
})

els.list.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return
  const card = e.target.closest('.card')
  if (!card || e.target.tagName === 'A') return
  e.preventDefault()
  select(card.dataset.id, { scroll: false })
})

// ---------- map ----------

function initMap() {
  map = L.map('map', { zoomControl: true, preferCanvas: true, zoomSnap: 0.25 }).setView(
    [40.7128, -73.96],
    11,
  )

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  const probe = document.createElement('div')
  document.body.appendChild(probe)
  cssColor = (varRef) => {
    probe.style.color = varRef
    return getComputedStyle(probe).color
  }

  for (const m of state.museums) {
    const color = cssColor(BOROUGH_COLOR[m.borough] ?? 'var(--ink-3)')
    const marker = L.circleMarker([m.lat, m.lng], {
      radius: 6,
      weight: 2,
      color,
      fillColor: color,
      fillOpacity: 0.55,
    })
    marker.bindPopup(
      `<b>${escapeHtml(m.name)}</b><br>
       <span class="pop-where">${escapeHtml(m.address)}</span><br>
       <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(hostOf(m.url))} ↗</a>`,
    )
    marker.on('click', () => {
      state.activeId = m.id
      syncActive()
      cardFor(m.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    markers.set(m.id, marker)
  }

  map.on('moveend', () => {
    if (state.viewportOnly) renderList()
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
  const bounds = L.latLngBounds(rows.map((m) => [m.lat, m.lng]))
  map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 })
}

// ---------- filters ----------

function buildFilters() {
  const counts = (key) =>
    state.museums.reduce((acc, m) => ((acc[m[key]] = (acc[m[key]] || 0) + 1), acc), {})

  const boroughCounts = counts('borough')
  for (const b of BOROUGHS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'chip'
    btn.setAttribute('aria-pressed', 'false')
    btn.dataset.borough = b
    btn.style.setProperty('--swatch', BOROUGH_COLOR[b])
    btn.innerHTML = `<span class="dot"></span>${b} <span class="n">${boroughCounts[b] ?? 0}</span>`
    btn.addEventListener('click', () => toggle(state.boroughs, b, btn, { refit: true }))
    els.boroughFilters.append(btn)
  }

  const categoryCounts = counts('category')
  for (const c of Object.keys(categoryCounts).sort()) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'chip'
    btn.setAttribute('aria-pressed', 'false')
    btn.innerHTML = `${c} <span class="n">${categoryCounts[c]}</span>`
    btn.addEventListener('click', () => toggle(state.categories, c, btn, { refit: false }))
    els.categoryFilters.append(btn)
  }
}

function toggle(set, value, btn, { refit }) {
  if (set.has(value)) set.delete(value)
  else set.add(value)
  btn.setAttribute('aria-pressed', String(set.has(value)))
  update({ refit })
}

function update({ refit = false } = {}) {
  syncMarkers()
  if (refit) fitToResults()
  renderList()
  document.querySelector('.list-pane')?.scrollTo({ top: 0 })
}

els.search.addEventListener('input', () => {
  state.query = els.search.value.trim()
  update()
})

els.viewportOnly.addEventListener('change', () => {
  state.viewportOnly = els.viewportOnly.checked
  renderList()
})

els.reset.addEventListener('click', () => {
  state.query = ''
  state.boroughs.clear()
  state.categories.clear()
  state.viewportOnly = false
  state.activeId = null
  map?.closePopup()
  els.search.value = ''
  els.viewportOnly.checked = false
  for (const chip of document.querySelectorAll('.chip')) chip.setAttribute('aria-pressed', 'false')
  update({ refit: true })
})

// ---------- go ----------

buildFilters()
initMap()
renderList()
