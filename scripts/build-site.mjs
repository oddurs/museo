#!/usr/bin/env node
/**
 * Assemble the public site in _site/, as GitHub Pages serves it.
 *
 *   npm run site
 *
 * Locally the app lives in web/ and reads ../data/. Pages serves a project
 * site under /museo/, where ../ would climb out of the project — so the site
 * is flattened: web/ becomes the root, data/ sits beside it, and the one data
 * path the app uses is moved to match.
 *
 * Whitney is licensed and is not in this repository. The site therefore ships
 * fonts.fallback.css as fonts.css — local Helvetica/Arial restated to Whitney's
 * metrics, and no font data at all. That is the DEFAULT, so that no ordinary
 * build can put licensed font files somewhere public.
 *
 *   npm run site -- --with-whitney   local preview only; never publish that
 */

import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const out = new URL('../_site/', import.meta.url)
const exists = (u) => access(u).then(() => true, () => false)

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

// the app, flattened to the root
await cp(new URL('web/', root), out, { recursive: true })
await mkdir(new URL('data/', out), { recursive: true })
for (const f of ['museums.json', 'boroughs.json']) {
  await cp(new URL(`data/${f}`, root), new URL(`data/${f}`, out))
}

// the data root moves with the flattening
const appUrl = new URL('app.js', out)
const app = await readFile(appUrl, 'utf8')
const moved = app.replace("const DATA = '../data/'", "const DATA = 'data/'")
if (moved === app) throw new Error('app.js no longer declares its DATA root — build-site cannot relocate it')
await writeFile(appUrl, moved)

// type: fallbacks, unless a local preview explicitly asks for the real faces
const withWhitney = process.argv.includes('--with-whitney')
if (withWhitney && !(await exists(new URL('web/fonts/whitney-book.woff2', root)))) {
  throw new Error('--with-whitney needs the webfonts built first: npm run fonts')
}
if (!withWhitney) {
  await cp(new URL('fonts.fallback.css', out), new URL('fonts.css', out))
  await rm(new URL('fonts/', out), { recursive: true, force: true })
  // nothing to preload, and a preload of a missing file is a console error
  const indexUrl = new URL('index.html', out)
  let html = await readFile(indexUrl, 'utf8')
  html = html.replace(/^\s*<link rel="preload" as="font"[^>]*>\n/gm, '')

  // A page should not claim a typeface it is not showing. The colophon says
  // what this copy is actually set in.
  const TYPE_CLAIM = 'Set in Whitney, Whitney ScreenSmart and Whitney Condensed.'
  const TYPE_HERE =
    'Designed in Whitney, which is licensed and not served here; set in your ' +
    'system\u2019s sans, restated to Whitney\u2019s metrics.'
  html = replaceOnce(html, TYPE_CLAIM, TYPE_HERE, 'index.html colophon')
  await writeFile(indexUrl, html)

  // The specimen exists to show Whitney's small caps and figures. Without the
  // face it cannot, so it says so before a reader draws conclusions from it.
  const specUrl = new URL('design/index.html', out)
  let spec = await readFile(specUrl, 'utf8')
  spec = replaceOnce(spec, TYPE_CLAIM, TYPE_HERE, 'specimen footer')
  spec = replaceOnce(spec, '    <header class="spec-head">', `    <p class="spec-notice t-small">
      This specimen is of a system set in Whitney, a licensed Hoefler&nbsp;&amp;&nbsp;Co.
      typeface that is not served on this public copy. You are seeing a fallback
      restated to Whitney\u2019s metrics, so small caps are synthesised and the
      old-style and superior figures in section 06 cannot show.
    </p>

    <header class="spec-head">`, 'specimen notice')
  await writeFile(specUrl, spec)
}

function replaceOnce(text, find, replace, where) {
  if (!text.includes(find)) throw new Error(`build-site: expected text not found in ${where}`)
  return text.replace(find, replace)
}

await writeFile(new URL('.nojekyll', out), '')
console.log(`_site/ assembled — ${withWhitney ? 'WITH Whitney: local preview only, never publish' : 'fallback type, no font files'}`)
