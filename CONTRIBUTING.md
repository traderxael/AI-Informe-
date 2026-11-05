# Cómo contribuir

Gracias por querer mejorar **AI Informe**. Este repo es público y toda ayuda es bienvenida:
correcciones, feeds nuevos, mejoras de clasificación, traducciones y documentación.

## Stack

| Capa | Tecnología |
|------|------------|
| Pipeline (Python) | Python 3.11+, `requirements.txt`, scripts en `scripts/` |
| Web (frontend) | React + TanStack Router/Start + Vite + Tailwind 4 |
| Datos | JSON versionado en `public/data/` + markdown en `informes/` |
| CI/CD | GitHub Actions → Vercel (cron diario 12:00 UTC / 09:00 Chile) |

## Setup local

```bash
# 1. Dependencias frontend
npm install

# 2. Dependencias Python
pip install -r requirements.txt

# 3. Variables de entorno (opcional; sin GROQ_API_KEY el informe se publica igual)
cp .env.example .env
```

## Antes de abrir un PR

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # tests frontend (node --test + tsx)
python scripts/test_pipeline.py   # tests del pipeline, sin red
```

Los cuatro tienen que pasar en verde. `ci.yml` corre exactamente estos comandos en cada PR,
así que si fallan localmente, fallarán en GitHub.

## Dónde tocar cada cosa

| Quiero cambiar… | Archivo(s) |
|-----------------|------------|
| La lista de feeds | `scripts/sources.py` (fuente única de verdad) |
| Cómo se genera el markdown | `scripts/generar_informe.py` |
| Clasificación de señales / reglas | `scripts/collect_signals.py` + tests en `scripts/test_pipeline.py` |
| El resumen en español | `scripts/resumir_groq.py` (usa Groq, secret `GROQ_API_KEY`) |
| El ranking de modelos | `scripts/actualizar_modelos.py` (LMArena + OpenRouter) |
| La salud de las fuentes | `scripts/feed_health.py` |
| Las señales de X/Twitter | `scripts/fx_viral.py` (FxTwitter) |
| La portada y sus secciones | `index.html` + `public/static-*.js` |
| El workflow diario | `.github/workflows/informe-diario.yml` |

## Reglas del proyecto

1. **La portada es HTML estático servido por Vercel.** El JS de la portada va en
   `public/static-*.js`, **nunca inline**: la CSP (`script-src 'self'`) bloquea los
   scripts inline que no estén en la lista de hashes de `vercel.json`.
   Si agregas un `<script>` inline, tenés que actualizar el hash en `vercel.json`.
2. **No subas datos generados a mano.** `informes/`, `datos/`, `public/data/` y `web/`
   los regenera el workflow diario. Solo se versionan a mano los JSON de referencia.
3. **No subas secretos.** `.env` está en `.gitignore`. Las claves van en GitHub Secrets
   (`GROQ_API_KEY`, etc.), nunca en el código ni en los logs.
4. **Commits en Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `deps:`,
   `test:`, `ci:`. Ejemplo: `fix(pipeline): no sobrescribir el ranking si la fuente falla`.
5. **Tests para cada cambio de lógica.** Si tocás clasificación o generación, agregá
   el caso a `scripts/test_pipeline.py`.
6. **Un PR hace una cosa.** Si son dos cambios distintos, son dos PRs.

## Reportar un problema

Usá las plantillas de issue (bug report / feature request). Para vulnerabilidades de
seguridad, **no abras un issue**: seguí [SECURITY.md](SECURITY.md).

## Licencia

MIT. Al contribuir aceptás los términos de la [LICENSE](LICENSE).
