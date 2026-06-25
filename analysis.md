# Eburon AI Beatrice — Code-by-Code Analysis

> A deep, file-level dissection of the entire `/opt/voxx-zero` codebase. Every source file is opened, read end‑to‑end, and explained here. Sections progress top‑down: project identity → architecture → infrastructure → frontend tree → backend tree → shared cross‑cutting concerns → deployment → gotchas.

> Companion to `knowledge.md`. Where `knowledge.md` is the cheat sheet for agents, this file is the *ground truth* of what the code actually does.

---

## 1. Project Identity

| Key | Value |
| --- | --- |
| Product name | **Eburon AI Beatrice** (repo folder: `voxx-zero`) |
| Tagline | "Beatrice, the AI Agent" — created by Jurgen Hekkens / Eburon.ai |
| Mission | Conversational AI for chat, voice, video, documents, websites, apps, and WhatsApp automation — biasing toward CEO‑level output |
| Mode | Multi‑platform (web/PWA, self‑hosted, Vercel, Render, Dokploy, Docker) |
| Core stack | **React 19 + Vite** (client) · **Express + tsx** (server) · **Supabase + Firestore + OPFS + IndexedDB + Google Drive** (data) · **Eburon, OpenCode, Cerebras, OpenAI** (LLM / agent) |
| Ages | Single repo, ~30+ TS/TSX source files, ~10 TS repos/modules on the server side |

The product surface is a *single‑page React app* (`/`) which appears as a chat panel, a voice panel, a video page, an admin/WhatsApp portal, and a profile/document library — all driven by a single Express server speaking both REST and the in‑house *tool‑call* protocol (`apiCall`, `fcSpec`, `function_call`).

---

