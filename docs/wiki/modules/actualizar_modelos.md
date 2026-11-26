# Module: `scripts/actualizar_modelos.py`

Ranking de modelos: Elo de LMArena (dataset oficial en Hugging Face) × precios de OpenRouter. 314 líneas.

## Responsibilities

- `fetch_lmarena(board="text", limit=60)` — Elo por modelo.
- `fetch_openrouter()` — catálogo y precios.
- `match()` — cruza ambos con `_clave_modelo()`, `normalize_org()`, `infer_licencia()`.
- `construir_payload()` → `escribir_payload()` → `_registrar_historial()` (90 días).

## Key Files

- `scripts/actualizar_modelos.py` — todo el módulo.
- `public/data/modelos.json`, `modelos-history.json` — salida versionada.

## Public API

- `http_json(url, timeout=30, retries=3, backoff=2.0) -> dict`
- `fetch_lmarena(board="text", limit=60) -> dict`
- `fetch_openrouter() -> dict`
- `match(arena, ordr) -> list[dict]`
- `construir_payload(...) -> dict`
- `escribir_payload(payload, paths=None) -> None`
- `_registrar_historial(payload, keep=90) -> None`
- `main() -> None`

## Internal Structure

- `normalize_org()` unifica nombres de organización; `infer_licencia()` deduce open/closed.
- `blendedPerM()` en el frontend usa `inShare=0.75` sobre estos precios.
- El historial de Elo por corrida alimenta `/tendencias`.

## Dependencies

- **Usado por:** `src/lib/informe-data.ts` (`MODELS`), rutas `/tendencias` y `/estadisticas`.
- Workflow: `continue-on-error: true`, pero el gate final exige `modelos.json.total > 0`.

## Notable Patterns / Gotchas

- Si LMArena no responde, **no sobrescribe** el JSON anterior (docencia del README) y el run queda rojo con evidencia.
- Es el único soft-fail que después es verificado duramente por el gate final.
