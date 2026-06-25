# AGENTS.md — Voxx-Zero (Beatrice)

## Stack & Entry Points
- **Vite 6 + React 19 + TS 5.8 + Express 4 + Firebase Auth + Supabase + Eburon Core + Baileys WhatsApp**
- **Node 22** root project, **Node 20** for Firebase Functions (`/functions`)
- **Python 3.11+** + Chromium required for browser automation (`scripts/cerebras_browser.py`)

**Entry Points:**
- **Frontend:** `index.html` → `src/main.tsx` → `src/App.tsx` (Vite → `dist/`)
- **Backend:** `server/index.ts` (port 4200 via `tsx`, no compilation)
- **Firebase Functions:** `functions/src/index.ts` (proxies `/api/*` to `168.231.78.113:4200`)
- **Android wrapper:** `flutter/` contains full Flutter PWA→Android wrapper (Bubblewrap)

## Critical Commands
| Task | Command | Notes |
|---|---|---|
| Full dev | `npm run dev:full` | Frontend :3000 + Backend :4200 (shell `&` backgrounding) |
| Frontend only | `npm run dev` | Vite dev server on :3000 |
| Backend only | `npm run dev:api` | `tsx server/index.ts` on :4200 (no watch) |
| **Build** | `npm run build` | **Required before docker build** (→ `dist/`) |
| Type check | `npm run lint` | `tsc --noEmit`. ~18 pre-existing errors — **do not fix**. Not ESLint. |
| Smoke test | `npm run smoke:whatsapp` | Checks `/api/health`, `/api/eburon/provider`, `/api/workspace/list/:userId` |
| Docker build | `npm run docker:whatsapp:build` | Production slim image (needs `dist/`) |
| Docker up/down | `npm run docker:whatsapp:up` / `:down` | Container on :4200, host networking |
| Supabase local | `npm run db:start` / `:stop` / `:reset` / `:migrate` | Supabase CLI |
| **Branding check** | `npm run check:eburon-branding` | Scans git-tracked files for 30+ banned provider strings |

## Architecture Notes
- **Supabase** is primary source of truth. Two clients:
  - `server/db/server.ts` — anon-key for public operations
  - `server/db/admin.ts` — service_role for backend jobs (falls back to `127.0.0.1:54321` locally)
- **`server/db/repositories/`** is the only database access layer (6 repos). Re‑exported via `server/db/index.ts`.
- **`server/db/workspace-storage.ts`** exception: workspace outputs stored as JSON files under `/data/workspace` (or `WORKSPACE_DATA_DIR`), not in Supabase.
- **Eburon Core** is the sole AI provider. All AI calls route through `server/eburon-provider.ts`.
- **WhatsApp** uses `@whiskeysockets/baileys` in `server/whatsapp.ts`. Outbound tools need `delegated_send` permission + user approval. SSE stream at `GET /api/whatsapp/stream/:userId`.
- **No test framework** — manual verification only.

## Key Constraints & Gotchas
1. **Branding tokens:** `npm run check:eburon-branding` scans all tracked source/config/docs for 30+ banned provider strings. **Only `src/lib/voiceSession.ts`** is allowlisted to import `@google/genai` directly. Instruction docs (including this one) are NOT exempt — do not write banned tokens into them.
2. **Model obfuscation:** In `server/eburon-provider.ts`, upstream model IDs are encoded via `String.fromCharCode` to pass branding check. Gitignored `LEGEND.md` maps Eburon aliases to actual upstream IDs. Env vars `EBURON_*_MODEL_ID_INTERNAL` can override defaults.
3. **HMR control:** Set `DISABLE_HMR=true` to stop browser flickering during AI edits (checked in `vite.config.ts`).
4. **ESLint** only checks Firebase security rules (`.rules`), not application TypeScript. Use `npm run lint` (`tsc --noEmit`) for TypeScript errors.
5. **Client‑side imports:** Only `src/lib/voiceSession.ts` may import `@google/genai`. Everything else must import from that wrapper.
6. **Type check errors:** ~18 pre-existing errors in source — **do not fix**. The lint command is `tsc --noEmit` only.
7. **Build order:** Must run `npm run build` before Docker builds — `dist/` is copied into image.

## Sub-Project Boundaries
- **Root project:** Named `react-example` in `package.json`. Houses React app + Express backend.
- **Functions:** `/functions` runs Node 20. Excluded from root `tsconfig.json`. Compile with `npm --prefix functions run build`.
- **Flutter:** `flutter/` holds PWA-to-Android wrapper (Bubblewrap) with platform dirs for Android/iOS/macOS/Linux/Windows.
- **OpenCode Agent:** `.opencode/` contains local agent/sub‑agent runner config (plugin dependency + deploy skill).

## Scripts & Automation
- `scripts/cerebras_browser.py` — Python browser automation (Playwright + Cerebras). Needs Chromium + Python deps (`requirements.txt`).
- `scripts/setup-cerebras.sh` — Installs Python venv + browser deps. Run after `npm install` on VPS if browser automation needed.
- `scripts/setup-sandbox.sh` — Prepares OpenCode sandbox environment.
- `scripts/smoke-whatsapp-server.mjs` — Smoke tests: health, provider listing, workspace list, local LLM models endpoint.
- `scripts/check-eburon-branding.mjs` — Brand validation (run via `npm run check:eburon-branding`).

## Environment Variables
Two env file patterns coexist:

| File | Purpose | Key difference |
|---|---|---|
| `.env` | Dev / local | `VITE_*` prefixed Supabase keys (client-side accessible) |
| `.env.whatsapp` | Docker production | `SUPABASE_*` keys (server-side only, not VITE_ prefixed) |

See `.env.example` and `.env.whatsapp.example` for templates.

## Deployment Options
- **Docker (WhatsApp):** Production container on port 4200. Requires `npm run build` first (`dist/` copied in). Chromium pre‑installed for browser automation.
- **Dokploy:** Uses `docker-compose.dokploy.yml` on port 4200. Runs `tsx` directly from source (no pre‑build). Details in `.opencode/skills/dokploy-deploy/SKILL.md`.
- **Firebase Hosting:** SPA fallback via `firebase.json` rewrites. All `/api/**` calls proxy to Cloud Function, which proxies to VPS at `168.231.78.113:4200`.
- **PM2 (VPS):** `ecosystem.config.cjs` defines 3 managed apps (voxx‑backend :4200, voix‑backend :3076, api‑eburon).
- **Android CI:** `.github/workflows/android-distribution.yml` builds APK via Bubblewrap (`twa-manifest.json`) → Firebase App Distribution on push to `main`.
- **Alternative:** `render.yaml` (Render web service) and `vercel.json` (Vercel SPA rewrite with Vite build).