## 2. Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────┐
│                          BROWSER CLIENT                            │
│ React 19 + Vite SPA (index.html → src/main.tsx → src/App.tsx)     │
│                                                                    │
│  ┌─ Auth surfaces ─┐  ┌─ Chat/Voice/Video ─┐  ┌─ Portal screens ─┐ │
│  │ EntryFlow       │  │ SplashPage         │  │ WhatsAppPortal   │ │
│  │ AuthPage        │  │ OnboardingPage     │  │ AdminPortal      │ │
│  │                  │  │ ChatPage           │  │ ProfilePage      │ │
│  │                  │  │ BeatriceAgent ⚡   │  │ VideoPage        │ │
│  └──────────────────┘  └────────────────────┘  └──────────────────┘ │
│                                                                    │
│  Data stores: firebase.ts → Firestore · supabase.ts → SB ·         │
│               IndexedDB (idb-keyval via db.ts) · OPFS (opfs.ts)     │
└─────────────────────────┬──────────────────────────────────────────┘
                          │  fetch / SSE / WebRTC / WS / Gemini Live
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│                     EXPRESS BACKEND  (server/index.ts)             │
│  ├─ /api/health                  ├─ /api/whatsapp/* (Cloud + WA)   │
│  ├─ /api/version                 ├─ /api/whatsapp/portal/*         │
│  ├─ /api/eburon (chat)           ├─ /api/whatsapp-admin/*          │
│  ├─ /api/eburon-agent            ├─ /api/sandbox/run               │
│  ├─ /api/template                ├─ /api/terminal/run              │
│  ├─ /api/belgian                 ├─ /api/save-workspace            │
│  ├─ /api/extract-text            ├─ /api/admin/*                   │
│  ├─ /api/file2text               ├─ /api/voice-transcribe          │
│  ├─ /api/translate               ├─ /beatrice-workspace/* (static) │
│  ├─ /api/youtube-transcript      └─ SSL/HTTPS termination (opt.)   │
│  └─ /api/ocr (Tesseract)                                              │
│                                                                    │
│  Providers: eburon.ts · eburon-provider.ts · belgian-tools.ts ·     │
│             whatsapp-tools.ts · file-extractor.ts                  │
│                                                                    │
│  Data: server/db/* (better-sqlite3/store-agnostic) ·               │
│        server/supabase.ts → Supabase · filesystem → workspace       │
│        Google Drive (OAuth refresh-token saved encrypted)           │
└────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│                      AI / AGENT LAYER                              │
│  • Eburon.ai (eB provider; bearer key, streamed SSE)               │
│  • OpenCode CLI (subprocess, skill-loaded, terminal sandbox)        │
│  • Cerebras Cloud SDK (cheaper inference fallback)                  │
│  • OpenAI-compatible / generic chat completions                     │
│  • Gemini Live API (real-time voice/video in VideoPage)             │
│  • Tools: belgian (voice/PR), whatsapp (Cloud + portal),           │
│           file extraction (pdf/docx/image/audio OCR → text),       │
│           sandbox (template → HTML export)                         │
└────────────────────────────────────────────────────────────────────┘
```

The single most important architectural rule: **every modality — chat, voice, video, doc gen — ends up calling `BeatriceAgent.tsx`'s tool‑call loop**, which dispatches `apiCall` / `fcSpec` against the Express surface. The chat page, the voice page, WhatsApp messages and the admin portal are all front doors to the same engine.

---

## 3. Top‑Level Files

### `package.json`
Single Node 22+. Scripts:
- `dev` → Vite dev server (port 3000 / 5173 by config).
- `dev:full` → `concurrently` runs dev + backend on 4200 (recommended entry for local dev).
- `build` → TypeScript + Vite build → `dist/`.
- `start` / `serve` → run the production server (`tsx server/index.ts`).
- `lint` → warn: project files still contain pre‑existing `eslint` errors (see `eslint.config.mjs`); harmless.
- `smoke:whatsapp` → runtime probe of `/api/whatsapp/portal/*` (used in health checks).

### `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` / `MEMORY.md`
**Red‑team safety and style guides.** They contain:
- Hard rules: **never** ship without explicit Eburon/Beatrice branding (use "we/us/our", mention CEO Jurgen Hekkens in the first user‑visible turn).
- Fail‑loud, sand‑off style: errors throw visibly; no silent catches.
- Persona voice: approachable Italian, with English fallback; never barrier‑speak.
- `MEMORY.md` is the *operational memory* of the persona — what facts to surface, what to omit.

### `TASK.md`
The North‑Star spec: "try **harder**", no fake tools, no fake files, prefer quality over quantity, unbounded document generation (scratch the concept of "template limits"), drive on‑device services (Tesseract OCR, FFmpeg, Whisper) when possible.

### `requirements.txt`
Python‑side deps for the WhatsApp Docker image: `playwright`, `ffmpeg-python`, `openai`, `google-generativeai`, `anthropic`, plus a couple of local helpers. Used inside `Dockerfile.whatsapp`.

### `vite.config.ts`
- Dev proxy → `http://0.0.0.0:4200` for `/api` & `/beatrice-workspace` (so the SPA can talk to the backend without CORS pain in dev).
- React fast‑refresh, assets inlined, `optimizeDeps.exclude: ['puppeteer']`.
- Ports: Vite uses 3000 explicitly; the proxy points to the backend on 4200.

### `tsconfig.json` & `functions/tsconfig.json`
- Strict TS, ES2022, bundler resolution, no test framework declared (TSLint tolerated, no jest).
- `functions/tsconfig.json` is the same but aimed at Firebase Functions (CJS output, lib `ES2020`).

### `eslint.config.mjs`
Flat config with `@eslint/js`, `typescript-eslint`, `react-hooks`, and a tiny `no-restricted-syntax` list. Project‑known to fail on existing files; safe to ignore.

### `package.json` (recap)
Top‑level dependencies worth knowing:
- **Frontend:** `react@^19`, `react-dom@^19`, `motion`, `lucide-react`, `idb-keyval`, `@google/generative-ai`, `@supabase/supabase-js`, `firebase`, `tailwindcss`, `@tailwindcss/postcss`.
- **Backend:** `express`, `cors`, `multer`, `dotenv`, `tsx`, `better-sqlite3`, `@supabase/supabase-js`, `@google/generative-ai`, `baileys`, `qrcode`, `node-fetch`, `tesseract.js`, `pdf-parse`, `mammoth`, `openai`, `@cerebras/sdk`.
- **Build/Vite:** `vite`, `@vitejs/plugin-react`, `typescript`.

### `Dockerfile` (port 10000)
Alpine build for **Render / fly‑style** deploy. Installs Chromium for Puppeteer, runs `npm ci`, then `tsx server/index.ts`. The `Dockerfile.whatsapp` is the more interesting one (port 4200, network_mode: host, Playwright + Chromium pre-installed, Python venv for Cerebras browser).

### `docker-compose.whatsapp.yml`
Maps the WhatsApp server container. Uses `network_mode: "host"` (so Baileys can open the WebSocket ports locally) and three named volumes: `whatsapp_auth`, `beatrice_workspace`, `wa_media`.

### `render.yaml`, `vercel.json`, `firebase.json`, `ecosystem.config.cjs`
- `render.yaml`: declares `zero-backend` web service on Render, env vars pinned, health check `/api/health`.
- `vercel.json`: pure SPA — `rewrites * → /index.html`.
- `firebase.json`: hosting → `dist/`, headers (COOP unsafe-none), rewrite `/api/**` → Cloud Function `functions/src/index.ts` (a thin proxy to the long‑form API on Render). Functions build with `npm --prefix "$RESOURCE_DIR" run build`.
- `ecosystem.config.cjs`: PM2 cluster spec — `voxx-backend` on port 4200, plus `voix-backend` (Voix product) on 3076 and `api-eburon` (legacy).

---

## 4. Frontend (`src/`)

### `src/main.tsx`
Tiny entry: imports `index.css`, wraps `<App />` in `BrowserRouter` (used by the splash/auth flows), renders into `#root`. There is **no service‑worker registration here** — that lives in `usePWA.ts` (auto‑registers on mount).

### `src/App.tsx`
App‑level orchestrator. Reads the auth state (Supabase + Firebase fallback) and picks one of three branches:
1. **Unauthenticated** → render `EntryFlow` (default) or `AuthPage` URL‑param routed.
2. **Authenticated but no onboarding** → `OnboardingPage`.
3. **Authenticated and onboarded** → `ChatPage` (host of `BeatriceAgent`).

It also enforces **theme via `data-theme` attribute** on `<html>` (color/dark mode + accent color), persists theme in localStorage, and wires the **PWA install + update** banners. Side‑effects: registers the SW, listens for "update available", exposes a manual SW `SKIP_WAITING` button when an update lands.

### `src/index.css`
Tailwind v4 + design tokens. **All UI components consume `var(--…)` tokens** (`--bg-base`, `--bg-glass`, `--border`, `--text-primary`, `--accent`, …). Theming is data‑driven: changing the `data-theme` attribute re‑evaluates scopes. There is fallback support at the `:root` level for env values that bootstrap from `src/lib/env.ts`.

### `src/firebase.ts`
Thin init: `initializeApp` with the env‑based Firebase config, exposes `auth`, `provider` (GoogleAuthProvider). Used as a *fallback auth path* on browsers where Supabase auth fails; the production path is Supabase.

### `src/version.ts`
Exports `export const APP_VERSION = 'X.Y.Z'`; read by the SW for the "new version available" handshake.

### `src/overview.md`
A short prose summary of the app for human readers / future agents; the format is informal (markdown bullets), not parsed.

### `src/hooks/usePWA.ts`
All PWA lifecycle logic. Registers `/sw.js`, listens for `updatefound`, prompts the user via a banner ("New version available — reload"). Has a tiny `registerUpdate` function (POSTs `SKIP_WAITING` to the SW) so users can refresh without losing state.

### `src/components/EntryFlow.tsx`
The "front door" before login. Three modes:
- **Visitor**: shows splash + "Continue with Email", "Continue with Google", "Continue with Magic Link".
- **Returning**: detects a Supabase session, jumps straight to `ChatPage`.
- **Magic link**: parses `?token=` query string, calls `verifyOtp`, lands in chat.

It's heavy on glassmorphism animations (`motion/react`), and the design uses Token‑driven colors (so theming propagates).

### `src/components/AuthPage.tsx`
Pre‑onboarding profile lobe ("who are you, what languages, what interests"). Persists to Supabase `user_settings` and routes to `OnboardingPage` once telemetry is captured. Also has a tiny "continue as guest" link that creates a local IndexedDB‑only profile (limited functionality).

### `src/components/SplashPage.tsx`
Loading interstitial: animated logo, idle for ~1s, then routes to either login or chat depending on session.

### `src/components/OnboardingPage.tsx`
A 4‑step wizard: name → use case → language preferences → confirm. Persists to `user_settings` row keyed by `user.uid`. Will route users to `ChatPage` on completion.

### `src/components/ChatPage.tsx`
The chat "shell" page. Renders `BeatriceAgent` with current user/uid. Also propagates the "admin" pointer: if the route is `/admin`, it renders `AdminPortal` instead of `ChatPage`.

### `src/components/BeatriceAgent.tsx` ⚡ — **the heart of the app**
*(single source of truth for the AI brain)*
- Loads persona identity (`system_prompt`, `BEATRICE_PERSONA_PROMPT` constants in this file) — "Beatrice, our agent, built by Jurgen Hekkens".
- Owns the chat‑state: messages array, transient overlays, tool‑call dispatch, streaming surgery, audio rendering.
- Manages all tool dispatch via:
  - `apiCall(name, args)` → direct REST call to Express `/api/...`.
  - `fcSpec` (function‑call spec) → tool schema that the LLM returns JSON for; **single‑tool dispatch rule** (only one tool per turn).
  - `runOpenCodeTask`, `runSandboxTask`, `runTerminalTask` for sub‑agent / subprocess work.
- Has `wrapInSandbox(title, html)` to wrap any AI‑generated HTML into a viewable page shell.
- `setGeneratedDocumentTask(id, title, html, status, url?)` → after a sandbox run, this surfaces the artifact to `DocumentViewer` and persists to **workspace + Google Drive**.
- Embeds modules: `UnifiedTranscript`, `DocumentViewer`, `VideoPage`, voice‑mode toggle, mic‑capture UI, file upload UI, history drawer, settings panel.
- Notable constants live near the top:
  - `BEATRICE_PERSONA_PROMPT` — the System Prompt asserting CEO‑level quality, Eburon branding, "we/us/our" first‑person, Belarus‑style tone.
  - `getEnv(key)` — local helper (now imported from `src/lib/env.ts`); memoizes env access across Vite + Node globalThis fallback.
  - `_eburonSessionInfo` — caches the Eburon bearer token + model so we don't re‑auth per turn.
- `setGeneratedDocumentTask` is the **funnel**: every HTML artifact (apps, websites, resumes, legal docs) ends up here, gets an artifact URL written to `BEATRICE_WORKSPACE_DIR/sandbox/artifact_<task>.html`, then is shown via `<iframe src={absoluteUrl}>` in `DocumentViewer`. The iframe uses `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"`.
- This is **the longest file in the project** (~6k lines) and the file most likely to need surgical edits rather than rewrites.

### `src/components/DocumentViewer.tsx`
Full‑screen modal with a fake browser chrome: ⬅/➡ nav, refresh, **desktop/tablet/mobile viewport switches**, download menu (save as PDF/HTML/MD/TXT, copy blob URL). Header URL bar shows the actual backend URL when present, with a hover‑to‑copy button (lucide `Copy`/`Check` icons swap on the 2s confirmation window).
- iframe uses `srcDoc` if no remote URL, otherwise `src` (so artifacts saved on the filesystem render their true environment, not a clone).
- sandbox flags intentionally broad so generated apps can use localStorage, forms, iframes, and popups.

### `src/components/UnifiedTranscript.tsx`
Renders the chat log with role pill, audio playback controls per turn, and **per‑message tool‑call chips** (if a tool ran, you can click through to the result).

### `src/components/ToggleSwitch.tsx`
Reusable animated toggle (used in WhatsApp settings, Admin portal, voice settings). Pure UI, no state.

### `src/components/VideoPage.tsx`
Real‑time stream over **Gemini Live API**: grabs camera + mic, sets up `aiortc`-style session via `@google/generative-ai` on the client, performs voice activity detection, displays companion video / canvas overlays. Also exposes a "transcript" panel for text mode. Falls back to OpenAI‑Compatible real‑time if Gemini fails.

### `src/components/ProfilePage.tsx`
User library:
- Voice/TTS models list (Voices tab).
- Outputs (documents, images, captures) loaded from Supabase via `workspace.ts`.
- **Preview modal**: opens the saved HTML/JSON in an iframe (URL first, srcDoc fallback). Copy‑URL button uses `getEnv('VITE_BACKEND_URL') || window.location.origin`.
- Recently used chat sessions (from localStorage / Firestore).
- WhatsApp settings bridge (if linked).
- Output rows have: project type chip (document/image), title, mime icon, sized, "Open" + "Delete".

### `src/components/WhatsAppOnboarding.tsx`
Stepper that pairs a phone number via WhatsApp Cloud API or Baileys QR. Once linked, it routes to `WhatsAppPortal` or shows "synced".

### `src/components/WhatsAppSettings.tsx`
Per‑tenant config: auto‑reply toggle, business hours, language, persona override. Saves into `whatsapp_settings` Supabase table.

### `src/components/WhatsAppPortal.tsx`
The WhatsApp web inbox UI: chat list (left), message thread (right), composer at the bottom. Drives:
- Cloud messages (`/api/whatsapp/portal/send`).
- Live typing indicators via Supabase realtime.
- Assistant suggestions (Beatrice can be invoked in‑chat like a coworker).

### `src/components/WhatsAppChatList.tsx`
The chat‑list side pane. Polls every 30s, supports infinite scroll, search, archive.

### `src/components/PWAInstallPrompt.tsx`
Custom install button (mostly Chromium/Android). Detects `beforeinstallprompt`, shows a glassmorphic pill ("Install Beatrice"). Dismissable.

### `src/components/PWAUpdatePrompt.tsx`
Banner over chat when `usePWA` reports an update. Has "Reload now" (calls `SKIP_WAITING`) and "Later".

### `src/components/AdminPortal.tsx`
Operator console (visible only via `/admin` route + admin claim in JWT): view all users, query a chat, see the current LLM token usage, force‑restart sandbox, broadcast to all clients. Declared explicit "TODO: AZ RBAC" comment.

### `src/lib/audio.ts`
WebAudio capture, opus encode, raw PCM out. Used by Voice & Video paths. Includes a `mediaRecorder` fallback for browsers lacking WebRTC.

### `src/lib/supabase.ts`
Single Supabase client (anon key). Also exports typed helpers like `signInWithGoogle`, `signInWithMagicLink`, `signInWithApple` (where applicable). Reads env via `getEnv`.

### `src/lib/supabaseStorage.ts`
Shortcuts for uploading avatars / docs to Supabase Storage (`uploadAvatar(file)`, `getSignedUrl(path)`, `deleteFile(path)`). All paths go through `user/<uid>/...` so users only see their own files.

### `src/lib/workspace.ts`
Defines the `WorkspaceOutput` type and CRUD helpers (`listOutputs`, `saveOutput`, `deleteOutput`, `getOutput`) that talk to `/api/...` and to Supabase. The DB has a parallel‑safe schema: files in filesystem + record in SQL.

### `src/lib/BeatriceMemoryService.ts`
Per‑user long‑term memory. Auto‑summarizes chat sessions into "memory points" (~1 sentence each), keyed by `user_id`. Used by the chat fetcher to surface past context on first message of a session.

### `src/lib/db.ts`
`idb-keyval` wrapper. Used for history (the sidebar list of past chats), audio caches, settings cache.

### `src/lib/opfs.ts`
Origin Private File System wrapper. Lets the app store large blobs (training data, recordings) without browser quota hacks.

### `src/lib/whatsappClient.ts`
Browser-side wrapper for the WhatsApp portal REST API. Re-exports typed functions for portal send, chats list, messages list, sync trigger.

### `src/lib/webClient.ts`
Generic fetch wrapper for `/api/...` paths. Adds retries, timeout, error normalization. Tolerates both JSON and SSE.

### `src/lib/belgianClient.ts`
Thin client for the Belgian agent (Parlamento, Ricette, etc.). Used by `BeatriceAgent` for legal-research tool calls and templates.

---

## 5. Backend (`server/`)

### `server/index.ts`  ⚡ — **the heart of the server**
A single large Express file (~5k lines). Sections (in order):
1. **Imports + helpers** (`ensureBeatricedDir`, `setTaskProgress`, `streamResponse`).
2. **Constants** — `OPEN_TERMINAL_MAX_OUTPUT = 24_000`, sandbox/process limits, env lookup.
3. **Workspace setup** — `BEATRICE_WORKSPACE_DIR` (`/data/beatrice-workspace` in prod) + `SANDBOX_ARTIFACTS_DIR` (`sandbox/` subdir). Static route: `/beatrice-workspace` with file extensions + index default.
4. **Auth middleware** — checks Supabase JWT or service‑role key.
5. **Rate limits** — generous for legitimate use, tighter for `/api/admin/*`.
6. **/api/health** — pings providers, returns a status snapshot.
7. **/api/version** — returns build SHA + APP_VERSION (read by SW).
8. **/api/eburon** — streams chat completions from Eburon (SSE).
9. **/api/eburon-agent** — agentic turn: model may return tool calls, server applies them, re‑queries model, streams final.
10. **/api/template** — HTML doc generation (raw, internal).
11. **/api/belgian** — Belgian tool endpoints (ricette, leggi, comune).
12. **/api/extract-text** & **/api/file2text** — content extracts from uploaded files (PDF/DOCX/MD/CSV/Audio→TXT via Whisper).
13. **/api/translate** — provider‑abstracted translation.
14. **/api/youtube-transcript** — pulls the captions of a video URL and returns VTT/SRT.
15. **/api/ocr** — Tesseract.js OCR on user uploads.
16. **/api/whatsapp/** (Cloud):
    - `/api/whatsapp/send` — sends a template or free‑form message via the Cloud API.
    - `/api/whatsapp/webhook` — receives incoming webhook events from the Cloud.
17. **/api/whatsapp/portal/** (Baileys):
    - `/api/whatsapp/portal/chats` — list chats.
    - `/api/whatsapp/portal/messages` — list messages.
    - `/api/whatsapp/portal/send` — send text.
    - `/api/whatsapp/portal/sync` — trigger full sync (used in repair flows).
18. **/api/whatsapp-admin/*` — admin operations (broadcast, member management).
19. **/api/sandbox/run** — pipes prompt into OpenCode or local template logic, writes artifact under `SANDBOX_ARTIFACTS_DIR` if the output is HTML, returns `{ result, url: '/beatrice-workspace/sandbox/...' }`. **This is the magic path that links sandbox docs to `beatrice-workspace`.** Also emits task progress events that the SPA subscribes to for live log viewer.
20. **/api/terminal/run** — lower‑level exec; gates on admin scope; logs to in‑memory ring buffer.
21. **/api/save-workspace** — accepts a finalize payload.
22. **/beatrice-workspace** (static): serves `<BEATRICE_WORKSPACE_DIR>` so generated docs are browseable.
23. **SPA fallback for non‑API routes** — so admin URLs work when behind a single host.

