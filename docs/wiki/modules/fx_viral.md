# Module: `scripts/fx_viral.py`

Monitor de viralidad en X vía FxTwitter (API pública). 702 líneas. Escribe `datos/fx_viral_YYYY-MM-DD.json` que el informe consume.

## Responsibilities

- `fetch_search()` y `fetch_profile_statuses()` consultan trends, cuentas monitorizadas y búsquedas de nicho.
- `es_reciente()` (ventana `VENTANA_DIAS`), `MIN_VIEWS`, `es_propio()`, `filtrar_por_autoria()`.
- Descarga y cachea imágenes/avatares (`cachear_imagen`, `cachear_avatar`, `limpiar_cache`).
- `payload_web()` genera el JSON con `viral`, `trends`, `generado`, `hoy`.

## Key Files

- `scripts/fx_viral.py` — todo el módulo.
- `datos/fx_viral_*.json` — cola de contenido versionada para AutoClip.

## Public API

- `api_get(base, path, params, intentos=3) -> dict | None`
- `fetch_search(base, query, count=20) -> list[dict]`
- `clasificar(texto, tema_fijo=None) -> str`
- `es_reciente(valor, dias=VENTANA_DIAS, ...) -> bool`
- `cachear_imagen(url, tweet_id, destino_dir, ...) -> str`
- `payload_web(viral, hoy, generado, limite=24) -> dict`
- `pool_ia(viral, limite=40) -> list[dict]`
- `main() -> int`

## Internal Structure

- `CUENTAS` = lista de `(handle, etiqueta, tema_fijo)`. La etiqueta `china-ai` marca laboratorios chinos.
- `LOCAL_API` (localhost:8787) vs `DEFAULT_API`; flag `--local`.
- Flags: `--count`, `--incluir-retweets`, `--sin-cache`.
- `X_PAIS_POR_ETIQUETA` en `generar_informe.py` depende de estas etiquetas.

## Dependencies

- **Usado por:** `generar_informe.x_items()` → sección "x" del informe + feed.
- Workflow lo corre **antes** del informe con `continue-on-error: true`.

## Notable Patterns / Gotchas

- Si la API falla, el informe se publica sin sección X — diseño intencional.
- Las imágenes se cachean en el repo; `pbs.twimg.com` colgaba el run → timeout de 45 min en el workflow.
- `--sin-cache` deja hotlinks (útil para prueba, no para producción).
