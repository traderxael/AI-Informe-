# Module: `scripts/enriquecer_resumenes.py`

Enriquece el resumen de un informe leyendo el contenido de las URLs. 89 líneas.

## Responsibilities
- `extraer_resumen_url(url)` — baja la página y extrae texto útil con regex.
- `enriquecer_informe(fecha)` — reescribe el Markdown del día con resúmenes más largos.

## Public API
- `extraer_resumen_url(url) -> str`
- `enriquecer_informe(fecha=None) -> None`

## Dependencies
- **Usa:** `urllib`, regex, `informes/*.md`.

## Notable Patterns / Gotchas
- No corre en el workflow diario: es una herramienta de mejora manual.