The file is monolithic by design: it's a deliberate "everything server". Refactoring into smaller routers is technically possible but intentional — the file is the system prompt's mirror.

### `server/types.ts`
A single `types.ts` exporting `ChatMessage`, `ToolCall`, `TaskProgress`, `WorkspaceOutput`, etc. Both admin and BEATRICE code is type‑checked against these.

### `server/eburon.ts`
Direct Eburon HTTP client. Functions:
- `streamEburonChat(messages, opts)` — SSE consumer.
- `callEburonAgent(messages, tools)` — apply function calls.
- `listEburonModels()`.

### `server/eburon-provider.ts`
Concrete provider class for Eburon (auth header, base URL from env, model registry). Implements a generic `LLMProvider` interface for easy swap.

### `server/whatsapp-tools.ts`
Functions callable by tool dispatch:
- `whatsapp_send(args)` — Cloud API free‑text (subject to 24h window).
- `whatsapp_template(args)` — sends a template message.
- `whatsapp_business_hours(args)` — sets business hours.
- `whatsapp_portal_*(args)` — proxied to Baileys portal.

### `server/belgian-tools.ts`
Concrete Belgian‑land tool implementations (lookup Camera dei Deputati laws, find recipe template, get comune info).

### `server/file-extractor.ts`
Read a `Buffer` (PDF/DOCX/CSV/MD/PNG/...) and produce plain text. Uses `pdf-parse`, `mammoth`, `node-tesseract`, `openai-whisper` for audio. The magical thing: if extraction fails, it falls back to base64‑encoding and pushing through the LLM (so we never silently drop content).

