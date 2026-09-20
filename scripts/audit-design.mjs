#!/usr/bin/env node
/**
 * Design-system linter. Checks that the composition layers only ever spend
 * values the system defines, so spacing and borders cannot drift back to
 * hand-tuned numbers.
 *
 *   npm run audit
 *
 * A line may opt out with a trailing `/* system-exempt: why *​/` comment. Every
 * exemption needs a reason, and the reasons are listed in the report.
 */

import { readFile } from 'node:fs/promises'

const SYSTEM = 'web/system.css'
const LAYERS = ['web/app.css', 'web/components.css', 'web/design/specimen.css']

const SPACING_PROPS = /^(margin|padding)(-(top|right|bottom|left|block|inline))?$|^(row-|column-)?gap$/
const BORDER_WIDTH_PROP = /^border(-(top|right|bottom|left))?-width$/
const BORDER_SHORTHAND = /^border(-(top|right|bottom|left))?$/
const EXEMPT = /\/\*\s*system-exempt:\s*([^*]+)\*\//

const read = async (f) => (await readFile(new URL('../' + f, import.meta.url), 'utf8'))

/* ---------- what the system defines ---------- */

const system = await read(SYSTEM)
const defined = new Set([...system.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]))
const spaceScale = [...system.matchAll(/--space-(\d+):\s*(\d+)px/g)].map((m) => Number(m[2]))
const strokeScale = [...system.matchAll(/--stroke-[\w-]+:\s*(\d+)px/g)].map((m) => Number(m[1]))

const problems = []
const exemptions = []

/* ---------- per-layer checks ---------- */

