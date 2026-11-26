# AI-Informe-

Recopilación **diaria y automática** de noticias de IA (novedades, usos reales, economía, señales de futuro, seguridad y viralidad en X). El pipeline es **Python puro (stdlib 3.10+)** en GitHub Actions; publica un informe Markdown versionado, JSON para una web SvelteKit/TanStack en Vercel, RSS/Atom y PWA instalable.

README original: `README.md` · SHA analizado: `c51dcc5087e6f39f43da57e16bb94b59c2bdc348` · Generado: 2026-11-26T15:36:03Z · 20 módulos documentados de 18 scripts + frontend + workflows.

## Key Concepts

- **Fuente única de verdad** — `scripts/sources.py` define `FEEDS`, `FUENTES_USA`, `FUENTES_CHINA` y las constantes de X; lo leen `generar_informe.py` y `collect_signals.py`. Nacer duplicando feeds fue el "hallazgo 4" de la auditoría.
- **Soft-fail por diseño** — X (FxTwitter), Groq, LMArena, feed_health, Telegram, newsletter y reparación son `continue-on-error: true`. Ninguno tumba la publicación del día.
- **Artefactos como evidencia** — el run commitea `informes/`, `web/`, `public/` y `datos/`. Hay un gate final que falla el run **después** de publicar si `modelos.json`, `feed_health.json` o `feed.xml` quedan vacíos.
- **Separación publicar vs. gate** — desde el 25-oct-2026 `publicar` (solo Python) y `gate-web` (npm) corren en paralelo. Un lockfile roto ya no puede perder el informe del día.
- **Clasificación con desempate** — `SECTION_DESEMPATE` prioriza `seguridad > economía > futuro > usos > novedades > x` para noticias con múltiples keywords.
- **País** — `classify_country()` usa título + fuente (labs chinos: Synced, QbitAI) y, para X, la etiqueta de nicho de la cuenta (`china-ai` → china).
- **Lookback de 7 días** — `reparar_agujeros.py` regenera días perdidos mientras los feeds aún traen los items.

## Entry Points

- [`scripts/generar_informe.py`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/generar_informe.py) — orquestador del informo: `collect_items()` → `x_items()` → `render_markdown()` → `export_web_json()` → `regenerate_web()`. Flags: `--fecha`, `--force`, `--solo-web`.
- [`scripts/collect_signals.py`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/collect_signals.py) — señales reales (Google News + RSS + Reddit + HN) → `public/data/signals-first.json` / `signals-rest.json`.
- [`scripts/fx_viral.py`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/fx_viral.py) — viralidad de X → `datos/fx_viral_YYYY-MM-DD.json`. Corre **antes** que el informe.
- [`.github/workflows/informe-diario.yml`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/.github/workflows/informe-diario.yml) — cron `0 12 * * *` UTC (09:00 Chile verano / 08:00 invierno), `workflow_dispatch`, timeout 45 min.
- [`src/router.tsx`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/src/router.tsx) — frontend TanStack Router: `/`, `/noticias`, `/tendencias`, `/estadisticas`, `/analitica`.

## High-Level Architecture

Dos líneas que se encuentran en el JSON: la línea de **publicación** (X → RSS → informe Markdown → JSON → web → feed → commit) y la línea de **enriquecimiento** (señales, resúmenes LLM, ranking Elo, salud de fuentes), ambas tolerantes a fallos. La web lee los JSON versionados y además tiene una capa "live" (`src/lib/live-feed.ts`) que mapea `LiveRaw → Signal`. Ver [architecture.md](architecture.md).

## Module Map

