
/* ── the street network ────────────────────────────────────────────
   112,489 segments of NYC street centreline, delta-encoded. New York
   is navigated by cross street, so the grid has to be there when you
   are close enough to walk it — and absent when you are not.
   Decoded after first paint, drawn on canvas, culled to the viewport.
   ─────────────────────────────────────────────────────────────────── */

const SA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SV = new Int16Array(128);
for (let i = 0; i < SA.length; i++) SV[SA.charCodeAt(i)] = i;

let S = null;                 // decoded network
const CELL = 20;              // index cell, in map units
const GRID = Math.ceil(1000 / CELL);

function decodeStreets() {
  const d = ST.d, q = ST.q, n = d.length;
  const guessLines = Math.ceil(n / 7), guessPts = Math.ceil(n / 3);
  const px = new Float32Array(guessPts), py = new Float32Array(guessPts);
  const off = new Int32Array(guessLines), cnt = new Uint16Array(guessLines);
  const typ = new Uint8Array(guessLines), nam = new Int32Array(guessLines);
  let i = 0, p = 0, line = 0, lx = 0, ly = 0;

  const read = () => {                       // varint
    let v = 0, sh = 0, c;
    do { c = SV[d.charCodeAt(i++)]; v |= (c & 31) << sh; sh += 5; } while (c & 32);
    return v;
  };
  const zag = (v) => (v >>> 1) ^ -(v & 1);

  while (i < n) {
    const name = read() - 1, t = read(), extra = read();
    lx += zag(read()); ly += zag(read());
    off[line] = p; cnt[line] = extra + 1; typ[line] = t; nam[line] = name;
    px[p] = lx / q; py[p] = ly / q; p++;
    let cx = lx, cy = ly;
    for (let k = 0; k < extra; k++) {
      cx += zag(read()); cy += zag(read());
      px[p] = cx / q; py[p] = cy / q; p++;
    }
    line++;
  }

  // bucket every line into the cells it touches, so a frame only draws
  // what is on screen
  const heads = new Int32Array(GRID * GRID).fill(-1);
  const next = new Int32Array(line * 3);
  const idx = new Int32Array(line * 3);
  let link = 0;
  for (let L = 0; L < line; L++) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < cnt[L]; k++) {
      const x = px[off[L] + k], y = py[off[L] + k];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const cx0 = Math.max(0, (x0 / CELL) | 0), cx1 = Math.min(GRID - 1, (x1 / CELL) | 0);
    const cy0 = Math.max(0, (y0 / CELL) | 0), cy1 = Math.min(GRID - 1, (y1 / CELL) | 0);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * GRID + cx;
      if (link >= next.length) break;
      next[link] = heads[c]; heads[c] = link; idx[link] = L; link++;
    }
  }
  S = { px, py, off, cnt, typ, nam, heads, next, idx, count: line,
        seen: new Int32Array(line), tick: 0 };
}

/* How present the grid is, by scale. The arterials arrive first; the
   full grid waits until you are close enough to walk it, which is
   both the honest cartography and the cheap one — a whole borough of
   side streets at once is a smear to look at and the single most
   expensive thing this page can draw. */
const streetAlpha = (k) => (k < 4 ? 0 : Math.min(0.5, (k - 4) / 14));
const showAll = (k) => k >= 7;
const showNames = (k) => k >= 10.5;

