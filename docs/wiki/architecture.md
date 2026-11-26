# Architecture

## Forma del sistema

AI-Informe- es un pipeline **batch diario** sin servidor propio: GitHub Actions corre a las 12:00 UTC, genera artefactos versionados en el repo, y Vercel los sirve como web estática + PWA. La línea de publicación es estrictamente Python stdlib (sin `pip install`), porque un lockfile desincronizado de npm costó un día entero el 25-oct-2026. La línea del frontend corre en un job paralelo (`gate-web`) que puede pintar el run en rojo pero **nunca impide la publicación**.

La entrada de datos son ~33 feeds RSS (labs USA/China, papers, medios), Google News multi-país, Reddit, HN y la API de FxTwitter para X. La salida son seis artefactos: `informes/YYYY-MM-DD.md`, `web/*.json` + `web/index.html`, `public/data/*.json`, `public/feed.xml` / `feed.atom`, `datos/fx_viral_*.json` y el historial de Elo.

El estado vive en archivos JSON versionados, no en base de datos para el informe. El frontend sí usa `better-auth` + PGlite/Neon (`src/lib/db.ts`) para la capa de cuenta.

## Components

- **publicar (job)** — secuencia Python tolerante a fallos. Detalle en [workflows](modules/workflows.md).
- **gate-web (job)** — `npm ci` → typecheck → tests → lint → build. Paralelo, no bloqueante.
- **generar_informe** — orquestador; detalle en [generar_informe](modules/generar_informe.md).
- **sources** — catálogo de feeds; detalle en [sources](modules/sources.md).
- **collect_signals** — señales y KPIs; detalle en [collect_signals](modules/collect_signals.md).
- **fx_viral** — X; detalle en [fx_viral](modules/fx_viral.md).
- **actualizar_modelos** — ranking; detalle en [actualizar_modelos](modules/actualizar_modelos.md).
- **web (TanStack Start)** — rutas y libs; detalle en [informe-data](modules/informe-data.md).
- **Verificación final** — bloque inline en el workflow que valida los artefactos **después** del commit.

## System Diagram

```mermaid
flowchart TD
    CRON([cron 12:00 UTC / dispatch]) -> PUB["publicar (Python)"]
    CRON -> GATE["gate-web (npm)"]
    PUB -> TEST["test_pipeline.py"]
    TEST -> FX["fx_viral.py (soft-fail)"]
    FX -->|"datos/fx_viral_*.json"| GEN
    GEN["generar_informe.py"] -->|"informes/*.md"| WEB["actualizar_web.py"]
    GEN -->|"public/data/*.json + web/index.html"| VERIFY
    GEN -> FEED["generar_feed.py"]
    FEED -->|"feed.xml / feed.atom"| VERIFY
    REPAIR["reparar_agujeros.py (soft-fail)"] -.-> GEN
    SIG["collect_signals.py"] -->|"signals-first/rest.json"| VERIFY
    GROQ["resumir_groq.py (soft-fail)"] -.-> SIG
    MOD["actualizar_modelos.py (soft-fail)"] -->|"modelos.json + history"| VERIFY
    HEALTH["feed_health.py (soft-fail)"] -->|"feed_health.json"| VERIFY
    VERIFY["Commit + push informes web public datos"] -> CHECK{{"Verificar artefactos"}}
    CHECK -> NOTIFY["notificar.py (soft-fail)"]
    CHECK -> NEWS["enviar_newsletter.py (soft-fail)"]
    PUB -.->|"Vercel deploy"| SITE([ai-informe.vercel.app])
    GATE -.->|"pinta rojo, no bloquea"| SITE
```

## Data Flow

1. **Feeds RSS** — `sources.FEEDS` → `generar_informe._fetch_one()` ( paralelo, TLS 1.2 fallback ) → `parse_feed()` → items crudos.
2. **Clasificación** — `classify()` por keywords con `SECTION_DESEMPATE`; `classify_country()`; `filtrar_items()` descarta promo y sin señal IA → `relevancia()` ordena.
3. **X** — `fx_viral.py` consulta cuentas + búsquedas de nicho,.cachea imágenes y escribe el JSON del día; `generar_informe.x_items()` lo lee y agrega la sección `x`.
4. **Render** — `render_markdown()` → `informes/YYYY-MM-DD.md`; `export_web_json()` → JSONs; `regenerate_web()` → `web/index.html` + i18n ES/EN/ZH.
5. **Enriquecimiento** — señales, Groq, LMArena×OpenRouter y salud de fuentes escriben en `public/data/`.
6. **Evidencia** — `Commit` + gate final valida que nada quedó vacío.

## Key Design Decisions

- **Python stdlib en publicar**: cero dependencias pip; `requirements.txt` solo documenta dependencias opcionales futuras.
- **X antes que el informe**: el orden viejo generaba el informe sin la sección X del día.
- **`--force` es idempotente**: `write_informe()` regenera siempre porque el filtro del día pudo cambiar; `--force` quedó para uso manual.
- **`web/informes-historico.json` separado**: issue #30 evitó recrear la copia duplicada de `public/data/`.
- **Acciones pinnadas por SHA**: `actions/checkout@3d3c42e...`, `setup-python@6d4fd22...`, `setup-node@949feb2...`.
- **Concurrency**: cron usa `group: informe-diario`, `cancel-in-progress: false`; CI usa `cancel-in-progress: true`.
- **Timeout 45 min**: pbs.twimg.com se colgaba con 3 intentos × 25 s y el run quedaba horas.

## Puntos de fragilidad (lo que se puede romper)

| Cambio | Riesgo | Evidencia |
|---|---|---|
| Agregar feed en `generar_informe.py` en vez de `sources.py` | El informe y las señales divergen | Docstring de `sources.py`, "hallazgo 4" |
| Mover `fx_viral.py` después del informe | Sección X vacía | Comentario en el workflow |
| `npm ci` con lockfile desync | Día perdido (antes mataba `publicar`) | Comentario en el job, 25-oct-2026 |
| Quitar `continue-on-error` a Groq/LMArena/X | Un fallback tumba la publicación | Diseño explícito del workflow |
| Publicar JSON vacío sin el gate final | Web en blanco sin aviso | Bloque "Verificar artefactos publicados" |
| Cambiar `SECTION_DESEMPATE` | Noticias de seguridad se van a "usos" | Comentario en `generar_informe.py` |
| Cambiar el formato del Markdown de `render_markdown()` | `parsear_informe()` deja de extraer secciones | Acoplamiento `actualizar_web.py` ↔ `generar_informe.py` |
| Editar `MODELS` / `SIGNALS` embebidos en TS sin regenerar | La web sigue con datos viejos (salvo capa live) | `src/lib/informe-data.ts` + `live-feed.ts` |