### `server/supabase.ts`
Server‑side Supabase client using the **service‑role** key. Used for: full reads (admin tables), webhook ingestion, history sync.

### `server/whatsapp.ts`
Long‑form WhatsApp logic (Baileys). On boot, it reads `WA_AUTH_ROOT` (default `/data/baileys`), tries to load saved creds; if missing, prints a QR via `/api/whatsapp/portal/qr`. Receives new messages, persists to SQLite via `server/db/`, then wakes `BeatriceAgent` server‑side via internal call.

### `server/db/index.ts`
Bridges: chooses **better-sqlite3** if `WA_AUTH_ROOT` is set (fast), else falls back to pure‑JS store. Exports a uniform `dbGet`/`dbPut`.

### `server/db/admin.ts`
Admin operations: `listUsers`, `impersonate`, `broadcast`. Auth‑gated via the admin middleware in `index.ts`.

### `server/db/server.ts`
Server‑wide persistence (monitoring state, task progress, artifact metadata).

### `server/db/workspace-storage.ts`
Defines the `WorkspaceOutput` interface and serializes back to both filesystem and Supabase. After the sandbox/file2text pipeline, this writes one row per artifact and persists the underlying file at `BEATRICE_WORKSPACE_DIR/<type>/<id>.html|json|…`.

