
/* ── state ─────────────────────────────────────────────────────── */

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = (id) => document.getElementById(id);
const svg = el('map'), scene = el('scene'), pinsG = el('pins');
const cv = el('base'), ctx = cv.getContext('2d');
const listEl = el('list'), qEl = el('q'), segs = el('segs'), thumb = el('thumb');
const card = el('card');

let rows = M.slice();
let borough = null, query = '', chosen = null, cursor = -1;
let here = null;                 // {lat, lng, x, y} once you have said where
const pinOf = new Map();
let view = { k: 1, x: 0, y: 0 };

const LAND_PATHS = LAND.map((b) => ({ n: b.n, p: new Path2D(b.d) }));

/* ── pins ──────────────────────────────────────────────────────────
   Each pin is a zero-length path drawn with a round cap, so the dot
   you see is the stroke — and a non-scaling stroke holds its size
   through every zoom without the script touching it. */

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); e.setAttribute('class', cls); return e; };
const dotAt = (m) => `M${m.x} ${m.y}l0 0`;

const youRing = mk('circle', 'you');
const youDot = mk('path', 'you-dot');
youRing.setAttribute('r', 0);
pinsG.append(youDot, youRing);

const glow = mk('path', 'glow');
const halo = mk('circle', 'halo');
halo.setAttribute('r', 0);
pinsG.append(glow, halo);

for (const m of M) {
  const c = mk('path', 'pin');
  c.setAttribute('d', dotAt(m));
  c.dataset.id = m.i;
  c.addEventListener('click', (e) => { e.stopPropagation(); choose(m.i, { from: 'map' }); });
  c.addEventListener('pointerenter', () => peek(m.i, true));
  c.addEventListener('pointerleave', () => peek(m.i, false));
  pinsG.appendChild(c);
  pinOf.set(m.i, c);
}

/* ── canvas ────────────────────────────────────────────────────── */

/* While the map is moving, the city is drawn at one device pixel per CSS
   pixel instead of two. That is a quarter of the raster work for the one
   moment nobody is reading hairlines, and it costs one reallocation at
   each end of the gesture rather than anything per frame. It comes back
   at full resolution the instant you let go. */
let dpr = 1, cw = 0, ch = 0, moving = false;

function sizeCanvas() {
  dpr = moving ? 1 : Math.min(2, devicePixelRatio || 1);
  cw = cv.clientWidth; ch = cv.clientHeight;
  remeasure();
  cv.width = Math.round(cw * dpr);
  cv.height = Math.round(ch * dpr);
  commit();              // synchronous: resizing clears it, so refill it now
}

let settling = 0;
function setMoving(on) {
  clearTimeout(settling);
  if (on) { if (!moving) { moving = true; sizeCanvas(); } }
  else settling = setTimeout(() => { if (moving) { moving = false; sizeCanvas(); } }, 90);
}

/* Every write the view needs happens once, inside one frame. Pointer
   events only mark the view dirty; nothing touches the DOM until the
   browser asks for a frame, and nothing reads layout afterwards. */
let queued = false;
function paint() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; commit(); });
}

function commit() {
  scene.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  if (chosen) halo.setAttribute('r', 21 / view.k);
  if (here) youRing.setAttribute('r', 11 / view.k);
  updateScale();
  render3d();
}

function render3d() {
  const { k, x, y } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = css('--water');
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
  const lit = borough;
  for (const b of LAND_PATHS) {
    ctx.fillStyle = lit && b.n === lit ? css('--land-hi') : css('--land');
    ctx.fill(b.p);
  }
  ctx.strokeStyle = css('--shore');
  ctx.lineWidth = 1 / k;
  for (const b of LAND_PATHS) ctx.stroke(b.p);

  const labels = drawStreets(ctx, k, x, y, cw, ch);
  drawLabels(ctx, labels, k, x, y, dpr);
  const i = insets();
  drawWater(ctx, k, x, y, cw, ch, dpr, { l: i.l + 6, t: i.t, r: i.r, b: i.b + 18 });

  document.body.classList.toggle('close', k >= 5.2);
}

let cssCache = {};
const css = (v) => (cssCache[v] ??= getComputedStyle(document.documentElement).getPropertyValue(v).trim());

/* ── viewport ──────────────────────────────────────────────────── */

/* One map unit on the ground. The projection is Web Mercator, so a
   unit is a fixed number of metres at a given latitude; New York sits
   close enough to one parallel for a single figure to hold. */
