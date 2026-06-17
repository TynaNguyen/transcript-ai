/**
 * Electron main process
 *
 * Dev:  server chạy riêng (`npm run dev` trong apps/server)
 *       BrowserWindow load http://localhost:5173 (Vite)
 *
 * Prod: utilityProcess.fork() chạy bundled Hono server (ESM-safe)
 *       ELECTRON_WEB_ROOT → Hono serve React build
 *       BrowserWindow load http://localhost:3001
 */

import {
  app, BrowserWindow, shell, dialog, utilityProcess,
  Tray, Menu, nativeImage, screen, ipcMain,
} from 'electron'
import type { UtilityProcess, NativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import { deflateSync } from 'zlib'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import { parse as parseEnv } from 'dotenv'

// ── Constants ────────────────────────────────────────────────────────────────

const DEV = !app.isPackaged
const SERVER_PORT = 3001
const SERVER_READY_TIMEOUT_MS = 15_000
const COMPACT_W = 380
const COMPACT_H = 540

// ── Window references ────────────────────────────────────────────────────────

let mainWin: BrowserWindow | null = null
let tray: Tray | null = null
let compactWin: BrowserWindow | null = null

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveResource(...parts: string[]): string {
  return path.join(process.resourcesPath, ...parts)
}

/** Parse .env file properly using dotenv — handles quotes, inline comments, multi-line values */
function loadEnvFile(envPath: string) {
  if (!existsSync(envPath)) {
    console.warn('[desktop] .env not found at:', envPath)
    return
  }
  const parsed = parseEnv(readFileSync(envPath, 'utf8'))
  for (const [key, val] of Object.entries(parsed)) {
    if (!(key in process.env)) process.env[key] = val
  }
  console.warn('[desktop] Loaded .env from:', envPath, '— keys:', Object.keys(parsed).length)
}

function waitForServer(): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(`http://localhost:${SERVER_PORT}/health`)
        .then((r) => { if (r.ok) resolve(); else throw new Error(`${r.status}`) })
        .catch((err: unknown) => {
          if (Date.now() - start > SERVER_READY_TIMEOUT_MS) {
            reject(new Error(`Server timeout. Last: ${String(err)}`))
          } else {
            setTimeout(check, 400)
          }
        })
    }
    check()
  })
}

// ── Tray icon: programmatic 22×22 circle PNG (no external asset needed) ──────

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = (CRC32_TABLE[(crc ^ b) & 0xFF] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, 'latin1')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function createCirclePNG(size: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 4  // bit depth 8, color type RGBA
  const rows: number[] = []
  const mid = (size - 1) / 2, r = size / 2 - 1.5
  for (let y = 0; y < size; y++) {
    rows.push(0)  // None filter byte per row
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - mid) ** 2 + (y - mid) ** 2)
      rows.push(0, 0, 0, d <= r ? 255 : 0)  // RGBA: black circle, transparent bg
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.from(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function createTrayIconImage(): NativeImage {
  const iconPath = DEV
    ? path.join(__dirname, '..', 'build', 'trayIconTemplate.png')
    : path.join(process.resourcesPath, 'trayIconTemplate.png')
  const img = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createFromBuffer(createCirclePNG(22))
  img.setTemplateImage(true)  // macOS: auto-adapt for dark/light mode
  return img
}

// ── Server ───────────────────────────────────────────────────────────────────

let serverProcess: UtilityProcess | null = null

async function startServer(): Promise<void> {
  if (DEV) {
    console.log('[desktop] Dev — expecting server on', SERVER_PORT)
    return
  }

  const serverBundle = resolveResource('bundled-server', 'index.js')
  const webDistDir   = resolveResource('web-dist')
  const envFile      = resolveResource('.env')

  console.warn('[desktop] resourcesPath:', process.resourcesPath)
  console.warn('[desktop] bundle exists:', existsSync(serverBundle))
  console.warn('[desktop] web dist exists:', existsSync(webDistDir))
  console.warn('[desktop] .env exists:', existsSync(envFile))

  if (!existsSync(serverBundle)) {
    throw new Error(`Bundled server not found:\n${serverBundle}`)
  }

  // Load .env first so API keys are in process.env before fork
  loadEnvFile(envFile)

  // utilityProcess.fork() — Electron's dedicated API for Node.js child processes
  // Supports ESM natively, uses Electron's embedded Node runtime
  serverProcess = utilityProcess.fork(serverBundle, [], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT:               String(SERVER_PORT),
      ELECTRON_WEB_ROOT:  webDistDir,
    },
  })

  serverProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[server] ${d}`))
  serverProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[server] ${d}`))
  serverProcess.on('exit', (code) => {
    console.error('[desktop] Server process exited, code:', code)
  })

  await waitForServer()
  console.warn('[desktop] Server ready on port', SERVER_PORT)
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

