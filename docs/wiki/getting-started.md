# Getting Started

## Prerrequisitos

- Python 3.12 (CI usa `actions/setup-python` v7; el pipeline declara 3.10+ stdlib).
- Node 22 + npm (solo para el frontend; `npm ci` exige lockfile en sync).
- Git (para el SHA y el push).
- Secrets opcionales: `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`, `RESEND_API_KEY`, `NEWSLETTER_FROM`, `NEWSLETTER_TO`. Sin ellos los pasos se omiten o hacen soft-fail.

## Instalación

```bash
git clone https://github.com/traderxael/AI-Informe-.git
cd AI-Informe-
# El pipeline NO necesita pip install. Para el frontend:
npm ci --no-audit --no-fund
```

## Primer run

```bash
# Generar el informe de hoy (escribe informes/YYYY-MM-DD.md + JSONs)
python scripts/generar_informe.py

# Solo regenerar la web desde los Markdown existentes
python scripts/generar_informe.py --solo-web

# Forzar una fecha específica
python scripts/generar_informe.py --fecha 2026-11-26 --force

# Señales, ranking y salud
python scripts/collect_signals.py
python scripts/actualizar_modelos.py --max 60
python scripts/feed_health.py

#Tests
python scripts/test_pipeline.py
```

## Common Workflows

### Ver el dashboard local

```bash
npm run dev          # vite en 0.0.0.0:8080
npm run typecheck
npm test
npm run build        # vite build && npm run db:migrate
```

### Auditar feeds caídos

```bash
python scripts/auditar_feeds.py
python scripts/feed_health.py
```

### Reparar un día perdido

```bash
python scripts/reparar_agujeros.py   # busca huecos en informes/ dentro de la ventana de 7 días
```

## Configuration

- `scripts/sources.py` — **fuente única de verdad** de feeds y constantes de país/X. Agregar o quitar un feed AQUÍ.
- `scripts/generar_informe.py` — `SECTIONS`, `SECTION_DESEMPATE`, `KEYWORDS`, `X_LIMITE` (12), `SITE_URL`.
- `src/lib/informe-data.ts` — `MODELS`, `SIGNALS`, `SOURCE_LABEL`; los tipos `ModelId`/`Region`/`SourceKind`.
- `web/i18n.json` — textos ES/EN/ZH de la web legacy.
- `.github/workflows/informe-diario.yml` — cron `0 12 * * *`, timeout 45 min, orden de pasos.
- `.env` (no versionado) — `GROQ_API_KEY`, tokens de notificación.

## Donde seguir

- Arquitectura: [architecture.md](architecture.md)
- Mapa de módulos: [README.md#module-map](README.md#module-map)
- Diagramas: [diagrams/sequences.md](diagrams/sequences.md)
