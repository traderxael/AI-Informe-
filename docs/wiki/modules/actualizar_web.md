# Module: `scripts/actualizar_web.py`

Convierte todos los `informes/*.md` en JSON histórico para la web. 148 líneas.

## Responsibilities

- `parsear_informe(md_path)` — extrae fecha, total y `por_seccion` del Markdown.
- Cuenta noticias por país (`usa`, `china`, `global`).
- Escribe `web/informes-historico.json` (todos los días) y `web/informes.json` (formato simple, compatibilidad).

## Key Files

- `scripts/actualizar_web.py` — todo el módulo.
- `informes/*.md` — entrada; `web/informes*.json` — salida.

## Public API

- `parsear_informe(md_path: Path) -> dict`
- `main() -> None`

## Internal Structure

- `INFORMES_DIR = ROOT / "informes"`; omite archivos que empiezan con `_`.
- Ordena por fecha; imprime resumen con conteo USA/China/Global.

## Dependencies

- **Relación con `generar_informe.py`:** este último llama `regenerate_web()` directamente; `actualizar_web.py` es la reconstrucción histórica separada.
- **Issue #30:** el export histórico usa `informes-historico.json` para no recrear la copia duplicada de `public/data/`.

## Notable Patterns / Gotchas

- Cambiar el formato del Markdown rompe `parsear_informe()` — es un parser frágil acoplado a `render_markdown()`.
- `web/informes.json` solo guarda la sección `novedades` por compatibilidad con la web vieja.
