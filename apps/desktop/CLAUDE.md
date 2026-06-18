# Electron Desktop App — apps/desktop/

> Đọc thêm root `CLAUDE.md` để biết coding laws, naming, security rules.

---

## Kiến trúc

```
Electron Main Process (Node.js)
  ├── utilityProcess.fork() → Hono server (bundled via ncc)
  │     → ELECTRON_WEB_ROOT trỏ tới apps/web/dist/
  │     → Hono serve static files tại GET /* khi env đó được set
  └── BrowserWindow load http://localhost:3001
        → Same origin, không cần CORS
```

**Biến môi trường quan trọng:**
- `ELECTRON_WEB_ROOT` — chỉ set trong production; khi không set → Hono không serve static → app hiện 404

**Dev vs Production:**
| | Dev | Production |
|---|---|---|
| React | `localhost:5173` (Vite) | `localhost:3001` (Hono static) |
| Server | `tsx` watch | `ncc` bundled JS |
| CORS | `corsOrigin: localhost:5173` | không cần (same origin) |

---

## Build pipeline

```bash
cd apps/web    && npm run build              # → apps/web/dist/
cd apps/server && npx ncc build src/index.ts -o ../desktop/bundled-server --transpile-only
cd apps/desktop && npx electron-builder     # đóng gói thành DMG/exe
```

- `@vercel/ncc` bundle toàn bộ server + node_modules vào 1 file JS
- `electron-builder` đóng gói: Electron runtime + bundled server + React dist

---

## IPC — compact window

```typescript
// preload.ts exposes window.electronCompact:
setPinned(pinned: boolean)          // set alwaysOnTop
openReport(sessionId, reportId)     // mở report trong main window
openMainApp()                       // focus/open main window
```

Mọi IPC channel đều định nghĩa trong `src/preload.ts` (contextBridge) và handle trong `src/main.ts` (ipcMain.on).
Sau khi sửa `preload.ts` phải chạy `npx tsc` để compile lại `dist/preload.js`.

---

## macOS permissions (entitlements.mac.plist)

- `com.apple.security.device.audio-input` — microphone
- `com.apple.security.device.camera` — screen capture (optional)

---

## Quy trình release

```bash
# 1. Bump version trong apps/desktop/package.json
#    "version": "1.1.0" → "1.2.0"

git add apps/desktop/package.json
git commit -m "chore: bump version to 1.2.0"
git tag v1.2.0
git push && git push --tags
```

GitHub Actions (`.github/workflows/release.yml`) trigger khi push tag `v*`:
- Build 3 OS song song (macOS/Windows/Linux), mất ~10-15 phút
- `releaseType: "release"` đã set → publish trực tiếp, không tạo draft
- Theo dõi tại `https://github.com/TynaNguyen/transcript-ai/actions`

**Nhắc user sau khi release:**
- Auto-update **không hoạt động** trên macOS chưa code sign → bảo user tải DMG thủ công:
  - `https://github.com/TynaNguyen/transcript-ai/releases`
  - Mac M1/M2/M3 → `Transcript-AI-x.x.x-arm64.dmg`
  - Mac Intel → `Transcript-AI-x.x.x.dmg`
  - Windows → `Transcript-AI-Setup-x.x.x.exe`
- Nếu macOS báo **"app bị hỏng"** → `xattr -cr "/Applications/Transcript AI.app"`

---

## Pitfalls

**Dev server conflict:** Packaged app check port 3001 — nếu dev server đang chạy, app dùng nhầm dev server (không có `ELECTRON_WEB_ROOT`) → hiện 404. Tắt `npm run dev` trước khi test production app. Kiểm tra: `http://localhost:3001/debug-env` — nếu thấy `nodeEnv: "development"` thì đang bị conflict.

**Stale .js artifacts:** Không được chạy `tsc` trong `apps/web/` mà thiếu `noEmit: true` — sẽ sinh `.js` cạnh `.tsx`, Vite load nhầm file cũ → blank screen. `apps/web/tsconfig.json` đã có `"noEmit": true`.
