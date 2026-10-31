// Minimal dependency-free static server for the built site (dist/).
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] || process.env.STATIC_DIR || 'dist')
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '0.0.0.0'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No index.html in ${root}`)
  process.exit(1)
}

const insideRoot = (path) => path === root || path.startsWith(root + sep)

const server = createServer((req, res) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Bad request')
    return
  }

  let file = normalize(join(root, pathname))
  if (!insideRoot(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      const fallback = join(root, 'index.html')
      if (!existsSync(fallback)) throw new Error('missing index')
      file = fallback
    }
    const stats = statSync(file)
    res.writeHead(200, {
      'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    })
    if (req.method === 'HEAD') { res.end(); return }
    createReadStream(file).pipe(res)
  } catch (error) {
    console.error(`Failed to serve ${pathname}: ${error.message}`)
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
})

server.listen(port, host, () => {
  console.log(`Serving ${root} on http://${host}:${port}`)
})

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down.`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
