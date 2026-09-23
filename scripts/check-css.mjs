#!/usr/bin/env node
/**
 * One lint, learned the hard way twice.
 *
 *   npm run css
 *
 * A rule like `.search svg { position: absolute }` reads as "the field's
 * icon". It is not: it is *every* svg inside the field, and when a second
 * one arrived — the clear button's cross — it was pulled out of flow and
 * dropped on top of the first, while its own button collapsed to nothing.
 * The page looked broken and every selector-based check still passed,
 * because the elements were all present and the text was all correct.
 *
 * So: a rule that takes an element out of flow, and reaches it through a
 * bare tag name under a class, must match at most one such element in the
 * markup. Scoping it with `>` is usually the fix.
 */

import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const css = await readFile(new URL('src/lib/museo.css', root), 'utf8')

// The markup lives in components now, so the lint reads all of them.
const dir = new URL('src/', root)
async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const u = new URL(e.name + (e.isDirectory() ? '/' : ''), d)
    if (e.isDirectory()) yield* walk(u)
    else if (e.name.endsWith('.svelte')) yield u
  }
}
let html = ''
for await (const f of walk(dir)) html += await readFile(f, 'utf8') + '\n'

const VOID = new Set(['meta', 'link', 'br', 'img', 'input', 'hr', 'source', 'area', 'base', 'col'])

/* The most <tag> found inside any one element carrying class `cls`. */
function mostInside(cls, tag) {
  const tokens = /<(\/?)([a-z][\w-]*)([^>]*)>/gi
  const hasClass = new RegExp(`class\\s*=\\s*"[^"]*\\b${cls}\\b`, 'i')
  let depth = 0, inside = -1, count = 0, most = 0
  for (let t; (t = tokens.exec(html)); ) {
    const closing = t[1] === '/'
    const name = t[2].toLowerCase()
    const attrs = t[3]
    const selfClosing = attrs.endsWith('/') || VOID.has(name)
    if (closing) {
      depth--
      if (inside >= 0 && depth < inside) { most = Math.max(most, count); inside = -1; count = 0 }
      continue
    }
    if (inside >= 0 && name === tag) count++
    if (selfClosing) continue
    depth++
    if (inside < 0 && hasClass.test(attrs)) { inside = depth; count = 0 }
  }
  return Math.max(most, count)
}

const problems = []
const RISKY = /(?:^|[,}])\s*\.([\w-]+)\s+([a-z][a-z0-9]*)\s*\{([^{}]*)\}/gim

for (const m of css.matchAll(RISKY)) {
  const [, cls, tag, body] = m
  if (!/position\s*:\s*(absolute|fixed)/i.test(body)) continue
  const n = mostInside(cls, tag)
  if (n > 1) problems.push(`.${cls} ${tag} takes <${tag}> out of flow, but one .${cls} holds ${n} of them — scope it as \`.${cls} > ${tag}\``)
}

if (problems.length) {
  console.error('CSS reaches further than it means to:')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log('CSS: no out-of-flow rule reaches more than one element.')
