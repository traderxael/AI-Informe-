# Module: `scripts/reparar_agujeros.py`

Self-healing: detecta días sin informe y los regenera mientras los feeds todavía traen los ítems. 104 líneas.

## Responsibilities
- `fechas_existentes(informes_dir)` —(set de fechas con Markdown).
- `agujeros_recientes()` / `agujeros_antiguos()` — separan huecos recoverables de los viejos.
- `main()` — rellena los recientes llamando a `generar_informe`.

## Key Files
- `scripts/reparar_agujeros.py` — todo el módulo.
- `informes/*.md` — entrada y salida.

## Public API
- `hoy_utc() -> date`
- `fechas_existentes(informes_dir) -> set[date]`
- `agujeros_recientes(...)`, `agujeros_antiguos(...)`

## Internal Structure
- Importa `generar_informe as gi` y reusa su `collect_items()` directamente.
- Ventana de lookback: **7 días** (fuera de esa ventana los feeds ya no traen los items).

## Dependencies
- **Usa:** `generar_informe`, `datetime`, `pathlib`.
- **Usado por:** workflow, con `continue-on-error: true`.

## Notable Patterns / Gotchas
- Advisory: nunca tumba la publicación del día; los agujeros viejos solo se listan en el log.
- Como reusa `gi.collect_items()`, cualquier cambio de firma en esa función rompe la reparación.
