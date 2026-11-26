# Module: `scripts/test_pipeline.py`

Suite Python de 1684 líneas que valida clasificación, filtros, feeds y detector de agujeros. Se corre **primero** en `publicar` y también en `ci.yml`.

## Responsibilities

- Tests sobre `classify()`, `classify_country()`, `filtrar_items()`, `es_promo()`, `tiene_senal_ia()`.
- Regresiones documentadas: "filtro antibacterial" (publicidad), desempate seguridad/usos, X antes que el informe.
- Verifica que todos los feeds de `sources.py` respondan al fetch real.

## Key Files

- `scripts/test_pipeline.py` — todo el módulo (más grande que `generar_informe.py`).

## Public API

- `python scripts/test_pipeline.py` — ejecuta toda la suite (stdlib `unittest`).

## Internal Structure

- Los tests son **regresiones de incidentes reales**: cada fix del pipeline tiene su test.
- Corre sin dependencias externas (solo stdlib), igual que el pipeline.

## Dependencies

- **Usa:** `generar_informe`, `sources`, `reparar_agujeros`.
- **Usado por:** `informe-diario.yml` (paso 1 de `publicar`) y `ci.yml`.

## Notable Patterns / Gotchas

- Si un test falla, el `publicar` se detiene **antes** de publicar — a diferencia de los soft-fail posteriores. Es el único gate verdaderamente bloqueante del día.
- Agregar un feed sin test puede dejar pasar un 403; por eso `auditar_feeds.py` existe aparte.
