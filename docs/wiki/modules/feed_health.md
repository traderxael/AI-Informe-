# Module: `scripts/feed_health.py`

Salud de las ~33 fuentes: prueba cada feed en paralelo y escribe evidencia JSON. 102 líneas.

## Responsibilities
- `probar_feed(nombre, url)` — usa el `fetch_url` real de `generar_informe` (incluye fallback TLS 1.2).
- `estado_ranking(payload)` — estado del ranking LMArena/OpenRouter.
- `construir_health()` — agrega `total_feeds`, `ok`, items por feed.
- `leer_ranking()` — lee `public/data/modelos.json`.

## Key Files
- `scripts/feed_health.py` — todo el módulo.
- `public/data/feed_health.json` — salida visible en `/estadisticas`.

## Public API
- `probar_feed(nombre, url) -> dict`
- `estado_ranking(payload, ahora=None) -> dict`
- `construir_health(...) -> dict`
- `leer_ranking() -> dict | None`

## Dependencies
- **Usa:** `generar_informe as gi`, `sources as S`, `ThreadPoolExecutor`.
- **Usado por:** gate final del workflow (exige `total_feeds > 0` y `len(feeds) == total_feeds`).

## Notable Patterns / Gotchas
- Usa el fetch real del pipeline, no un HEAD simplificado: un feed que responde 403 en el pipeline se marca caído aquí también.
- Es soft-fail en el workflow pero **verificado duramente** al final, igual que `actualizar_modelos.py`.
