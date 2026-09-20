/* Renders the specimen from the system's own tokens, so the page cannot drift
   out of sync with system.css. */

const css = getComputedStyle(document.documentElement)
const token = (name) => css.getPropertyValue(name).trim()
const el = (tag, cls, html) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html != null) n.innerHTML = html
  return n
}

/* ---------- 02 color ---------- */

const srgb = (hex) => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
}
const luminance = (hex) => {
  const [r, g, b] = srgb(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const COLORS = [
  ['--paper', 'Paper', 'Every background'],
  ['--paper-sunk', 'Paper sunk', 'Hover beds, insets'],
  ['--ink', 'Ink', 'Primary text, edges'],
  ['--ink-secondary', 'Ink secondary', 'Supporting text'],
  ['--ink-tertiary', 'Ink tertiary', 'Metadata, labels — lightest text allowed'],
  ['--ink-quiet', 'Ink quiet', 'Borders and marks — never text'],
  ['--rule', 'Rule', 'Hairline separators'],
]

const paper = token('--paper')
document.getElementById('swatches').append(
  ...COLORS.map(([name, label, use]) => {
    const li = el('li', 'swatch')
    const ratio = contrast(token(name), paper)
    li.append(
      Object.assign(el('div', 'swatch__chip'), { style: `background:${token(name)}` }),
      el('p', 'swatch__name t-small', `<b style="font-weight:600">${label}</b>`),
      Object.assign(el('p', 'swatch__meta t-label u-quiet'), {
        innerHTML: `<span>${token(name)}</span><span>${ratio.toFixed(1)}:1</span>`,
      }),
      el('p', 'swatch__use t-small u-quiet', use),
    )
    return li
  }),
)

/* ---------- 03 weights ---------- */

const WEIGHTS = {
  'weights-display': [
    ['var(--font-display)', 300, 'Light'],
    ['var(--font-display)', 400, 'Book'],
    ['var(--font-display)', 500, 'Medium'],
    ['var(--font-display)', 600, 'Semibold'],
    ['var(--font-display)', 700, 'Bold'],
  ],
  'weights-text': [
    ['var(--font-text)', 400, 'Book'],
    ['var(--font-text)', 500, 'Medium'],
    ['var(--font-text)', 600, 'Semibold'],
  ],
}

for (const [id, rows] of Object.entries(WEIGHTS)) {
  document.getElementById(id).append(
    ...rows.map(([family, weight, name]) => {
      const d = el('div', 'weight')
      d.append(
        Object.assign(el('div', 'weight__sample'), {
          textContent: 'Aa',
          style: `font-family:${family};font-weight:${weight}`,
        }),
        el('p', 'weight__name t-label u-quiet', `${name} · ${weight}`),
      )
      return d
    }),
  )
}

/* ---------- 04 scale ---------- */

const SCALE = [
  ['.t-display', '--size-display', '107'],
  ['.t-title', '--size-title', 'Museums of New York'],
  ['.t-heading', '--size-heading', 'The Noguchi Museum'],
  ['.t-body', '--size-body', 'Long Island City · 9-01 33rd Road'],
  ['.t-small', '--size-small', 'Long Island City · 9-01 33rd Road'],
  ['.t-fine', '--size-fine', 'noguchi.org ↗'],
  ['.t-label', '--size-label', 'Queens · Art'],
]

document.getElementById('scale').append(
  ...SCALE.map(([cls, sizeToken, sample]) => {
    const tr = el('tr')
    tr.append(
      el('td', '', `<code>${cls}</code>`),
      el('td', '', `<code>${token(sizeToken)}</code>`),
      el('td', '', `<span class="${cls.slice(1)}">${sample}</span>`),
    )
    return tr
  }),
)

/* ---------- 05 space ---------- */

document.getElementById('spaces').append(
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const size = token(`--space-${n}`)
    const li = el('li', 'space')
    li.append(
      Object.assign(el('div', 'space__bar'), { style: `width:${size}` }),
      el('p', 'space__name t-label u-quiet', `${n} · ${size}`),
    )
    return li
  }),
)

/* ---------- 07 entry ---------- */

const entry = (n, name, meta, discipline, host, borough, active) => `
  <article class="entry${active ? ' is-active' : ''}">
    <span class="entry__no t-numeral">${n}</span>
    <div class="entry__body">
      <h3 class="entry__name t-heading">${name}</h3>
      <p class="entry__meta t-small">${meta}</p>
      <a class="entry__link t-fine" href="#">${host} &#8599;</a>
    </div>
    <span class="entry__class">
      <span class="entry__borough t-label">${borough}</span>
      <span class="entry__discipline t-label">${discipline}</span>
    </span>
  </article>`

document.getElementById('entry-demo').innerHTML =
  entry('047', 'The Noguchi Museum', 'Long Island City · 9-01 33rd Road', 'Art', 'noguchi.org', 'Queens', false) +
  entry('048', 'The Studio Museum in Harlem', 'Harlem · 144 West 125th Street', 'Art', 'studiomuseum.org', 'Manhattan', true) +
  entry('049', 'Wave Hill', 'Riverdale · 4900 Independence Avenue', 'Culture', 'wavehill.org', 'Bronx', false)