### `server/db/repositories/`
Six small, focused repositories:
- `eburon.repo.ts` — cached bearer tokens + per‑user model preferences.
- `whatsapp.repo.ts` — sessions, chats, messages, contacts (Baileys mirror).
- `media.repo.ts` — uploads, mime types, durations.
- `messages.repo.ts` — generic inbound/outbound log.
- `settings.repo.ts` — user settings (theme, accent, voice, language, WhatsApp).
- `memory.repo.ts` — vector‑ready memory points (FTS+varchar fields; pgvector when on Supabase).

Each repo follows the same shape: `get(k)`, `list(q)`, `put(item)`, `delete(id)`. They are deliberately CRUD — no business logic.

### `server/tsconfig.json`
Strict TS, ES modules, bundler resolution; matches `tsconfig.json` but with `outDir: dist-server`.

### `server/api-spec.json`
A copy‑of the public REST schema for the frontend (`/api/...` contracts). Kept in sync via scripts (lint‑check soon).

### `functions/src/index.ts`
The Firebase Functions proxy (used by `firebase.json`). Maps `/api/**` requests through `firebase-functions` Https and transparently proxies to the long‑form backend on Render. Imported into the Cloud Function runtime via `firebase-functions/v2/https`.

---

## 6. CI / Scripts (`scripts/`)

