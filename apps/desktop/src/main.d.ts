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
export {};
//# sourceMappingURL=main.d.ts.map