// Ngăn Node.js crash khi có unhandled rejection hoặc exception từ event callbacks
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled rejection (server kept alive):', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught exception (server kept alive):', err.message)
})

import { createAdaptorServer } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocketServer } from 'ws'
import { readFile, stat } from 'fs/promises'
import { join, extname } from 'path'
import { config } from './config.js'
import { handleLiveSession } from './routes/ws.js'
import { sessionRoutes } from './routes/sessions.js'
import { reportRoutes } from './routes/report.js'
import { translateRoutes } from './routes/translate.js'
import { ingestRoutes } from './routes/ingest.js'
import { chatRoutes } from './routes/chat.js'
import { settingsRoutes } from './routes/settings.js'

const app = new Hono()

// In Electron production mode, CORS is not needed (same origin: localhost:3001)
// In dev mode, allow Vite dev server origin
if (!config.electronWebRoot) {
  // Dev mode: allow Vite dev server (5173) and any localhost port for flexibility
  const allowedOrigins = [config.corsOrigin, 'http://localhost:5174', 'http://127.0.0.1:5173']
  app.use('*', cors({
    origin: (origin) => allowedOrigins.includes(origin) ? origin : allowedOrigins[0]!,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }))
}
app.use('*', async (c, next) => {
  console.warn('[HTTP]', c.req.method, c.req.path)
  await next()
  console.warn('[HTTP]', c.req.method, c.req.path, '→', c.res.status)
})
app.get('/health', (c) => c.json({ ok: true }))
app.route('/api/settings', settingsRoutes)
app.route('/api/sessions', sessionRoutes)
app.route('/api/report', reportRoutes)
app.route('/api/translate', translateRoutes)
app.route('/api/ingest', ingestRoutes)
app.route('/api/chat', chatRoutes)

// Electron production mode: serve React build as static files
// Must be registered AFTER all /api routes so API takes precedence
const MIMES: Record<string, string> = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

// Debug endpoint — always available, helps diagnose Electron prod issues
app.get('/debug-env', (c) => c.json({
  electronWebRoot_config: config.electronWebRoot,
  electronWebRoot_env: process.env['ELECTRON_WEB_ROOT'],
  port: config.port,
  nodeEnv: config.nodeEnv,
}))

// Static file handler for Electron production mode.
// Registered unconditionally — reads ELECTRON_WEB_ROOT at request time
// so it works even if config module evaluated before env var was injected.
app.get('*', async (c) => {
  const webRoot = config.electronWebRoot || process.env['ELECTRON_WEB_ROOT'] || ''
  console.warn('[static] GET', c.req.path, '| webRoot:', webRoot || 'NOT SET')

  if (!webRoot) return c.notFound()

  const filePath = join(webRoot, c.req.path)
  if (!filePath.startsWith(webRoot)) return c.text('403', 403)

  try {
    const s = await stat(filePath)
    if (s.isFile()) {
      const data = await readFile(filePath)
      const ct = MIMES[extname(filePath)] ?? 'application/octet-stream'
      return new Response(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
        status: 200,
        headers: { 'Content-Type': ct },
      })
    }
  } catch { /* not a file → SPA fallback */ }

  // SPA fallback: serve index.html for unrecognised paths (React Router)
  try {
    const html = await readFile(join(webRoot, 'index.html'), 'utf8')
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } })
  } catch (e) {
    console.error('[static] Failed to read index.html from:', webRoot, e)
    return c.text(`Server error: cannot read index.html from ${webRoot}`, 500)
  }
})

// createAdaptorServer tạo http.Server mà không start — ta gắn WS vào rồi mới listen
const server = createAdaptorServer(app)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wss = new WebSocketServer({ server: server as any })
wss.on('connection', (ws, req) => {
  if (req.url?.startsWith('/ws/live')) {
    const url = new URL(req.url, 'http://localhost')
    const lang = url.searchParams.get('lang') ?? undefined
    console.warn('[WS] new connection, lang:', lang ?? 'auto-detect')
    void handleLiveSession(ws, lang)
  } else {
    ws.close(1008, 'Unknown endpoint')
  }
})

server.listen(config.port, () => {
  console.warn(`Server: http://localhost:${config.port}`)
  console.warn(`WebSocket: ws://localhost:${config.port}/ws/live`)
})
