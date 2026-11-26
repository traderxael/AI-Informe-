# Module: `scripts/scraper_noticias.py`

Scraper alternativo con Camoufox (browser stealth) más Hacker News simple. 168 líneas.

## Responsibilities
- `scrape_con_camoufox(url, selector_css)` — renderiza JS y extrae con selector CSS.
- `scrape_hackernews_simple()` — HN vía HTTP simple, sin browser.
- `scrapear_todas_fuentes()` — itera las fuentes configuradas.
- `guardar_historial(noticias)` — persiste resultados.

## Public API
- `scrape_con_camoufox(url, selector_css) -> list[dict]`
- `scrape_hackernews_simple() -> list[dict]`
- `scrapear_todas_fuentes() -> list[dict]`
- `guardar_historial(noticias) -> None`

## Dependencies
- **Usa:** Camoufox (browser), `urllib`, `html.escape`.

## Notable Patterns / Gotchas
- **No corre en el cron**: el pipeline de producción es solo stdlib y RSS. Este módulo es experimenting/fallback.
- Camoufox está instalado en `C:\Users\USUARIO\camofox-browser` (puerto 9377), fuera del repo.
