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
import { app, BrowserWindow, shell, dialog, utilityProcess } from 'electron';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse as parseEnv } from 'dotenv';
// ── Constants ────────────────────────────────────────────────────────────────
const DEV = !app.isPackaged;
const SERVER_PORT = 3001;
const SERVER_READY_TIMEOUT_MS = 15_000;
// ── Helpers ──────────────────────────────────────────────────────────────────
function resolveResource(...parts) {
    return path.join(process.resourcesPath, ...parts);
}
/** Parse .env file properly using dotenv — handles quotes, inline comments, multi-line values */
function loadEnvFile(envPath) {
    if (!existsSync(envPath)) {
        console.warn('[desktop] .env not found at:', envPath);
        return;
    }
    const parsed = parseEnv(readFileSync(envPath, 'utf8'));
    for (const [key, val] of Object.entries(parsed)) {
        if (!(key in process.env))
            process.env[key] = val;
    }
    console.warn('[desktop] Loaded .env from:', envPath, '— keys:', Object.keys(parsed).length);
}
function waitForServer() {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            fetch(`http://localhost:${SERVER_PORT}/health`)
                .then((r) => { if (r.ok)
                resolve();
            else
                throw new Error(`${r.status}`); })
                .catch((err) => {
                if (Date.now() - start > SERVER_READY_TIMEOUT_MS) {
                    reject(new Error(`Server timeout. Last: ${String(err)}`));
                }
                else {
                    setTimeout(check, 400);
                }
            });
        };
        check();
    });
}
// ── Server ───────────────────────────────────────────────────────────────────
let serverProcess = null;
async function startServer() {
    if (DEV) {
        console.log('[desktop] Dev — expecting server on', SERVER_PORT);
        return;
    }
    const serverBundle = resolveResource('bundled-server', 'index.js');
    const webDistDir = resolveResource('web-dist');
    const envFile = resolveResource('.env');
    console.warn('[desktop] resourcesPath:', process.resourcesPath);
    console.warn('[desktop] bundle exists:', existsSync(serverBundle));
    console.warn('[desktop] web dist exists:', existsSync(webDistDir));
    console.warn('[desktop] .env exists:', existsSync(envFile));
    if (!existsSync(serverBundle)) {
        throw new Error(`Bundled server not found:\n${serverBundle}`);
    }
    // Load .env first so API keys are in process.env before fork
    loadEnvFile(envFile);
    // utilityProcess.fork() — Electron's dedicated API for Node.js child processes
    // Supports ESM natively, uses Electron's embedded Node runtime
    serverProcess = utilityProcess.fork(serverBundle, [], {
        stdio: 'pipe',
        env: {
            ...process.env,
            PORT: String(SERVER_PORT),
            ELECTRON_WEB_ROOT: webDistDir,
        },
    });
    serverProcess.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
    serverProcess.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));
    serverProcess.on('exit', (code) => {
        console.error('[desktop] Server process exited, code:', code);
    });
    await waitForServer();
    console.warn('[desktop] Server ready on port', SERVER_PORT);
}
function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}
// ── Window ───────────────────────────────────────────────────────────────────
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
    });
    const url = DEV ? 'http://localhost:5173' : `http://localhost:${SERVER_PORT}`;
    void win.loadURL(url);
    win.webContents.setWindowOpenHandler(({ url: u }) => {
        if (u.startsWith('http'))
            void shell.openExternal(u);
        return { action: 'deny' };
    });
    // Inject electron class on <body> so CSS can style traffic-light area + drag region
    win.webContents.on('did-finish-load', () => {
        void win.webContents.executeJavaScript(`document.body.classList.add('electron')`);
    });
    if (DEV)
        win.webContents.openDevTools();
}
// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    try {
        await startServer();
        createWindow();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[desktop] Startup failed:', msg);
        dialog.showErrorBox('Transcript AI — Startup Error', msg);
        app.quit();
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on('window-all-closed', () => {
    stopServer();
    if (process.platform !== 'darwin')
        app.quit();
});
app.on('before-quit', stopServer);
//# sourceMappingURL=main.js.map