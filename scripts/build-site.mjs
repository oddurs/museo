#!/usr/bin/env node
/**
 * Assemble the public site in _site/, as GitHub Pages serves it.
 *
 *   npm run site
 *
 * There is nothing to compile. The app in web/ is the site: one page, one
 * stylesheet and four scripts, two of which are generated data. Pages serves
 * a project site under /museo/, and every path the page uses is relative, so
 * the directory simply moves across.
 *
 * The page is set in the reader's own system sans and ships no font file at
 * all, which is deliberate — see the note in README.
 */

import { cp, mkdir, rm, writeFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const out = new URL('../_site/', import.meta.url)

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await cp(new URL('web/', root), out, { recursive: true })
await writeFile(new URL('.nojekyll', out), '')

const files = (await readdir(out)).sort()
console.log(`_site/ assembled — ${files.length} files: ${files.join(', ')}`)
