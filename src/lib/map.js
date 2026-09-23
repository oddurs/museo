/**
 * The map engine.
 *
 * Deliberately not reactive. The view changes sixty times a second while
 * you drag, and a framework in that loop would mean a component update per
 * frame; instead `view` is a plain object, every write happens inside one
 * requestAnimationFrame, and nothing reads layout afterwards. Svelte owns
 * the panel and the card, which change when you do something. This owns
 * the city, which changes when the pointer moves.
 */

import { M, VIEW, PROJ } from './city.js'
import { decodeStreets, drawStreets, drawLabels, drawWater } from './cartography.js'

const NS = 'http://www.w3.org/2000/svg'
const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); e.setAttribute('class', cls); return e }
const dotAt = (m) => `M${m.x} ${m.y}l0 0`
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export const view = { k: 1, x: 0, y: 0 }
export const projectPoint = (lat, lng) => ({
  x: PROJ.sx * lng + PROJ.bx,
  y: PROJ.sy * ((Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI) + PROJ.by,
})

let cv, ctx, svg, scene, pinsG, sepsG, dotsG, hitsG
let scaleBar, scaleTxt, panelEl, cardEl, onSelect, onPeek
let glow, halo, youRing, youDot
const pinOf = new Map(), sepOf = new Map(), hitOf = new Map()
const LAND_PATHS = []
let chosen = null, here = null, mounted = false

/* ── paint ─────────────────────────────────────────────────────── */

let dpr = 1, cw = 0, ch = 0, moving = false, settling = 0
let cssCache = {}
const css = (v) => (cssCache[v] ??= getComputedStyle(document.documentElement).getPropertyValue(v).trim())

function sizeCanvas() {
  dpr = moving ? 1 : Math.min(2, devicePixelRatio || 1)
  cw = cv.clientWidth; ch = cv.clientHeight
  remeasure()
  cv.width = Math.round(cw * dpr)
  cv.height = Math.round(ch * dpr)
  commit()                       // synchronous: resizing clears it
}

function setMoving(on) {
  clearTimeout(settling)
  if (on) { if (!moving) { moving = true; sizeCanvas() } }
  else settling = setTimeout(() => { if (moving) { moving = false; sizeCanvas() } }, 90)
}

let queued = false
function paint() {
  if (queued || !mounted) return
  queued = true
  requestAnimationFrame(() => { queued = false; commit() })
}

function commit() {
  scene.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`)
  if (chosen) halo.setAttribute('r', 21 / view.k)
  if (here) youRing.setAttribute('r', 11 / view.k)
  updateScale()
  render()
}

function render() {
  const { k, x, y } = view
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = css('--water')
  ctx.fillRect(0, 0, cv.width, cv.height)

  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y)
  for (const b of LAND_PATHS) {
    ctx.fillStyle = lit && b.n === lit ? css('--land-hi') : css('--land')
    ctx.fill(b.p)
  }
  ctx.strokeStyle = css('--shore')
  ctx.lineWidth = 1 / k
  for (const b of LAND_PATHS) ctx.stroke(b.p)

  const labels = drawStreets(ctx, k, x, y, cw, ch)
  drawLabels(ctx, labels, k, x, y, dpr)
  const i = insets()
  drawWater(ctx, k, x, y, cw, ch, dpr, { l: i.l + 6, t: i.t, r: i.r, b: i.b + 18 })

  document.body.classList.toggle('close', k >= 5.2)
}

let lit = null
export function setLit(borough) { lit = borough; paint() }

/* ── the frame the map has to work in ──────────────────────────── */

let _insets = null, sw = 0, sh = 0
const remeasure = () => { _insets = null; sw = svg.clientWidth; sh = svg.clientHeight }
export const forgetInsets = () => { _insets = null }

function insets() {
  if (_insets) return _insets
  if (innerWidth <= 780) {
    const c = cardEl?.classList.contains('show') ? cardEl.offsetHeight + 16 : 0
    return (_insets = { l: 20, t: 20, r: 20, b: 20 + c })
  }
  const p = panelEl.getBoundingClientRect()
  return (_insets = { l: p.right + 28, t: 28, r: 28, b: 28 })
}

function boundsOf(list) {
  if (!list.length) return { x0: 0, y0: 0, x1: VIEW.w, y1: VIEW.h }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const m of list) {
    x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x)
    y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y)
  }
  return { x0, y0, x1, y1 }
}

function frame(b, { pad = 70, maxK = 9 } = {}) {
  const i = insets()
  const w = Math.max(80, sw - i.l - i.r)
  const h = Math.max(80, sh - i.t - i.b)
  // A single museum is framed at a fixed closeness, so the cross streets
  // read the same on a phone as on a desk.
  const point = b.x0 === b.x1 && b.y0 === b.y1
  const k = point ? maxK
    : Math.min(maxK, w / Math.max(1, b.x1 - b.x0 + pad * 2), h / Math.max(1, b.y1 - b.y0 + pad * 2))
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
  return { k, x: i.l + w / 2 - cx * k, y: i.t + h / 2 - cy * k }
}

const atPoint = (m) => frame({ x0: m.x, y0: m.y, x1: m.x, y1: m.y }, { pad: 27, maxK: 15 })

let anim = 0
function glide(to, ms = 640) {
  cancelAnimationFrame(anim)
  if (reduce()) { Object.assign(view, to); setMoving(false); paint(); return }
  const from = { ...view }, t0 = performance.now()
  setMoving(true)
  const step = (now) => {
    // a rAF timestamp can predate the performance.now() taken just before it
    const p = Math.min(1, Math.max(0, (now - t0) / ms))
    const e = 1 - Math.pow(1 - p, 3)
    view.k = from.k + (to.k - from.k) * e
    view.x = from.x + (to.x - from.x) * e
    view.y = from.y + (to.y - from.y) * e
    paint()
    if (p < 1) anim = requestAnimationFrame(step)
    else setMoving(false)
  }
  anim = requestAnimationFrame(step)
}

/* ── the scale ─────────────────────────────────────────────────── */

const METRES_PER_UNIT = (111320 * Math.cos((40.73 * Math.PI) / 180)) / PROJ.sx
const RUNGS = [
  [200, '200 ft'], [500, '500 ft'], [1000, '1000 ft'], [1320, '¼ mile'],
  [2640, '½ mile'], [5280, '1 mile'], [10560, '2 miles'],
  [26400, '5 miles'], [52800, '10 miles'],
]
let lastBar = -1, lastTxt = ''
function updateScale() {
  const pxPerFoot = view.k / (METRES_PER_UNIT * 3.28084)
  let pick = RUNGS[0]
  for (const r of RUNGS) { if (r[0] * pxPerFoot <= 96) pick = r; else break }
  const w = Math.round(pick[0] * pxPerFoot)
  if (w !== lastBar) scaleBar.style.width = (lastBar = w) + 'px'
  if (pick[1] !== lastTxt) scaleTxt.textContent = (lastTxt = pick[1])
}

/* ── mount ─────────────────────────────────────────────────────── */

export function mount(refs) {
  ({ canvas: cv, svg, scene, pins: pinsG, seps: sepsG, dots: dotsG, hits: hitsG,
     scaleBar, scaleTxt, panel: panelEl, card: cardEl, onSelect, onPeek } = refs)
  ctx = cv.getContext('2d')

  for (const b of refs.land) LAND_PATHS.push({ n: b.n, p: new Path2D(b.d) })

  youRing = mk('circle', 'you'); youRing.setAttribute('r', 0)
  youDot = mk('path', 'you-dot')
  glow = mk('path', 'glow')
  halo = mk('circle', 'halo'); halo.setAttribute('r', 0)
  sepsG.before(glow, halo)
  dotsG.append(youDot, youRing)

  for (const m of M) {
    const d = dotAt(m)
    const sep = mk('path', 'pin-sep'); sep.setAttribute('d', d)
    const dot = mk('path', 'pin'); dot.setAttribute('d', d); dot.dataset.id = m.i
    const hit = mk('path', 'pin-hit'); hit.setAttribute('d', d); hit.dataset.id = m.i
    hit.addEventListener('click', (e) => { e.stopPropagation(); onSelect(m.i) })
    hit.addEventListener('pointerenter', () => onPeek(m.i, true))
    hit.addEventListener('pointerleave', () => onPeek(m.i, false))
    sepsG.appendChild(sep); dotsG.appendChild(dot); hitsG.appendChild(hit)
    pinOf.set(m.i, dot); sepOf.set(m.i, sep); hitOf.set(m.i, hit)
  }

  wire()
  mounted = true
  sizeCanvas()
  Object.assign(view, frame(boundsOf(M)))
  paint()

  // The city draws first; the street network unpacks behind it.
  const unpack = () => decodeStreets().then(paint)
  'requestIdleCallback' in window ? requestIdleCallback(unpack, { timeout: 1200 }) : setTimeout(unpack, 80)
}

/* ── gestures ──────────────────────────────────────────────────── */

const fitK = () => frame(boundsOf(M)).k
function zoomAt(sx, sy, factor) {
  const k = Math.min(34, Math.max(fitK() * 0.85, view.k * factor))
  const wx = (sx - view.x) / view.k, wy = (sy - view.y) / view.k
  view.k = k; view.x = sx - wx * k; view.y = sy - wy * k
  paint()
}

let drag = null
function wire() {
  svg.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('pin-hit')) return
    setMoving(true)
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
    svg.setPointerCapture(e.pointerId)
    svg.classList.add('dragging')
    cancelAnimationFrame(anim)
  })
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return
    view.x = drag.vx + (e.clientX - drag.x)
    view.y = drag.vy + (e.clientY - drag.y)
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true
    paint()
  })
  const end = (e) => {
    if (drag && !drag.moved) onSelect(null)
    drag = null; svg.classList.remove('dragging'); setMoving(false)
    if (e?.pointerId != null) { try { svg.releasePointerCapture(e.pointerId) } catch {} }
  }
  svg.addEventListener('pointerup', end)
  svg.addEventListener('pointercancel', () => { drag = null; svg.classList.remove('dragging'); setMoving(false) })
  svg.addEventListener('wheel', (e) => {
    e.preventDefault()
    setMoving(true)
    const r = svg.getBoundingClientRect()
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016))
    setMoving(false)
  }, { passive: false })
}

export function zoomBy(f) { zoomAt(sw / 2, sh / 2, f) }

/* ── what the page tells it ────────────────────────────────────── */

export function setVisible(ids) {
  for (const [id, dot] of pinOf) {
    const vis = ids.has(id) ? '' : 'none'
    dot.style.display = vis
    sepOf.get(id).style.display = vis
    hitOf.get(id).style.display = vis
  }
}

export function peek(id, on) {
  const p = pinOf.get(id)
  if (p && id !== chosen) {
    p.style.stroke = on ? 'var(--pin-hover)' : ''
    p.style.strokeWidth = on ? '9.4px' : ''
  }
}

export function setChosen(id) {
  chosen = id
  for (const [mid, dot] of pinOf) {
    dot.style.stroke = ''; dot.style.strokeWidth = ''
    dot.classList.toggle('on', mid === id)
    sepOf.get(mid).classList.toggle('on', mid === id)
  }
  _insets = null                     // the card changes the room the map has
  if (!id) { halo.setAttribute('r', 0); paint(); return }
  const m = M.find((x) => x.i === id)
  halo.setAttribute('cx', m.x); halo.setAttribute('cy', m.y); halo.setAttribute('r', 21 / view.k)
  glow.setAttribute('d', dotAt(m))
  paint()
}

export function setHere(pos) {
  here = pos
  if (!pos) { youRing.setAttribute('r', 0); youDot.removeAttribute('d'); paint(); return }
  youDot.setAttribute('d', `M${pos.x} ${pos.y}l0 0`)
  youRing.setAttribute('cx', pos.x); youRing.setAttribute('cy', pos.y)
  youRing.setAttribute('r', 11 / view.k)
  paint()
}

export const fitTo = (list, ms = 640) => glide(frame(boundsOf(list)), ms)
export const flyTo = (m, ms = 780) => glide(atPoint(m), ms)
export const jumpTo = (m) => { Object.assign(view, atPoint(m)); paint() }

export function relayout() {
  cssCache = {}
  _insets = null
  sizeCanvas()
}
