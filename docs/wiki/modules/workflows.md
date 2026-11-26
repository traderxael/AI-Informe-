# Module: `.github/workflows`

Dos workflows: `informe-diario.yml` (publicación) e `ci.yml` (calidad en PR/push a main).

## Responsibilities

- `informe-diario.yml`: cron `0 12 * * *` + dispatch; jobs `publicar` y `gate-web` en paralelo; timeout 45 min; commit de `informes web public datos`.
- `ci.yml`: en PR y push a main → lint, typecheck, tests (frontend + Python), build; timeout 20 min.

## Key Files

- `.github/workflows/informe-diario.yml` — ver [flujo completo](../diagrams/sequences.md).
- `.github/workflows/ci.yml` — gates de calidad.

## Public API

- `workflow_dispatch` manual con las mismas garantías que el cron.

## Internal Structure

**Orden de `publicar` (crítico):**
1. Checkout → setup Python 3.12 → `test_pipeline.py` (bloqueante).
2. `fx_viral.py` (soft-fail) → escribe JSON de X.
3. `generar_informe.py` → Markdown + web + JSONs.
4. `generar_feed.py` → RSS/Atom.
5. `reparar_agujeros.py` (soft-fail) → días perdidos.
6. `collect_signals.py` (`TRANSLATE_MAX=40`) → señales.
7. `resumir_groq.py --max 24` (soft-fail) → resumen/traducciones.
8. `actualizar_modelos.py --max 60` (soft-fail) → ranking.
9. `feed_health.py` (soft-fail) → salud.
10. Commit + push → `notificar.py` (soft-fail) → `enviar_newsletter.py` (soft-fail).
11. **Verificar artefactos** (inline): `modelos.json.total > 0`, `feed_health.json` completo, `feed.xml` con `<item>`.

**`gate-web`:** `npm ci` → `typecheck` → `test` → `lint` → `build`. Puede pintar rojo; no puede impedir el commit de `publicar`.

## Dependencies

- Secrets: `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `DISCORD_WEBHOOK_URL`, `RESEND_API_KEY/FROM/TO`.
- Actions pinnadas por SHA (v7 / pinned commits).

## Notable Patterns / Gotchas

- `concurrency`: cron `cancel-in-progress: false` (no perder el día); CI `true` (ahorrar runners).
- `continue-on-error: true` en 7 pasos: **solo** `test_pipeline.py`, `generar_informe.py`, `generar_feed.py`, commit y verificación son bloqueantes.
- El comment del 25-oct-2026 explica por qué `publicar` es solo Python: `npm ci` desincronizado mató un día completo.
- El gate final corre **después** del commit: el error es visible pero la evidencia ya está publicada.
