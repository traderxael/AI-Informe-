# Module: `scripts/sources.py`

**Fuente única de verdad** (102 líneas) de feeds RSS y constantes de clasificación de país/X. Lo leen `generar_informe.py` y `collect_signals.py`.

## Responsibilities

- Definir `FEEDS`: labs USA/Occidente + China + papers + tecnología general.
- Definir `FUENTES_USA` y `FUENTES_CHINA` para `classify_country()`.
- Constantes `X_MAX_POR_CUENTA`, `X_NICHOS_FUERA_DEL_SITIO`.

## Key Files

- `scripts/sources.py` — una sola fuente; docstring cita "hallazgo 4 de la auditoría del pipeline".

## Public API

- `FEEDS: list[tuple[str, str]]`
- `FUENTES_CHINA`, `FUENTES_USA`
- `X_MAX_POR_CUENTA`, `X_NICHOS_FUERA_DEL_SITIO`

## Internal Structure

Feeds verificados el 24-sep-2026 con `scripts/auditar_feeds.py` (usa el `fetch_url` real del pipeline):

- **USA/labs:** OpenAI, Google AI, DeepMind, NVIDIA Blog, Microsoft Research, MarkTechPost, BAIR Berkeley, Google Developers, Hugging Face.
- **Medios:** TechCrunch AI, The Verge AI, MIT Tech Review AI, Ars Technica AI.
- **China:** Synced, QbitAI, SCMP Business.
- **Papers:** arXiv cs.AI, cs.CL.
- Retirados con evidencia: Meta AI (404), VentureBeat (429 permanente), 36Kr (HTML sin items; lo cubre RSSHub local en `docker/rsshub/`), DeepSeek RSS (404 desde 2024; sus lanzamientos llegan vía Synced/QbitAI + X).

## Dependencies

- **Usado por:** `generar_informe.py`, `collect_signals.py`.

## Notable Patterns / Gotchas

- Agregar un feed aquí propaga a **informe y señales** a la vez. Agregarlo en `generar_informe.py` rompe esa garantía.
- Los comentarios explican **por qué** cada feed fue retirado — no borrarlos al limpiar.
- `docker/rsshub/` existe para cubrir 36Kr si se levanta la instancia; el cron no la levanta automáticamente.