// ── Main window ───────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  mainWin = win

  const url = DEV ? 'http://localhost:5173' : `http://localhost:${SERVER_PORT}`
  void win.loadURL(url)

  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith('http')) void shell.openExternal(u)
    return { action: 'deny' }
  })

  win.webContents.on('did-finish-load', () => {
    void win.webContents.executeJavaScript(`document.body.classList.add('electron')`)
  })

  win.on('closed', () => { if (mainWin === win) mainWin = null })

  if (DEV) win.webContents.openDevTools()
}

function showMainWindow() {
  const wins = BrowserWindow.getAllWindows().filter(w => w !== compactWin && !w.isDestroyed())
  if (wins.length > 0) {
    const win = wins[0]!
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  } else {
    createWindow()
  }
}

// ── Compact overlay window ────────────────────────────────────────────────────

function getCompactPosition(): { x: number; y: number } {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return { x: width - COMPACT_W - 16, y: height - COMPACT_H - 16 }
}

function createCompactWindow() {
  const { x, y } = getCompactPosition()
  compactWin = new BrowserWindow({
    width: COMPACT_W,
    height: COMPACT_H,
    x,
    y,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  const base = DEV ? 'http://localhost:5173' : `http://localhost:${SERVER_PORT}`
  void compactWin.loadURL(`${base}/live?compact=true`)

  // When compact navigates to report page, promote it to a full-size main window
  compactWin.webContents.on('will-navigate', (_, url) => {
    if (!compactWin || !url.includes('/report/')) return
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const w = Math.min(1280, width - 80)
    const h = Math.min(800, height - 80)
    compactWin.setAlwaysOnTop(false)
    compactWin.setSkipTaskbar(false)
    compactWin.setBounds({ x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h }, true)
    compactWin.webContents.once('did-finish-load', () => {
      void compactWin?.webContents.executeJavaScript(`document.body.classList.add('electron')`)
    })
    mainWin = compactWin
    compactWin = null
  })

  compactWin.once('ready-to-show', () => compactWin?.show())
  compactWin.on('closed', () => { compactWin = null })
}

function toggleCompactWindow() {
  if (compactWin && !compactWin.isDestroyed()) {
    if (compactWin.isVisible()) { compactWin.hide() } else { compactWin.show(); compactWin.focus() }
    return
  }
  createCompactWindow()
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray() {
  tray = new Tray(createTrayIconImage())
  tray.setToolTip('Transcript AI — Click to record')

  const menu = Menu.buildFromTemplate([
    { label: 'Start Recording', click: toggleCompactWindow },
    { label: 'Open Transcript AI', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => { tray?.destroy(); tray = null; stopServer(); app.quit() } },
  ])

  tray.setContextMenu(menu)
  tray.on('click', toggleCompactWindow)        // macOS left-click, Windows left-click
  tray.on('double-click', toggleCompactWindow) // Windows double-click
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.on('close-compact', () => compactWin?.close())

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'A new version of Transcript AI has been downloaded.',
      detail: 'Restart the app now to apply the update.',
      buttons: ['Restart & Update', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    }).catch(() => { /* ignore */ })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message)
  })

  autoUpdater.checkForUpdatesAndNotify().catch(() => { /* no network — silent */ })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await startServer()
    createWindow()
    createTray()
    if (!DEV) setupAutoUpdater()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[desktop] Startup failed:', msg)
    dialog.showErrorBox('Transcript AI — Startup Error', msg)
    app.quit()
  }

  // macOS: clicking the dock icon re-opens the main window
  app.on('activate', () => { showMainWindow() })
})

app.on('window-all-closed', () => {
  // Keep the process alive in the tray — user quits via Tray → Quit
  if (!tray) {
    stopServer()
    app.quit()
  }
})

app.on('before-quit', () => {
  tray?.destroy()
  tray = null
  stopServer()
})