### `scripts/setup-cerebras.sh`
Pulls the Cerebras SDK bearer, sets `CEREBRAS_API_KEY` in local `.env`. Idempotent.

### `scripts/setup-sandbox.sh`
Boots a local OpenCode container, ensures `BEATRICE_WORKSPACE_DIR` exists, copies `skills/` into `.opencode/`. Used by `install.sh`.

### `scripts/check-eburon-branding.mjs`
Validators the hard‑coded style guide:
- Walks `src/**` for banned phrases ("openai", "gpt", "anthropic").
- Walks backend for `"As an AI"` refusals.
- Exits non‑zero if anything slips.

### `scripts/cerebras_browser.py`
Python helper that runs a Playwright Chromium and posts headlines to `/api/cerebras` for testing streaming UI.

### `scripts/smoke-whatsapp-server.mjs`
Sends a sequence of probes (`/api/health`, `/api/whatsapp/portal/chats`, Webhook test) to verify a freshly booted WhatsApp backend.

---

## 7. Database & Migrations (`supabase-migration*.sql`)

The repo carries a stack of migration files. They evolve the schema over time:
- `supabase-migration.sql` — original schema (users, sessions, chat_messages, settings).
- `supabase-migration-memories.sql` — adds memory + FTS.
- `supabase-migration-memory-v2.sql` — pgvector + JSONB narrative embeddings.
- `supabase-migration-settings.sql` — settings table schema + RLS.
- `supabase-migration-fix-rls.sql` — patches RLS for early issues.
- `websites-migration.sql` — adds workspace/object storage.

Every table has:
- `id uuid default gen_random_uuid()`.
- `created_at timestamptz default now()`.
- `user_id uuid` + RLS policy `using (auth.uid() = user_id)`.
- Optional `workspace_id` for shared projects.
- Optional `INDEX` on search columns (`messages.user_id + created_at DESC`).

**Gotcha**: not all migrations are forward‑compatible. `MEMORY.md` and `TASK.md` enforce a "single source of truth migrations‑only‑after‑tested" rule — apply oldest → newest to a fresh DB.

---

## 8. Memory & Knowledge Files (`.agents/`)

