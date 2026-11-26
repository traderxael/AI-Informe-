# Module: `scripts/collect_signals.py`

Recolecta **señales reales** de Google News (multi-país), RSS, Reddit y HN; balancea USA/China y traduce al español. 533 líneas.

## Responsibilities

- `query_gnews(q, hl, gl)` — Google News por país/idioma.
- `parse_rss_items()`, `social_feeds()` — RSS + Reddit/HN.
- `classify_models()`, `classify_country()`, `detect_lang()`, `translate_es()`.
- `recolectar()` → `main()` aplica ventana de 21 días, `MAX_PER_COUNTRY=60`, `MAX_TOTAL=300`.

## Key Files

- `scripts/collect_signals.py` — todo el módulo.

## Public API

- `get(url, timeout=18) -> bytes | None`
- `query_gnews(q, hl, gl) -> list[dict]`
- `parse_rss_items(data) -> list[dict]`
- `classify_models(blob) -> list[str]`
- `classify_country(title, source, hint) -> str`
- `detect_lang(text) -> "es"|"en"|"zh"|"other"`
- `translate_es(text, src_lang) -> str`
- `recolectar() -> list[dict]`
- `main() -> int`

## Internal Structure

- Ordena priorizando señales con modelo detectado, luego por fecha (`published`).
- Escribe `public/data/signals-first.json` y `signals-rest.json` con `generated_at`, `count`, `sources`.
- `TRANSLATE_MAX` (env del workflow, 40) limita cuántas señales se traducen con Groq después.
- `source_kind()` distingue laboratorio / medio / comunidad / paper.

## Dependencies

- **Usa:** `sources` (misma fuente de verdad), `urllib`, XML stdlib.
- **Usado por:** workflow; `resumir_groq.py` traduce su salida; `src/lib/live-feed.ts` mapea el JSON al frontend.

## Notable Patterns / Gotchas

- `split_gnews_title()` separa "Título - Medio" de Google News; cambiarlo rompe el `publisher`.
- `is_junk_title()` filtra titulares basura; `classify_country` usa `hint` de la query para desambiguar.
- Si el ranking cae, el gate final del workflow no revisa signals — solo modelos/health/feed.