for (const file of LAYERS) {
  const css = await read(file)
  const lines = css.split('\n')

  // strip comment-only and at-rule lines from declaration scanning
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`
    const exempt = line.match(EXEMPT)
    if (exempt) exemptions.push(`${at} — ${exempt[1].trim()}`)

    const decl = line.match(/^\s*([a-z-]+)\s*:\s*([^;]+);/)
    if (!decl) return
    const [, prop, rawValue] = decl
    const value = rawValue.replace(EXEMPT, '').trim()
    if (exempt) return

    // 1. raw colors outside the system layer
    const hex = value.match(/#[0-9a-fA-F]{3,8}/)
    if (hex) problems.push(`${at}  raw color ${hex[0]} in "${prop}" — use a token`)

    // 2. spacing must come from the scale
    if (SPACING_PROPS.test(prop)) {
      for (const px of value.matchAll(/(-?[\d.]+)px/g)) {
        const n = Math.abs(Number(px[1]))
        if (n !== 0 && !spaceScale.includes(n)) {
          problems.push(`${at}  ${prop}: ${px[0]} is off the 4px scale [${spaceScale.join(' ')}]`)
        }
      }
    }

    // 3. border widths must come from the stroke scale
    if (BORDER_WIDTH_PROP.test(prop) || BORDER_SHORTHAND.test(prop)) {
      for (const px of value.matchAll(/([\d.]+)px/g)) {
        const n = Number(px[1])
        if (n !== 0 && !strokeScale.includes(n)) {
          problems.push(`${at}  ${prop}: ${px[0]} is off the stroke scale [${strokeScale.join(' ')}]`)
        }
      }
    }

    // 4. every token referenced must exist
    for (const ref of value.matchAll(/var\((--[\w-]+)/g)) {
      if (!defined.has(ref[1]) && !ref[1].startsWith('--map-height')) {
        problems.push(`${at}  unknown token ${ref[1]}`)
      }
    }
  })
}

/* ---------- the index's columns must share one grid ---------- */

/* .entry and .index__head are two halves of one table: the head labels the
   columns the rows fill. They live in different files and are easy to change
   apart, so the EFFECTIVE column shape is compared at every breakpoint either
   one touches — base declarations cascade in, and a rule that changes columns
   at 620px without changing them for the head is what this is here to catch. */

const app = await read('web/app.css')
const components = await read('web/components.css')

const COLUMN_PROPS = ['grid-template-columns', 'column-gap', 'padding-left']
const TRACKED = ['.entry', '.index__head']

/** Flatten a stylesheet into { media, selector, decls } rules, one @media deep. */
function rules(css) {
  const out = []
  const re = /(@media[^{]+\{)|([^{}]+)\{([^{}]*)\}|(\})/g
  let media = ''
  let depth = 0
  for (const m of css.matchAll(re)) {
    if (m[1]) { media = m[1].replace(/\s+/g, ' ').replace('{', '').trim(); depth++ }
    else if (m[4]) { if (depth > 0) { depth--; media = '' } }
    else if (m[2] != null) {
      out.push({
        media,
        selector: m[2].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(),
        decls: m[3],
      })
    }
  }
  return out
}

// load order, as index.html declares it: components.css then app.css
const allRules = [...rules(components), ...rules(app)]

function shapeAt(selector, media) {
  const shape = {}
  // the cascade in two ordered passes: base declarations, then the breakpoint's
  const ordered = [
    ...allRules.filter((r) => r.media === ''),
    ...allRules.filter((r) => r.media !== '' && r.media === media),
  ]
  for (const r of ordered) {
    if (!r.selector.split(',').some((s) => s.trim() === selector)) continue
    for (const prop of COLUMN_PROPS) {
      const m = r.decls.match(new RegExp('(?:^|[;{\\s])' + prop + ':\\s*([^;]+);'))
      if (m) shape[prop] = m[1].trim()
    }
    const marker = r.decls.match(/border-left:\s*([^;]+);/)
    if (marker) shape.marker = /var\(--stroke-marker\)/.test(marker[1])
  }
  return shape
}

const breakpoints = [
  '',
  ...new Set(allRules.filter((r) => r.media && TRACKED.some((t) =>
    r.selector.split(',').some((s) => s.trim() === t))).map((r) => r.media)),
]

for (const media of breakpoints) {
  const head = shapeAt('.index__head', media)
  const entry = shapeAt('.entry', media)
  const where = media || 'base'
  for (const prop of COLUMN_PROPS) {
    if (head[prop] !== entry[prop]) {
      problems.push(`${where}: .index__head ${prop} "${head[prop]}" != .entry "${entry[prop]}"`)
    }
  }
  if (!!head.marker !== !!entry.marker) {
    problems.push(
      `${where}: .index__head and .entry disagree on the selection marker — ` +
      'every row will sit off its own column head',
    )
  }
}

console.log(`columns      checked at ${breakpoints.length} breakpoint(s)`)

/* ---------- one home per component ---------- */

/* A component defined in two layers has two homes, and they drift: .wordmark
   was styled in app.css AND specimen.css while the imprint lived only in
   app.css — so the specimen, which does not load app.css, rendered it
   unstyled. Only a BARE single-class selector at base level counts as
   defining a component; `.colophon .wordmark {}` is contextual, and a rule
   inside @media is a responsive adjustment. Both are fine. */

const homes = new Map()
for (const file of LAYERS) {
  const css = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '')

  // drop @media bodies so responsive adjustments do not count as definitions
  const base = css.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')

  for (const m of base.matchAll(/(^|\})\s*([^{}@]+?)\s*\{/g)) {
    for (const sel of m[2].split(',')) {
      const bare = sel.trim().match(/^\.([\w-]+)$/)   // exactly one class, nothing else
      if (!bare) continue
      if (!homes.has(bare[1])) homes.set(bare[1], new Set())
      homes.get(bare[1]).add(file)
    }
  }
}
for (const [cls, files] of homes) {
  if (files.size > 1) {
    problems.push(`.${cls} is defined in ${[...files].join(' and ')} — give it one home`)
  }
}

/* ---------- report ---------- */

console.log(`space scale  ${spaceScale.join(' ')}`)
console.log(`stroke scale ${strokeScale.join(' ')}`)
console.log(`tokens       ${defined.size} defined`)
if (exemptions.length) {
  console.log(`\nexemptions (${exemptions.length}):`)
  for (const e of exemptions) console.log('  ' + e)
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log('\nall checks passed')
