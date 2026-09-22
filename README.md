# AI Informe

Recopilación **diaria y automática** de noticias de IA (novedades, usos reales, economía, señales de futuro). Python + GitHub Actions, publicado en Vercel.

[![GitHub Actions](https://img.shields.io/github/actions/workflow-status/traderxael/AI-Informe-/informe-diario.yml?branch=main&style=flat-square)](https://github.com/traderxael/AI-Informe-/actions)
[![Último commit](https://img.shields.io/github/last-commit/traderxael/AI-Informe-/main?style=flat-square)](https://github.com/traderxael/AI-Informe-/commits/main)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)](LICENSE)
[![Vercel](https://img.shields.io/badge/deploy-vercel-black?style=flat-square)](https://ai-informe-dashboard.vercel.app)

## Ver el dashboard

| Entorno | URL |
|--------|-----|
| Producción | [ai-informe-dashboard.vercel.app](https://ai-informe-dashboard.vercel.app) |
| Repositorio | [github.com/traderxael/AI-Informe-](https://github.com/traderxael/AI-Informe-) |

## Qué hace de verdad

- RSS públicos (labs, medios, Google News multi-país, HN, Reddit con degradación suave).
- Informe markdown diario en `informes/YYYY-MM-DD.md`.
- JSON para la web: `public/data/signals-first.json`, `signals-rest.json`, `modelos.json`.
- Ranking de modelos: Elo LMArena × precios OpenRouter (job del cron, no bloquea si falla).
- La portada **carga esas señales**, no una semana congelada.
- Sin API keys obligatorias. Resúmenes LLM (`scripts/resumir_con_llm.py`) son opcionales y **no** corren en el cron.

X / Instagram / TikTok / Xiaohongshu solo si levantás RSSHub local (`docker/rsshub`) y `social_sources.json`.

## Estructura

```
scripts/
  sources.py              # lista única de feeds
  generar_informe.py      # RSS → markdown + web/
  collect_signals.py      # Google News + RSS → public/data/signals-*.json
  actualizar_modelos.py   # LMArena + OpenRouter → public/data/modelos.json
  test_pipeline.py        # tests sin red
informes/                 # un markdown por día
public/data/              # JSON que consume la web
web/                      # HTML generado de los markdown
.github/workflows/informe-diario.yml
```

## Uso local

```bash
python scripts/test_pipeline.py
python scripts/generar_informe.py
python scripts/collect_signals.py
python scripts/actualizar_modelos.py --max 60
```

Web (si usás el frontend TanStack):

```bash
npm install && npm run dev
```

## GitHub Actions

Cron `0 12 * * *` (09:00 Chile). Pasos: tests → informe → señales (máx. 40 traducciones MyMemory) → ranking de modelos → commit a `main`.

Si el push a `main` falla por required checks, el job `generar` no puede ser un status check obligatorio sobre sí mismo: desactivalo o permití bypass a `github-actions[bot]`.

## Licencia

MIT — ver [LICENSE](LICENSE).