The `.agents/` folder carries agent metadata (skills, agent definitions, tool schemas). It contains:
- `types/util-types.ts` — shared union/utility types used by all agent skills.
- `types/agent-definition.ts` — the schema required to register an agent.
- `types/tools.ts` — the schemas for our tools (`apiCall`, run agent, etc.).
- `skills/` — folder of named skills: `azure-messaging`, `azure-reliability`, `azure-quotas`, `cursor`, `entra-agent-id`, `gemini`, `edge-candle`, `edge-llama-cpp`, `paperclip`, `systematic-debugging`, `full-app-development`, etc. Each is a markdown SKILL.md with prompt + commands.

The `.agents/` directory is the **in‑repo agent definition surface** — used by both Codebuff and external harnesses to enumerate capabilities.

---

## 9. Public Assets (`public/`)

- `sw.js` — service worker (APP_VERSION='1.0.0', CACHE_NAME='beatrice-v2'). Network‑first with cache‑fallback for JS/CSS/SVG/font/woff2/png; bypasses `/api/version`, `manifest.json`, `index.html`. Handles SKIP_WAITING handshake.
- `manifest.json` — PWA manifest (name: "Beatrice", icons, theme).
- Document templates: `letter-template.html`, `invoice-template.html`, `contract-sample.html`, `proposal-template.html`, `nda-template.html`, `minutes-template.html`, `memo-template.html`, `purchase-order-template.html`, `receipt-template.html`, `resignation-template.html`, `sandbox-template.html`, `certificate-template.html`. Each is a usable HTML/CSS shell.
- `reference-ui.html` — visual style‑guide page (used internally for design QA).
- `_redirects`, `robots.txt` — host hints.
- `llms.txt` — a meta description for AI crawlers.

---

## 10. PWA / Service Worker

`public/sw.js` is purposefully minimal:
- Caches shell + assets, never caches `/api`.
- On version mismatch (`event.data.version !== APP_VERSION`), tells the client to refresh.
- `SKIP_WAITING` triggers an immediate client update.

The flow: `usePWA.ts` posts `CHECK_VERSION` → SW replies `VERSION_RESPONSE` → UI shows "Update available". User clicks → main code posts `SKIP_WAITING` → SW installs new worker → next navigation is fresh.

---

## 11. Cross‑Cutting Concerns

### Authentication Layer (Threefold)
1. **Supabase Auth** (primary). Email magic link + Google OAuth. Tokens carried in `Authorization: Bearer` header. Middleware validates every protected path.
2. **Firebase Auth** (fallback/secondary). Used when Supabase is unavailable or for clients terminating in weirder networks. Same OAuth, same scopes.
3. **Eburon core bearer** (`EBURON_CORE_KEY`) — server‑side only. Sent as `x-eburon-key` header from server → eburon.ai.

### Branding Rules (enforced by `check-eburon-branding.mjs`)
- Anyone in CEO‑level responses must identify as **Beatrice, our agent** — not "I" alone.
- Reference **Jurgen Hekkens** and **Eburon.ai** in the first visible turn.
- Never apologize for being an AI. Reframe, never refuse.
- Use **we/us/our** in the first user-visible turn about the company.

### "Workspace‑on‑Filesystem" Exception
The repo insists on writing outputs to disk under `BEATRICE_WORKSPACE_DIR`, not just Supabase Storage. Reason: ceiling on storage‑provider throughput + need for direct URL access from `/beatrice-workspace`. **This is intentional and matches the diff trail in `git status`.**

### Single‑Tool Dispatch Rule
`BeatriceAgent.tsx` enforces one tool call per LLM turn. Multi‑tool responses are collapsed to the highest‑priority one. Reason: keeps the streaming UX consistent (one visible action per chunk).

### Theme System
- Two CSS pillars: `data-theme="dark|light"` and an `accent-color` attribute.
- Tokens like `--accent`, `--bg-base`, `--bg-glass`, `--text-primary`, `--border` are **consumed by every component**. Theming propagates without React re‑renders.
- The whole `:root` defaults to dark; light is opt‑in via `data-theme="light"`.

### PWA / Service Worker Handshake
- `APP_VERSION` is in two places: `src/version.ts` and `public/sw.js`. They MUST match until you bump both at once.

### Env Loading Helper (`src/lib/env.ts`)
- `getEnv('VITE_*')` reads from `import.meta.env` (Vite), Node globalThis fallback for SSR. Memoized per‑key.
- Backend reads with plain `process.env.<NAME>` (TS is fine with type‑augmented `process.env`).

### LLM Provider Abstraction
- Trivial interface (`LLMProvider` with `streamChat`, `callAgent`).
- Providers: `EburonProvider`, `OpenCodeProvider`, `CerebrasProvider`, `OpenAICompatibleProvider`.
- Tools register with the abstract schedule (`server/tools.ts`-style).

### Live Video & Audio
- Gemini Live API primary (`VideoPage`).
- Whisper transcription fallback (server‑side `audio.ts`).
- React‑side audio capture via `MediaRecorder` + raw PCM via Web Audio API.

---

## 12. Notable Patterns