| Módulo | Propósito |
|---|---|
| [`scripts/generar_informe.py`](modules/generar_informe.md) | Motor del informe: fetch RSS, clasificación, render Markdown y export web |
| [`scripts/sources.py`](modules/sources.md) | Catálogo único de feeds y constantes de país/X |
| [`scripts/collect_signals.py`](modules/collect_signals.md) | Señales multi-fuente con balance USA/China y traducción |
| [`scripts/fx_viral.py`](modules/fx_viral.md) | Monitor de X, descarga de imágenes/avatares, payload viral |
| [`scripts/actualizar_modelos.py`](modules/actualizar_modelos.md) | Elo LMArena × precios OpenRouter + historial |
| [`scripts/actualizar_web.py`](modules/actualizar_web.md) | Historical de informes Markdown → JSON de la web |
| [`scripts/resumir_groq.py`](modules/resumir_groq.md) | Resumen del día y traducción de señales vía Groq |
| [`scripts/test_pipeline.py`](modules/test_pipeline.md) | Suite Python de clasificación/filtros (1684 líneas) |
| [`src/lib/informe-data.ts`](modules/informe-data.md) | Tipos, catálogo de modelos, señales y búsqueda del frontend |
| [`.github/workflows`](modules/workflows.md) | Orquestación CI, publicación diaria y gates |
| [`scripts/generar_feed.py`](modules/generar_feed.md) | RSS 2.0 + Atom 1.0 para suscriptores |
| [`scripts/reparar_agujeros.py`](modules/reparar_agujeros.md) | Self-healing: regenera días perdidos (ventana 7 días) |
| [`scripts/feed_health.py`](modules/feed_health.md) | Salud de 33 feeds con evidencia JSON |
| [`scripts/notificar.py`](modules/notificar.md) | Resumen diario a Telegram/Discord |
| [`scripts/enviar_newsletter.py`](modules/enviar_newsletter.md) | Email vía Resend |
| [`scripts/auditar_feeds.py`](modules/auditar_feeds.md) | Auditoría manual de feeds (hallazgo 4) |
| [`scripts/enriquecer_resumenes.py`](modules/enriquecer_resumenes.md) | Enriquece resúmenes leyendo URLs |
| [`scripts/scraper_noticias.py`](modules/scraper_noticias.md) | Scraper Camoufox + HN ( experimentation, no cron ) |
| [`scripts/servidor_csp.py`](modules/servidor_csp.md) | Servidor local con headers CSP para QA |
| [`scripts/resumir_con_llm.py`](modules/resumir_con_llm.md) | Variante multi-proveedor (Moonshot/OpenAI) del resumen |

### Inventario completo (18 scripts Python, 6.185 líneas)

| Script | Líneas | Corre en cron | Doc |
|---|---|---|---|
| `generar_informe.py` | 1370 | ✅ | [✓](modules/generar_informe.md) |
| `test_pipeline.py` | 1684 | ✅ (gate) | [✓](modules/test_pipeline.md) |
| `fx_viral.py` | 702 | ✅ soft | [✓](modules/fx_viral.md) |
| `collect_signals.py` | 533 | ✅ | [✓](modules/collect_signals.md) |
| `actualizar_modelos.py` | 314 | ✅ soft | [✓](modules/actualizar_modelos.md) |
| `resumir_groq.py` | 243 | ✅ soft | [✓](modules/resumir_groq.md) |
| `resumir_con_llm.py` | 141 | ❌ manual | [✓](modules/resumir_con_llm.md) |
| `scraper_noticias.py` | 168 | ❌ manual | [✓](modules/scraper_noticias.md) |
| `actualizar_web.py` | 148 | ❌ manual | [✓](modules/actualizar_web.md) |
| `generar_feed.py` | 144 | ✅ | [✓](modules/generar_feed.md) |
| `enviar_newsletter.py` | 114 | ✅ soft | [✓](modules/enviar_newsletter.md) |
| `sources.py` | 102 | ✅ (import) | [✓](modules/sources.md) |
| `reparar_agujeros.py` | 104 | ✅ soft | [✓](modules/reparar_agujeros.md) |
| `feed_health.py` | 102 | ✅ soft | [✓](modules/feed_health.md) |
| `notificar.py` | 97 | ✅ soft | [✓](modules/notificar.md) |
| `enriquecer_resumenes.py` | 89 | ❌ manual | [✓](modules/enriquecer_resumenes.md) |
| `servidor_csp.py` | 89 | ❌ manual | [✓](modules/servidor_csp.md) |
| `auditar_feeds.py` | 41 | ❌ manual | [✓](modules/auditar_feeds.md) |

## Getting Started

Ver [getting-started.md](getting-started.md).

## Diagramas

- [Diagrama de clases](diagrams/class-diagram.md)
- [Secuencias](diagrams/sequences.md)
