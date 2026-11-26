# Module: `scripts/generar_feed.py`

Genera los feeds **RSS 2.0 y Atom 1.0** para suscriptores. 144 líneas, stdlib puro (`xml.sax.saxutils.escape`).

## Responsibilities
- `load_items()` — lee el informe recién generado y extrae los ítems.
- `rss(items, now)` y `atom(items, now)` — construyen ambos formatos con fechas RFC-2822 / ISO-8601.
- `main()` — escribe `public/feed.xml` y `public/feed.atom`.

## Key Files
- `scripts/generar_feed.py` — todo el módulo.
- `public/feed.xml`, `public/feed.atom` — salida versionada.

## Public API
- `_parse_fecha(value) -> datetime | None`
- `load_items() -> list[dict]`
- `rss(items, now) -> str`
- `atom(items, now) -> str`

## Dependencies
- **Usa:** Markdown del informe generado por `generar_informe.py`.
- **Usado por:** gate final del workflow (exige `feed.xml` con `<item>`).

## Notable Patterns / Gotchas
- Corre **después** de `generar_informe.py`; si el informe no existe, el feed sale vacío y el gate final falla.
- `escape()` de `xml.sax.saxutils` evita XML malformado con títulos que traen `&` o `<`.