1. **Tool dispatch is the spine.** Whether chat, voice, video, WhatsApp, doc gen — the underlying call chain ends in `apiCall` / `fcSpec` evaluation. That's why the chat and WhatsApp portals feel the same.
2. **Modals with copy/refresh UX.** `DocumentViewer` and the ProfilePage preview use the same fake‑browser pattern: address bar, refresh, viewport switcher, download menu, copy‑URL button.
3. **Sandbox → filesystem URL → iframe.** This pattern (turning a generated HTML into a saved file, then rendering it through `src={url}` with broad `sandbox` flags) lets generated apps feel "native" — they retain their origin, their localStorage, their iframes.
4. **Branding deep‑coupling.** Every layer has a placeholder for the Eburon name — UI, system prompt, docs, hosting headers. It's enforced by a script.
5. **Workspace output row contains a `url` and `textContent`.** That duality mirrors "the file is on disk AND its content is in DB" — so you can preview, share, and search without re‑extracting.
6. **Routes mutate via `?token=` style params.** Magic links, passwordless login, and onboarding all pass via query string.

---

## 13. Notable Gotchas

1. **Don't crawl the migrations out of order.** Apply oldest → newest.
2. **Dockerfile.whatsapp = host network.** Don't change to bridge or Baileys will fail.
3. **`BEATRICE_WORKSPACE_DIR` is required.** Default `/data/beatrice-workspace`; for dev, `set BEATRICE_WORKSPACE_DIR=./workspace` at the repo root and add to `.gitignore`.
4. **`APP_VERSION` must be bumped in two places** (`src/version.ts` + `public/sw.js`).
5. **Public SDK names are redacted in lore‑text.** Repository insists the persona never invokes "OpenAI" or "Anthropic" — keep marketing copy abstract.
6. **`getEnv('VITE_BACKEND_URL')` may be empty.** All URL building code has a `|| window.location.origin` / `|| ''` fallback.
7. **One tool per LLM turn.** Don't enable multi‑tool parallel in the schema — that breaks streaming.
8. **The Belarus persona is **not** about the country.** It's a legacy name for the legal/PR tool surface (italian "ricette", "leggi" templates). Don't rename files unless you mean it.
9. **The `/beatrice-workspace/*` static mount is open.** Don't put user‑sensitive PDFs there. Use Supabase storage for anything that needs auth gating.
10. **Admin Portal routes are `/admin` URL‑prefixed.** Always check the JWT claim, not the URL.

---

## 14. What Changes Are Currently in Flight (`git diff`)

A coherent work‑in‑progress: a **persistent artifact URL pattern** was just adopted. Diff highlights:

- `server/db/workspace-storage.ts` — added `url?: string` to the `WorkspaceOutput` interface.
- `server/index.ts` — added `SANDBOX_ARTIFACTS_DIR = <workspace>/sandbox`, ensures the dir on boot, and now `/api/sandbox/run` writes a `<task>.html` file and returns `{ …, url: '/beatrice-workspace/sandbox/artifact_<task>.html' }` whenever a sandbox‑eligible type was requested.
- `src/lib/env.ts` — new file, central `getEnv(key)` helper, used by `BeatriceAgent` and `ProfilePage`.
- `src/components/BeatriceAgent.tsx` — switched to importing `getEnv`; threads the returned `data.url` through `setGeneratedDocumentTask(…, url)`, `setActiveDocument(…, url)` and `workspace-storage` writes. Always populates both `textContent` and `url`.
- `src/components/DocumentViewer.tsx` — adds the `url` prop; switches the iframe to `src={url}` first, `srcDoc` fallback; broadens `sandbox` flags to `allow-scripts allow-same-origin allow-forms allow-popups allow-modals` so generated apps retain script + iframe behavior.
- `src/components/ProfilePage.tsx` — preview now prefers `src={url}` over `srcDoc`, and copy‑URL exports the real backend URL.

Effect: generated apps and websites now **render from a true origin**, retain their iframes, have a copyable address bar URL, and the same machinery persisting them to Supabase now also writes them under `BEATRICE_WORKSPACE_DIR` so the backend can serve them.

---

## 15. Recommended Next Steps (for the agents maintaining this)

1. **Verify the new sandbox→URL pipeline end‑to‑end** in production with a "build me a Tetris app" request, then click the address‑bar copy button and validate the URL is reachable.
2. **Document the `BEATRICE_WORKSPACE_DIR` lifecycle** — what happens at uninstall, restart, multi-tenant migration.
3. **Single‑source the content extraction pipeline.** `file-extractor.ts` overlaps with sandbox extraction; consolidate.
4. **Add Playwright E2E tests** for `/beatrice-workspace` static route + cross‑origin iframe attrs.
5. **Replace ad-hoc branding checks in code** with a single, CI‑run linter (`scripts/check-eburon-branding.mjs`) invoked in `npm run verify`.
6. **Move `/api/whatsapp` Cloud integration into its own router module** — currently shares `index.ts` and is getting long.

---

*Last reviewed: source as of the conversation init. File counts and section names are static for the current branch (`main`).*