function drawStreets(ctx, k, vx, vy, w, h) {
  if (!S) return;
  const a = streetAlpha(k);
  if (a <= 0.001) return;

  // viewport in map units, with a margin
  const m = 30 / k;
  const x0 = (-vx) / k - m, y0 = (-vy) / k - m;
  const x1 = (w - vx) / k + m, y1 = (h - vy) / k + m;
  const cx0 = Math.max(0, (x0 / CELL) | 0), cx1 = Math.min(GRID - 1, (x1 / CELL) | 0);
  const cy0 = Math.max(0, (y0 / CELL) | 0), cy1 = Math.min(GRID - 1, (y1 / CELL) | 0);

  const all = showAll(k);
  const labels = [];
  S.tick += 2;



  // two passes so the arterials read above the grid
  for (const pass of all ? [0, 1] : [1]) {
    ctx.beginPath();
    ctx.strokeStyle = pass === 0
      ? `rgba(255,255,255,${a * 0.62})`
      : `rgba(255,255,255,${Math.min(0.62, a * 1.5)})`;
    ctx.lineWidth = (pass === 0 ? 0.9 : 1.5) / k;
    // The arterials are few and read as drawn lines, so they keep round
    // ends. The hairline grid is a hundred thousand segments; round caps
    // and joins there are pure rasteriser cost for nothing the eye can
    // resolve, so it gets flat ends and bevelled corners.
    ctx.lineCap = pass === 0 ? 'butt' : 'round';
    ctx.lineJoin = pass === 0 ? 'bevel' : 'round';

    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      for (let l = S.heads[cy * GRID + cx]; l !== -1; l = S.next[l]) {
        const L = S.idx[l];
        const isMain = S.typ[L] !== 1;
        if ((pass === 0) === isMain) continue;
        const mark = S.tick + pass;
        if (S.seen[L] === mark) continue;       // a line spans several cells
        S.seen[L] = mark;
        const o = S.off[L], c = S.cnt[L];
        ctx.moveTo(S.px[o], S.py[o]);
        for (let j = 1; j < c; j++) ctx.lineTo(S.px[o + j], S.py[o + j]);
        if (labels.length < 4000 && showNames(k) && S.nam[L] >= 0) {
          const ex = S.px[o + c - 1], ey = S.py[o + c - 1];
          const len = Math.hypot(ex - S.px[o], ey - S.py[o]) * k;
          if (len > 78) labels.push([S.nam[L], (S.px[o] + ex) / 2, (S.py[o] + ey) / 2,
                                     Math.atan2(ey - S.py[o], ex - S.px[o]), L]);
        }
      }
    }
    ctx.stroke();
  }
  return labels;
}

/* Street names.

   These used to be chosen in screen space: the first candidate to reach
   a screen cell took it, and candidates arrived in whatever order the
   viewport happened to walk the grid. So a pan of one pixel could hand
   a slot to a different street, and the names flickered on and off as
   you moved. The choice is now made on the city instead of on the
   window — the slots are laid over the map, and the street with the
   lowest index always wins its slot. At a given zoom a name is either
   written or it is not, wherever you have scrolled to, so panning moves
   the type with the map and nothing blinks.
   ─────────────────────────────────────────────────────────────────── */
function drawLabels(ctx, labels, k, vx, vy, dpr) {
  if (!labels || !labels.length) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '500 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(242,243,245,0.42)';

  // slots in map units, so they do not travel with the window
  const cw = 210 / k, ch = 76 / k;
  const best = new Map();
  for (const c of labels) {
    const slot = Math.floor(c[1] / cw) + ':' + Math.floor(c[2] / ch);
    const held = best.get(slot);
    if (!held || c[4] < held[4]) best.set(slot, c);
  }

  const apart = 420 / k;          // a street may repeat, but not on top of itself
  const placed = new Map();
  for (const [ni, mx, my, ang] of [...best.values()].sort((a, b) => a[4] - b[4])) {
    const near = placed.get(ni);
    if (near && near.some(([px2, py2]) => Math.hypot(mx - px2, my - py2) < apart)) continue;
    (near ? near : placed.set(ni, []).get(ni)).push([mx, my]);

    const sx = mx * k + vx, sy = my * k + vy;
    if (sx < -60 || sy < -30 || sx > ctx.canvas.width / dpr + 60 || sy > ctx.canvas.height / dpr + 30) continue;

    let a = ang;
    if (a > Math.PI / 2) a -= Math.PI;
    if (a < -Math.PI / 2) a += Math.PI;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.fillText(ST.n[ni], 0, 0);
    ctx.restore();
  }
}

/* ── the water ──────────────────────────────────────────────────────
   New York is a harbour. The black between the boroughs is not empty
   space, it is the thing the city was built around, so it gets named.

   Each body of water carries a centreline. A name is set along the
   part of that line you can actually see, letter by letter, following
   the bends — so the Hudson reads up the Hudson rather than across
   the blocks beside it. Tracking opens until the word spans its water,
   and a name that will not fit at this scale simply waits. The harbour
   names itself first; the creeks last.
   ─────────────────────────────────────────────────────────────────── */

const MX = (lng) => PROJ.sx * lng + PROJ.bx;
const MY = (lat) => PROJ.sy * ((Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180) / Math.PI) + PROJ.by;