const METRES_PER_UNIT = (111320 * Math.cos(40.73 * Math.PI / 180)) / 1706.2553;
const RUNGS = [
  [200, '200 ft'], [500, '500 ft'], [1000, '1000 ft'], [1320, '\u00bc mile'],
  [2640, '\u00bd mile'], [5280, '1 mile'], [10560, '2 miles'],
  [26400, '5 miles'], [52800, '10 miles'],
];

const scaleBar = el('scaleBar'), scaleTxt = el('scaleTxt');
let lastBar = -1, lastTxt = '';
function updateScale() {
  const pxPerFoot = view.k / (METRES_PER_UNIT * 3.28084);
  let pick = RUNGS[0];
  for (const r of RUNGS) { if (r[0] * pxPerFoot <= 96) pick = r; else break; }
  const w = Math.round(pick[0] * pxPerFoot);
  if (w !== lastBar) { scaleBar.style.width = (lastBar = w) + 'px'; }
  if (pick[1] !== lastTxt) { scaleTxt.textContent = (lastTxt = pick[1]); }
}

/* The part of the map nothing is sitting on. On a phone the card
   takes the bottom of the stage, so the museum it names has to be
   framed above it rather than underneath it. */
let _insets = null, sw = 0, sh = 0;
const remeasure = () => { _insets = null; sw = svg.clientWidth; sh = svg.clientHeight; };

function insets() {
  if (_insets) return _insets;
  if (innerWidth <= 780) {
    const c = card.classList.contains('show') ? card.offsetHeight + 16 : 0;
    return (_insets = { l: 20, t: 20, r: 20, b: 20 + c });
  }
  const p = el('panel').getBoundingClientRect();
  return (_insets = { l: p.right + 28, t: 28, r: 28, b: 28 });
}

function apply() { paint(); }

function boundsOf(list) {
  if (!list.length) return { x0: 0, y0: 0, x1: VIEW.w, y1: VIEW.h };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of list) {
    x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x);
    y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y);
  }
  return { x0, y0, x1, y1 };
}

function frame(b, { pad = 70, maxK = 9 } = {}) {
  const i = insets();
  const w = Math.max(80, sw - i.l - i.r);
  const h = Math.max(80, sh - i.t - i.b);
  // A single museum is framed at a fixed closeness, so the cross
  // streets read the same on a phone as on a desk. Only a spread of
  // them has to be fitted to whatever room there is.
  const point = b.x0 === b.x1 && b.y0 === b.y1;
  const k = point ? maxK
    : Math.min(maxK, w / Math.max(1, b.x1 - b.x0 + pad * 2), h / Math.max(1, b.y1 - b.y0 + pad * 2));
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { k, x: i.l + w / 2 - cx * k, y: i.t + h / 2 - cy * k };
}

let anim = 0;
function glide(to, ms = 640) {
  cancelAnimationFrame(anim);
  if (reduce) { view = to; setMoving(false); apply(); return; }
  const from = { ...view }, t0 = performance.now();
  setMoving(true);
  const step = (now) => {
    const p = Math.min(1, Math.max(0, (now - t0) / ms));
    const e = 1 - Math.pow(1 - p, 3);
    view = { k: from.k + (to.k - from.k) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
    apply();
    if (p < 1) anim = requestAnimationFrame(step);
    else setMoving(false);
  };
  anim = requestAnimationFrame(step);
}

const fitK = () => frame(boundsOf(M)).k;
function zoomAt(sx, sy, factor) {
  const k = Math.min(34, Math.max(fitK() * 0.85, view.k * factor));
  const wx = (sx - view.x) / view.k, wy = (sy - view.y) / view.k;
  view = { k, x: sx - wx * k, y: sy - wy * k };
  apply();
}

let drag = null;
svg.addEventListener('pointerdown', (e) => {
  if (e.target.classList.contains('pin')) return;
  setMoving(true);
  drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  svg.setPointerCapture(e.pointerId);
  svg.classList.add('dragging');
  cancelAnimationFrame(anim);
});
svg.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.x = drag.vx + (e.clientX - drag.x);
  view.y = drag.vy + (e.clientY - drag.y);
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
  apply();
});
const endDrag = (e) => {
  if (drag && !drag.moved) choose(null);
  drag = null; svg.classList.remove('dragging'); setMoving(false);
  if (e?.pointerId != null) { try { svg.releasePointerCapture(e.pointerId); } catch {} }
};
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', () => { drag = null; svg.classList.remove('dragging'); setMoving(false); });

svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  setMoving(true);
  const r = svg.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
  setMoving(false);            // debounced: a wheel is a run of events
}, { passive: false });

el('zin').addEventListener('click', () => zoomAt(sw / 2, sh / 2, 1.6));
el('zout').addEventListener('click', () => zoomAt(sw / 2, sh / 2, 1 / 1.6));

/* ── where you are ──────────────────────────────────────────────────
   Distance is the question a museum index actually gets asked in the
   city: not what exists, but what is near. It stays off until asked —
   nothing here wants your location for its own sake. */

const R_MILES = 3958.8;
const rad = (d) => (d * Math.PI) / 180;
function milesFrom(a, lat, lng) {
  const dLat = rad(lat - a.lat), dLng = rad(lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Close up, New York answers in blocks, so the reading is in feet until
   feet stop being useful. */
function howFar(mi) {
  const ft = mi * 5280;
  if (ft < 1000) return `${Math.round(ft / 50) * 50} ft`;
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

const nearBtn = el('near');
function setHere(pos) {
  here = pos;
  nearBtn.setAttribute('aria-pressed', String(!!pos));
  if (pos) {
    const x = PROJ.sx * pos.lng + PROJ.bx;   // the projection the build published
    const y = PROJ.sy * ((Math.log(Math.tan(Math.PI / 4 + pos.lat * Math.PI / 360)) * 180) / Math.PI) + PROJ.by;
    here = { ...pos, x, y };
    youDot.setAttribute('d', `M${x} ${y}l0 0`);
    youRing.setAttribute('cx', x); youRing.setAttribute('cy', y); youRing.setAttribute('r', 11 / view.k);
  } else {
    youRing.setAttribute('r', 0);
    youDot.removeAttribute('d');
  }
  render();
}

nearBtn.addEventListener('click', () => {
  if (here) { setHere(null); return; }
  if (!navigator.geolocation) { nearBtn.setAttribute('aria-label', 'This browser cannot report a location'); return; }
  nearBtn.dataset.busy = 'true';
  navigator.geolocation.getCurrentPosition(
    (p) => { delete nearBtn.dataset.busy; setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); },
    () => {
      delete nearBtn.dataset.busy;
      nearBtn.setAttribute('aria-label', 'Location unavailable — sorting stays A to Z');
      nearBtn.title = 'Location unavailable';
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
  );
});

/* ── the view in the address bar ────────────────────────────────────
   A view you cannot send to someone, or reload, is not really a view. */

function writeURL() {
  const q = new URLSearchParams();
  if (query) q.set('q', query);
  if (borough) q.set('b', borough);
  if (chosen) q.set('m', chosen);
  const target = q.toString() ? `${location.pathname}?${q}` : location.pathname;
  if (target !== location.pathname + location.search) history.replaceState(null, '', target);
}

function readURL() {
  const q = new URLSearchParams(location.search);
  query = (q.get('q') || '').trim();
  qEl.value = query;
  el('searchWrap').classList.toggle('has-text', !!query);
  const b = q.get('b');
  borough = BOROUGHS.includes(b) ? b : null;
  const m = q.get('m');
  return M.some((x) => x.i === m) ? m : null;
}

/* ── filtering ─────────────────────────────────────────────────── */

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const hay = (m) => fold([m.n, m.b, m.h, m.a, m.c].join(' '));
const terms = () => fold(query).split(/\s+/).filter(Boolean);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function matches(m, skipBorough) {
  if (!skipBorough && borough && m.b !== borough) return false;
  return terms().every((t) => hay(m).includes(t));
}

function mark(text) {
  const t = terms();
  if (!t.length) return esc(text);
  const re = new RegExp('(' + t.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  let out = '', last = 0;
  for (const hit of fold(text).matchAll(re)) {
    out += esc(text.slice(last, hit.index)) + '<mark>' + esc(text.slice(hit.index, hit.index + hit[0].length)) + '</mark>';
    last = hit.index + hit[0].length;
  }
  return out + esc(text.slice(last));
}

/* ── index ─────────────────────────────────────────────────────── */

function render({ refit = false } = {}) {
  rows = M.filter((m) => matches(m));
  if (here) {
    for (const m of rows) m._mi = milesFrom(here, m.lat, m.lng);
    rows.sort((a, b) => a._mi - b._mi);
  }
  listEl.innerHTML = '';

  if (!rows.length) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.innerHTML = 'Nothing matches.<button type="button" id="reset">Clear filters</button>';
    listEl.appendChild(d);
    el('reset').addEventListener('click', clearAll);
  } else {
    const frag = document.createDocumentFragment();
    for (const m of rows) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'row' + (m.i === chosen ? ' on' : '');
      b.dataset.id = m.i;
      // A list you choose from is a listbox, and a listbox is one stop on
      // the tab ring, not a hundred and seven. Arrows move within it.
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(m.i === chosen));
      b.tabIndex = -1;
      b.innerHTML = `<div class="row-n">${mark(m.n)}</div>
        <div class="row-m"><span class="row-h">${mark(m.h || m.b)}</span> · ${mark(m.a)}</div>` +
        (here ? `<div class="row-d">${howFar(m._mi)}</div>` : '');
      b.addEventListener('click', () => choose(m.i, { from: 'list' }));
      b.addEventListener('pointerenter', () => peek(m.i, true));
      b.addEventListener('pointerleave', () => peek(m.i, false));
      frag.appendChild(b);
    }
    listEl.appendChild(frag);
    tabStop();
  }

  el('count').textContent = rows.length;
  el('countLabel').textContent = rows.length === M.length ? 'Museums' : `of ${M.length}`;

  for (const s of segs.querySelectorAll('.seg')) {
    const b = s.dataset.b || null;
    const n = M.filter((m) => matches(m, true) && (!b || m.b === b)).length;
    s.querySelector('.n').textContent = n;
    s.disabled = n === 0 && b !== borough;
    s.style.opacity = s.disabled ? 0.35 : '';
  }

  for (const [id, c] of pinOf) c.style.display = rows.some((m) => m.i === id) ? '' : 'none';

  cursor = rows.findIndex((m) => m.i === chosen);
  writeURL();
  if (refit) glide(frame(boundsOf(rows)));
  else paint();
}

/* Exactly one row is reachable by Tab: the chosen one, or the first. */
function tabStop() {
  for (const r of listEl.querySelectorAll('.row')) r.tabIndex = -1;
  const one = listEl.querySelector('.row.on') || listEl.querySelector('.row');
  if (one) one.tabIndex = 0;
}

function peek(id, on) {
  listEl.querySelector(`.row[data-id="${CSS.escape(id)}"]`)?.classList.toggle('peek', on);
  const p = pinOf.get(id);
  if (p && id !== chosen) p.style.stroke = on ? 'var(--pin-hover)' : '';
}

/* ── selection ─────────────────────────────────────────────────── */

function choose(id, { from = 'list' } = {}) {
  chosen = id;
  document.body.classList.toggle('picked', !!id);
  for (const [mid, c] of pinOf) { c.style.stroke = ''; c.classList.toggle('on', mid === id); }
  for (const r of listEl.querySelectorAll('.row')) {
    const on = r.dataset.id === id;
    r.classList.toggle('on', on);
    r.setAttribute('aria-selected', String(on));
  }
  tabStop();

  if (!id) { card.classList.remove('show'); halo.setAttribute('r', 0); _insets = null; writeURL(); return; }

  const m = M.find((x) => x.i === id);
  cursor = rows.findIndex((x) => x.i === id);
  halo.setAttribute('cx', m.x); halo.setAttribute('cy', m.y); halo.setAttribute('r', 21 / view.k);
  glow.setAttribute('d', dotAt(m));
  _insets = null;                    // the card changes the room the map has

  el('cName').textContent = m.n;
  el('cTags').innerHTML =
    `<span class="tag amber">${esc(m.c)}</span><span class="tag">${esc(m.b)}</span>` +
    (m.h ? `<span class="tag">${esc(m.h)}</span>` : '');
  el('cAddr').textContent = m.f;

  const site = el('cSite');
  if (m.u) { site.href = m.u; site.removeAttribute('aria-disabled'); site.textContent = 'Visit site'; }
  else { site.removeAttribute('href'); site.setAttribute('aria-disabled', 'true'); site.textContent = 'No website'; }
  el('cMap').href = `https://maps.apple.com/?q=${encodeURIComponent(m.n)}&ll=${m.lat},${m.lng}`;
  card.classList.add('show');
  writeURL();

  // close enough that the cross streets are legible
  if (from === 'list') glide(frame({ x0: m.x, y0: m.y, x1: m.x, y1: m.y }, { pad: 27, maxK: 15 }), 780);
  else listEl.querySelector(`.row[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
}

/* ── controls ──────────────────────────────────────────────────── */

function buildSegs() {
  const make = (label, b) => {
    const s = document.createElement('button');
    s.type = 'button'; s.className = 'seg';
    s.setAttribute('role', 'tab');
    s.setAttribute('aria-selected', String(borough === b));
    if (b) s.dataset.b = b;
    s.innerHTML = `${label}<span class="n"></span>`;
    s.addEventListener('click', () => {
      borough = b;
      for (const o of segs.querySelectorAll('.seg')) o.setAttribute('aria-selected', String(o === s));
      moveThumb(s);
      render({ refit: true });
    });
    segs.appendChild(s);
    return s;
  };
  const all = make('All', null);
  for (const b of BOROUGHS) make(b === 'Staten Island' ? 'Staten Is.' : b, b);
  const active = segs.querySelector('.seg[aria-selected="true"]') || all;
  requestAnimationFrame(() => moveThumb(active));
}

function moveThumb(s) {
  thumb.style.width = s.offsetWidth + 'px';
  thumb.style.height = s.offsetHeight + 'px';
  thumb.style.transform = `translate(${s.offsetLeft}px, ${s.offsetTop}px)`;
}

let t;
qEl.addEventListener('input', () => {
  el('searchWrap').classList.toggle('has-text', !!qEl.value);
  clearTimeout(t);
  t = setTimeout(() => { query = qEl.value.trim(); render({ refit: true }); }, 110);
});
el('clear').addEventListener('click', () => {
  qEl.value = ''; query = ''; el('searchWrap').classList.remove('has-text');
  render({ refit: true }); qEl.focus();
});
el('cClose').addEventListener('click', () => choose(null));

function clearAll() {
  query = ''; qEl.value = ''; borough = null; chosen = null;
  el('searchWrap').classList.remove('has-text');
  for (const o of segs.querySelectorAll('.seg')) o.setAttribute('aria-selected', String(!o.dataset.b));
  moveThumb(segs.querySelector('.seg'));
  choose(null);
  render({ refit: true });
  writeURL();
}

function step(d) {
  if (!rows.length) return;
  cursor = Math.min(rows.length - 1, Math.max(0, cursor + d));
  const m = rows[cursor];
  const inList = listEl.contains(document.activeElement);
  choose(m.i, { from: 'map' });
  // keep the keyboard where the eye is
  const row = listEl.querySelector(`.row[data-id="${CSS.escape(m.i)}"]`);
  row?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  if (inList) row?.focus({ preventScroll: true });
  glide(frame({ x0: m.x, y0: m.y, x1: m.x, y1: m.y }, { pad: 27, maxK: 15 }), 640);
}

addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
  if (e.key === '/' && !typing) { e.preventDefault(); qEl.focus(); qEl.select(); return; }
  if (e.key === 'Escape') { if (chosen) choose(null); else clearAll(); return; }
  if (typing && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
  if (e.key === 'Enter' && chosen) {
    const m = M.find((x) => x.i === chosen);
    if (m?.u) window.open(m.u, '_blank', 'noopener');
  }
});

addEventListener('resize', () => {
  cssCache = {};
  _insets = null;
  sizeCanvas();
  const s = segs.querySelector('.seg[aria-selected="true"]');
  if (s) moveThumb(s);
  const m = chosen && M.find((x) => x.i === chosen);
  if (m) glide(frame({ x0: m.x, y0: m.y, x1: m.x, y1: m.y }, { pad: 27, maxK: 15 }), 260);
  else glide(frame(boundsOf(rows)), 260);
});

/* ── open ──────────────────────────────────────────────────────── */

// A link carries the search, the borough and the museum. Restore them
// before anything is drawn, so the page opens on the view that was sent
// rather than flying to it afterwards.
const asked = readURL();
buildSegs();
sizeCanvas();          // measure the stage first: framing depends on it
render();
view = frame(boundsOf(rows));
if (asked) {
  const m = M.find((x) => x.i === asked);
  choose(asked, { from: 'map' });
  view = frame({ x0: m.x, y0: m.y, x1: m.x, y1: m.y }, { pad: 27, maxK: 15 });
}
apply();

// The city draws first; the street network unpacks behind it.
const unpack = () => { decodeStreets(); paint(); };
'requestIdleCallback' in window ? requestIdleCallback(unpack, { timeout: 1200 }) : setTimeout(unpack, 80);
