#!/usr/bin/env node
// Zero-dependency static server for local development.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.PORT ?? 5173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)

  // redirect rather than rewrite, so the page's relative asset paths resolve
  if (path === '/') {
    res.writeHead(302, { Location: '/web/' }).end()
    return
  }

  // keep requests inside the project directory
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const info = await stat(file)
    const target = info.isDirectory() ? join(file, 'index.html') : file
    const body = await readFile(target)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
  }
})

server.listen(PORT, () => console.log(`museo → http://localhost:${PORT}`))
