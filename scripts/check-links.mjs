#!/usr/bin/env node
/**
 * Every entry in this index is a link, so every link gets checked.
 *
 *   npm run links            # check them all
 *   npm run links -- --slow  # one at a time, for a flaky connection
 *
 * Reports anything that fails, and anything that redirects to a different
 * host — a museum that has moved domain is still a wrong link even at 200.
 *
 * A 403 or 429 is NOT a broken link. Big museums sit behind bot protection
 * that refuses any automated request, so those are reported separately as
 * unverifiable rather than counted as failures.
 */

import { readFile } from 'node:fs/promises'

const DATA = new URL('../data/museums.json', import.meta.url)
// Nominatim's usage policy asks for a way to reach whoever is running this.
// That is the project's page, unless MUSEO_CONTACT overrides it.
const CONTACT = process.env.MUSEO_CONTACT ?? 'https://github.com/oddurs/museo'
const UA = `museo-linkcheck/1.0 (+${CONTACT})`
const TIMEOUT = 15000
const CONCURRENCY = process.argv.includes('--slow') ? 1 : 6

const museums = JSON.parse(await readFile(DATA, 'utf8'))

const host = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return null }
}

async function probe(url, method = 'HEAD') {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    })
    return { status: res.status, finalUrl: res.url }
  } finally {
    clearTimeout(timer)
  }
}

async function check(m) {
  if (!m.url) return { m, level: 'none', note: 'no site' }
  try {
    // some servers refuse HEAD; fall back to a GET before calling it broken
    let out = await probe(m.url, 'HEAD')
    if (out.status >= 400) out = await probe(m.url, 'GET')

    const from = host(m.url)
    const to = host(out.finalUrl)
    const moved = from && to && from !== to && !to.endsWith('.' + from) && !from.endsWith('.' + to)

    if (out.status === 403 || out.status === 429) {
      return { m, level: 'blocked', note: `HTTP ${out.status} — bot protection, not checkable` }
    }
    if (out.status >= 400) return { m, level: 'fail', note: `HTTP ${out.status}` }
    if (moved) return { m, level: 'moved', note: `${from} → ${to}` }
    return { m, level: 'ok', note: `HTTP ${out.status}` }
  } catch (err) {
    return { m, level: 'fail', note: err.name === 'AbortError' ? 'timed out' : err.message }
  }
}

const queue = [...museums]
const results = []
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const m = queue.shift()
      const r = await check(m)
      results.push(r)
      process.stdout.write({ ok: '.', blocked: '~', moved: '>', none: '-', fail: 'x' }[r.level])
    }
  }),
)
process.stdout.write('\n\n')

const by = (level) => results.filter((r) => r.level === level)
for (const [level, label] of [
  ['fail', 'BROKEN'],
  ['moved', 'REDIRECTS OFF-HOST'],
  ['blocked', 'UNVERIFIABLE (bot protection)'],
  ['none', 'NO SITE'],
]) {
  const rows = by(level)
  if (!rows.length) continue
  console.log(`${label} (${rows.length}):`)
  for (const r of rows.sort((a, b) => a.m.id.localeCompare(b.m.id))) {
    console.log(`  ${r.m.id.padEnd(26)} ${r.note}`)
    if (r.m.url) console.log(`  ${''.padEnd(26)} ${r.m.url}`)
  }
  console.log()
}

console.log(
  `${by('ok').length} ok, ${by('blocked').length} unverifiable, ${by('moved').length} off-host, ` +
  `${by('none').length} without a site, ${by('fail').length} broken, of ${museums.length}`,
)
if (by('fail').length || by('moved').length) process.exitCode = 1
