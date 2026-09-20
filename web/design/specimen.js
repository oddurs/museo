/* Renders the specimen from the system's own custom properties, so the page
   cannot drift out of sync with system.css. Contrast ratios are computed here
   from the live token values rather than transcribed. */

const css = getComputedStyle(document.documentElement)
const token = (name) => css.getPropertyValue(name).trim()

const el = (tag, cls, html) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html != null) n.innerHTML = html
  return n
}

/* ---------- contrast ---------- */

const channels = (hex) => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
}
const luminance = (hex) => {
  const [r, g, b] = channels(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PAPER = token('--paper')

/* ---------- 02 neutral ramp ---------- */

const RAMP = [
  ['000', 'Paper'],
  ['050', 'Sunk — hover beds'],
  ['100', 'Wash — inset panels'],
  ['150', 'Hairline, light'],
  ['200', 'Hairline, standard'],
  ['300', 'Hairline, strong'],
  ['400', 'Boundary — draw only'],
  ['500', 'Metadata — lightest text allowed'],
  ['600', 'Supporting text'],
  ['700', 'Secondary text'],
  ['800', 'Strong text'],
  ['900', 'Ink — primary text, edges'],
]

function swatch(varName, label, role) {
  const value = token(varName)
  const ratio = contrast(value, PAPER)
  const li = el('li', 'swatch')
  li.append(
    Object.assign(el('div', 'swatch__chip'), { style: `background:${value}` }),
    el('p', 'swatch__label t-label', label),
    Object.assign(el('p', 'swatch__meta t-small'), {
      innerHTML:
        `<span class="swatch__hex">${value}</span>` +
        `<span class="swatch__ratio${ratio >= 4.5 ? ' is-text' : ''}">${ratio.toFixed(2)}:1</span>`,
    }),
    el('p', 'swatch__role t-small u-quiet', role),
  )
  return li
}

document.getElementById('ramp').append(
  ...RAMP.map(([step, role]) => swatch(`--gray-${step}`, step, role)),
)

/* ---------- 03 primary ---------- */

document.getElementById('primary').append(
  swatch('--primary', 'Primary', 'The bar, selection, pins, focus'),
  swatch('--primary-deep', 'Deep', 'Hover, and the primary as text'),
  swatch('--primary-line', 'Line', 'Keylines and link underlines'),
  swatch('--primary-wash', 'Wash', 'The selected row’s bed'),
)

/* ---------- 04 weights ---------- */

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
        el('p', 'weight__name t-label', `${name} ${weight}`),
      )
      return d
    }),
  )
}

/* ---------- 05 OpenType features ---------- */

/* Style objects, not style strings: an OpenType value like "smcp" 1 contains
   double quotes, which terminate a style="..." attribute and silently drop the
   declaration. These are assigned as properties instead. */
const FEATURES = [
  {
    name: 'Small caps',
    tag: 'smcp, c2sc',
    note: 'True small capitals, drawn at the weight of the text beside them. Uppercase set small is heavier and sits wrong.',
    text: 'Manhattan · Brooklyn',
    off: { textTransform: 'uppercase', fontSize: '0.84em', letterSpacing: '0.09em' },
    on: { fontFeatureSettings: '"smcp" 1, "c2sc" 1', textTransform: 'lowercase', letterSpacing: '0.09em' },
  },
  {
    name: 'Old-style figures',
    tag: 'onum, pnum',
    note: 'Figures that sit in the line with ascenders and descenders, so an address reads as prose rather than as a heading.',
    text: '1000 Fifth Avenue, 9-01 33rd Road',
    off: { fontFeatureSettings: '"lnum" 1' },
    on: { fontFeatureSettings: '"onum" 1, "pnum" 1' },
  },
  {
    name: 'Lining tabular',
    tag: 'lnum, tnum',
    note: 'Equal-width lining figures, so a column of numbers holds its rule and a changing count does not shift width.',
    text: '001 047 095 107',
    off: { fontFeatureSettings: '"onum" 1, "pnum" 1' },
    on: { fontFeatureSettings: '"lnum" 1, "tnum" 1' },
  },
  {
    name: 'Superior figures',
    tag: 'sups',
    note: 'Whitney maps the ten digits and nothing else — so the numero sign uses the real ordinal glyph (º) rather than a raised letter.',
    text: '1 2 3',
    off: {},
    on: { fontFeatureSettings: '"sups" 1' },
  },
  {
    name: 'Fractions',
    tag: 'frac',
    note: 'A properly drawn numerator and denominator rather than three characters in a row.',
    text: '1/2 3/4 7/8',
    off: {},
    on: { fontFeatureSettings: '"frac" 1' },
  },
]