const WATER = [
  ['Atlantic Ocean',     [40.5250, -73.9900], [40.5330, -73.8300], [40.5450, -73.7600]],
  ['Long Island Sound',  [40.8300, -73.7800], [40.8700, -73.7200], [40.9100, -73.6700]],
  ['Lower New York Bay', [40.5300, -74.1000], [40.5550, -74.0500], [40.5800, -74.0150]],
  ['Upper New York Bay', [40.6300, -74.0650], [40.6600, -74.0470], [40.6880, -74.0290]],
  ['Hudson River',       [40.7100, -74.0270], [40.7350, -74.0198], [40.7650, -74.0093],
                         [40.7850, -73.9968], [40.8100, -73.9713], [40.8350, -73.9635],
                         [40.8600, -73.9470]],
  ['Jamaica Bay',        [40.6100, -73.8850], [40.6180, -73.8400], [40.6220, -73.8000]],
  ['East River',         [40.7020, -74.0105], [40.7062, -73.9969], [40.7133, -73.9720],
                         [40.7300, -73.9660], [40.7450, -73.9650], [40.7600, -73.9560],
                         [40.7720, -73.9400], [40.7815, -73.9250]],
  ['Arthur Kill',        [40.5450, -74.2450], [40.5750, -74.2380], [40.6100, -74.2050],
                         [40.6380, -74.1700]],
  ['Raritan Bay',        [40.4950, -74.2300], [40.5100, -74.1500]],
  ['Harlem River',       [40.8000, -73.9310], [40.8150, -73.9330], [40.8300, -73.9310],
                         [40.8450, -73.9270], [40.8600, -73.9220], [40.8720, -73.9230]],
  ['Newark Bay',         [40.6600, -74.1300], [40.6900, -74.1230]],
  ['Kill Van Kull',      [40.6420, -74.1450], [40.6440, -74.1100], [40.6460, -74.0850]],
  ['The Narrows',        [40.5950, -74.0500], [40.6120, -74.0420], [40.6250, -74.0350]],
  ['Eastchester Bay',    [40.8300, -73.7950], [40.8480, -73.7900]],
  ['Flushing Bay',       [40.7680, -73.8560], [40.7820, -73.8480]],
  ['Buttermilk Channel', [40.6790, -74.0180], [40.6900, -74.0120]],
  ['Hell Gate',          [40.7790, -73.9310], [40.7830, -73.9200]],
].map(([n, ...pts]) => ({ n, p: pts.map(([lat, lng]) => [MX(lng), MY(lat)]) }));

/* Liang–Barsky: the part of one segment that is on screen. */
function clipSeg(x0, y0, x1, y1, L, T, R, B) {
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy], q = [x0 - L, R - x0, y0 - T, B - y0];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

/* The longest unbroken run of a polyline that stays inside the box. */
function visibleRun(pts, L, T, R, B) {
  let best = null, run = null, len = 0;
  const close = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
  for (let i = 1; i < pts.length; i++) {
    const c = clipSeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], L, T, R, B);
    if (!c) { run = null; len = 0; continue; }
    const a = [c[0], c[1]], b = [c[2], c[3]];
    if (run && close(run[run.length - 1], a)) run.push(b);
    else { run = [a, b]; len = 0; }
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!best || len > best.len) best = { pts: run.slice(), len };
  }
  return best;
}

/* Where a path is, and which way it points, at a given distance along it. */
function walk(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1e-6;
    if (d <= L || i === pts.length - 1) {
      const t = Math.max(0, Math.min(1, d / L));
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0)];
    }
    d -= L;
  }
}

function drawWater(ctx, k, vx, vy, w, h, dpr, pad) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = 'italic 400 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const drawn = [];
  for (const b of WATER) {
    const screen = b.p.map(([x, y]) => [x * k + vx, y * k + vy]);
    const run = visibleRun(screen, pad.l, pad.t, w - pad.r, h - pad.b);
    if (!run || run.len < 46) continue;

    const chars = [...b.n.toUpperCase()];
    const base = chars.reduce((t, c) => t + ctx.measureText(c).width, 0);
    const want = (run.len * 0.66 - base) / Math.max(1, chars.length - 1);
    const track = Math.min(7, Math.max(0.8, want));
    const span = base + track * (chars.length - 1);
    if (span > run.len * 0.92) continue;            // the word does not fit yet

    // read left to right, whichever way the water runs
    let path = run.pts;
    if (path[path.length - 1][0] < path[0][0]) path = path.slice().reverse();

    const start = (run.len - span) / 2;
    const mid = walk(path, run.len / 2);
    if (drawn.some(([dx, dy]) => Math.hypot(mid[0] - dx, mid[1] - dy) < 58)) continue;
    drawn.push(mid);

    // fade in over the last of the fit, so nothing pops into place
    const room = run.len / (base * 1.18);
    ctx.fillStyle = `rgba(242,243,245,${(0.3 * Math.min(1, Math.max(0, (room - 1) * 2.6))).toFixed(3)})`;

    let d = start;
    for (const c of chars) {
      const cw = ctx.measureText(c).width;
      const [x, y, a] = walk(path, d + cw / 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.abs(a) > Math.PI / 2 ? a + Math.PI : a);
      ctx.fillText(c, 0, 0);
      ctx.restore();
      d += cw + track;
    }
  }
}
