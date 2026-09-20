# AGENTS.md

## Stack
- Vite 8 + React 19 + TanStack Start (SSR), TypeScript, Tailwind v4
- Data: `public/signals.json` (227 signals) + progressive load via `/data/signals-first.json` and `/data/signals-rest.json`
- DB: PGLite (embedded) when `DATABASE_URL` unset; auth disabled with `VITE_AUTH_ENABLED=false`
- Dev server: port 8080 inside container, mapped to host 3000

## Run
```
docker compose -f docker-compose.base44.yml up -d
```

## Key files
- `src/components/informe/week-view.tsx` — main dashboard (filters, stats, signal cards)
- `src/lib/informe-data.ts` — types, model/country metadata, signal loading
- `src/styles.css` — Tailwind theme (dark palette, Fraunces + IBM Plex Sans)

## Verify
- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/` → 200
- Dev server logs: `docker compose -f docker-compose.base44.yml logs web`
