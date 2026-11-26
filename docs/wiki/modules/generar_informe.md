# Module: `scripts/generar_informe.py`

Orquestador de 1370 líneas. Descarga RSS, clasifica, filtra, integra X, renderiza Markdown y exporta todos los JSON de la web. **No tiene dependencias externas** (solo stdlib).

## Responsibilities

- Fetch paralelo de feeds con `fetch_url()` (retries=2, backoff=2, TLS fallback).
- `parse_feed()` → `classify()` → `filtrar_items()` → `relevancia()`.
- Integración de X vía `leer_x_json()` / `x_items()` (límite 12).
- `render_markdown()` → `write_informe()` → `export_web_json()` → `regenerate_web()`.
- Generación de feeds RSS/Atom es un script aparte (`generar_feed.py`).

## Key Files

- `scripts/generar_informe.py` — todo el módulo en un archivo.
- `scripts/sources.py` — fuente de `FEEDS`, `FUENTES_CHINA/USA` importadas arriba del todo.

## Public API

- `fecha_larga(day) -> str`
- `fetch_url(url, timeout=20, retries=2, backoff=2.0) -> bytes | None`
- `parse_feed(xml_bytes) -> list[dict]`
- `classify(title, summary, source="") -> str`
- `classify_country(title, source) -> str`
- `relevancia(item, now) -> float`
- `filtrar_items(items) -> tuple[list, dict]`
- `collect_items(day, lookback_hours=168, parallel=True) -> list`
- `x_items(datos, limite=12) -> list`
- `render_markdown(day, items) -> str`
- `md_to_html(md) -> str`
- `regenerate_web() -> None`
- `export_web_json(day, items) -> None`
- `write_informe(day, force) -> Path`

## Internal Structure

- `ROOT = Path(__file__).resolve().parent.parent`; dirs `informes/` y `web/`.
- `SECTIONS` con seis claves (novedades, usos, economía, futuro, seguridad, x); `SECTION_DESEMPATE` evita que seguridad caiga en usos.
- `KEYWORDS` por sección: economía (funding, valuation, ipo), futuro, usos, seguridad, novedades.
- `X_PAIS_POR_CUENTA = {"china-ai": "china"}` — el país de X sale de la etiqueta, no del texto.
- `write_informe()` siempre regenera (comentario 24-sep): `--force` quedó para uso manual.

## Dependencies

- **Usa:** `sources`, `xml.etree.ElementTree`, `urllib`, `email.utils`, `datetime`.
- **Usado por:** workflow `informe-diario.yml`, `scripts/reparar_agujeros.py`, `scripts/actualizar_web.py`.

## Notable Patterns / Gotchas

- `href_seguro()` y `_enlace_md()` sanitizan enlaces antes del HTML.
- `es_promo()` y `tiene_senal_ia()` filtran publicidad y ruido sin señal IA.
- `regenerate_web()` reescribe `web/index.html` desde los Markdown; si falla i18n, ES/EN/ZH se rompe.
- X es **soft-fail**: si `datos/fx_viral_<fecha>.json` no existe, el informe se publica igual.