function sample(text, styles) {
  const p = el('p', 'feature__sample')
  p.textContent = text
  Object.assign(p.style, styles)
  return p
}

function side(label, text, styles, primary) {
  const d = el('div', 'feature__side')
  d.append(el('span', `t-label ${primary ? 'u-primary' : 'u-quiet'}`, label), sample(text, styles))
  return d
}

document.getElementById('features').append(
  ...FEATURES.map((f) => {
    const li = el('li', 'feature')
    const meta = el('div', 'feature__meta')
    meta.append(
      el('span', 't-label', f.name),
      el('code', 'feature__tag', f.tag),
      el('p', 't-small u-quiet', f.note),
    )
    const pair = el('div', 'feature__pair')
    pair.append(side('Default', f.text, f.off, false), side('Set', f.text, f.on, true))
    li.append(meta, pair)
    return li
  }),
)

/* ---------- 06 scale ---------- */

const SCALE = [
  ['.t-banner', '--size-banner', '107'],
  ['.t-display', '--size-display', 'Museums'],
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
      el('td', 'scale__specimen', `<span class="${cls.slice(1)}">${sample}</span>`),
    )
    return tr
  }),
)

/* ---------- 07 space & rules ---------- */

document.getElementById('spaces').append(
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
    const size = token(`--space-${n}`)
    const li = el('li', 'space')
    li.append(
      Object.assign(el('div', 'space__bar'), { style: `width:${size}` }),
      el('p', 'space__name t-label', `${n}`),
      el('p', 'space__value t-small u-quiet', size),
    )
    return li
  }),
)

const RULES = [
  ['rule--light', 'Light', '--rule-light'],
  ['rule', 'Standard', '--rule'],
  ['rule--strong', 'Strong', '--rule-strong'],
  ['rule--edge', 'Edge', '--ink'],
  ['rule--primary', 'Keyline', '--primary'],
]

document.getElementById('rules').append(
  ...RULES.map(([cls, name, varName]) => {
    const li = el('li', 'rule-row')
    li.append(
      el('span', 'rule-row__name t-label', name),
      el('hr', cls === 'rule' ? 'rule' : `rule ${cls}`),
      el('code', 'rule-row__token', varName),
    )
    return li
  }),
)

/* ---------- 09 entry ---------- */

const entry = (n, name, meta, discipline, host, borough, cls = '') => `
  <article class="entry ${cls}">
    <span class="entry__no t-figure" aria-hidden="true">${n}</span>
    <div class="entry__body">
      <h3 class="entry__name t-heading">
        <button type="button" class="entry__select" tabindex="-1">${name}</button>
      </h3>
      <p class="entry__meta t-small">${meta}</p>
      <a class="entry__link t-fine" href="#" onclick="return false">${host} &#8599;</a>
    </div>
    <span class="entry__class">
      <span class="entry__borough t-label">${borough}</span>
      <span class="entry__discipline t-label">${discipline}</span>
    </span>
  </article>`

document.getElementById('entry-demo').innerHTML =
  entry('047', 'The Noguchi Museum', 'Long Island City · 9-01 33rd Road', 'Art', 'noguchi.org', 'Queens') +
  entry('048', 'The Studio Museum in Harlem', 'Harlem · 144 West 125th Street', 'Art', 'studiomuseum.org', 'Manhattan', 'is-hovered') +
  entry('049', 'Wave Hill', 'Riverdale · 4900 Independence Avenue', 'Culture', 'wavehill.org', 'Bronx', 'is-peeked') +
  entry('050', 'Museum of the Moving Image', 'Astoria · 36-01 35th Avenue', 'Culture', 'movingimage.org', 'Queens', 'is-active')
