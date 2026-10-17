# AGENTS.md — AI-Informe (Base44 dev environment)

## What this app is

TanStack Start (React 19) + Vite 8 single-page app. A daily AI-news briefing
dashboard ("Informe semanal de IA"). The repo also contains a Python pipeline
(scripts/*.py, GitHub Actions) that generates the JSON data and a static
`web/` site — those are NOT what runs in the Base44 preview; the TanStack app
in `src/` is.

## How to run it here

```bash
docker compose -f docker-compose.base44.yml up -d
# preview on host port 3000 -> container vite dev on 8080
```

## Non-obvious setup findings

- **Start via `npm run dev`, never `node scripts/with-app-env.mjs vite ...` directly.**
  The wrapper spawns `vite` as a bare child process, which only resolves because
  `npm run` prepends `node_modules/.bin` to PATH. Calling the wrapper outside npm
  fails with `spawn vite ENOENT` — this is the error that made the main update
  "fail to start" when the dev environment was first wired up.
- **No external database or secrets needed to boot.** `src/lib/db.ts` falls back
  to an in-memory PGLite (Postgres-WASM) when `DATABASE_URL` is unset; there are
  no `migrations/*.sql` at the top level (only opt-in `migrations/auth/`), so the
  PGLite bootstrap is skipped entirely. Auth is off by default
  (`VITE_AUTH_ENABLED` unset → `emailAndPasswordEnabled = false`).
- **The app 307-redirects `/` → `/?region=all&model=all&tab=briefing`.** SSR uses
  the static `SIGNALS` array in `src/lib/informe-data.ts` (13 signals, old date);
  the client then fetches the live JSON under `public/data/` (signals-first.json,
  signals-rest.json, modelos.json) and hydrates with the real daily data. So the
  data updates from the github-actions daily commits DO show up in the preview.
- Vite dev server binds `0.0.0.0:8080` (strictPort) per `vite.config.ts`; the
  compose maps host 3000 → container 8080 and passes
  `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` so the preview origin is accepted.

## Verifying it works

- `curl -sL http://localhost:3000/` → HTTP 200, SSR HTML with the briefing UI.
- `npm run typecheck` and `npm run build` both pass inside the container.
- The live preview renders the dashboard with 222 signals and the current date,
  no console errors.
