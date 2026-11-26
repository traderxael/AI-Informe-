# Module: `scripts/auditar_feeds.py`

Auditoría puntual de feeds: prueba todas las URLs de `sources.py` en paralelo con el fetch real. 41 líneas.

## Responsibilities
- `probe(item)` — llama a `generar_informe.fetch_url` sobre cada `(nombre, url)`.
- Reporta cuáles responden y cuáles no; se usó el 24-sep-2026 para reemplazar Meta AI (404) y VentureBeat (429).

## Public API
- `probe(item) -> tuple`

## Dependencies
- **Usa:** `sources as S`, `generar_informe as G`, `concurrent.futures`.

## Notable Patterns / Gotchas
- Es una herramienta **manual**, no corre en el cron. Si un feed nuevo no se audita, puede colarse muerto.
- Los comentarios en `sources.py` documentan el resultado de esta auditoría; no borrarlos.
