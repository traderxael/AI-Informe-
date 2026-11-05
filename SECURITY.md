# Seguridad

## Reportar una vulnerabilidad

**No abras un issue público** para reportar una vulnerabilidad.

Reportá por email a **seguridad@traderxael.dev** (o por DM en GitHub a
[@traderxael](https://github.com/traderxael)) con:

- Qué es vulnerable y en qué archivo/línea
- Pasos para reproducirlo (idealmente un PoC mínimo)
- Impacto esperado (qué obtiene el atacante)
- Tus versiones (commit, OS, navegador)

Te respondo en un plazo razonable (idealmente 72 h) y coordinamos el fix y la
divulgación juntos. Si la vulnerabilidad ya está publicada o está siendo explotada
activamente, se disclosure inmediata.

## Versiones con soporte

| Rama | Estado | Soporte |
|------|--------|---------|
| `main` | producción (Vercel) | ✅ sí |
| Ramas antiguas / worktrees | histórica | ❌ no |

Este proyecto no publica releases con números de versión: la versión desplegada es
siempre el último commit de `main`.

## Superficie del proyecto

Como servicio público, este repo tiene dos fronteras:

1. **El pipeline diario** (GitHub Actions). Corre código Python que descarga feeds RSS
   y llama APIs externas (Groq, OpenRouter, FxTwitter, Hugging Face).
2. **La web estática** en Vercel, con `Content-Security-Policy` estricta
   (`script-src 'self'`, sin `unsafe-inline` para scripts).

## Reglas que sigue el proyecto

- **CSP sin `unsafe-inline` para scripts.** Por eso el JS de la portada vive en
  `public/static-*.js` y no en `<script>` inline dentro de `index.html`.
  Si agregás un script inline, actualizá el hash SHA-256 en `vercel.json`.
- **Secretos fuera del repo.** `.env` está en `.gitignore`. Las claves se guardan en
  GitHub Secrets (`GROQ_API_KEY`, `PREVIEW_CLIENT_SECRET`, etc.).
- **Sin datos de usuarios.** El proyecto es un agregador público de noticias: no
  registra cuentas, ni cookies de perfil, ni telemetría con datos personales.
- **Dependencias vigiladas.** Dependabot está activo y CI corre `npm audit` y
  `npm ci` en cada PR. La auditoría se mantiene en **0 vulnerabilidades**.
- **Actualizaciones de runtime.** Node 22 en CI y en desarrollo.

## Qué no hacer con este servicio

- Usar el pipeline para scrapeo masivo o abusivo de terceros (los feeds tienen sus
  propios límites; el script `scripts/auditar_feeds.py` audita la cobertura real).
- Intentar inyectar contenido en la portada a través de los feeds: el pipeline
  clasifica y filtra, pero **reportá** cualquier caso raro en lugar de publicarlo.
- Reutilizar el ranking de modelos como fuente única: refleja el Elo de LMArena en el
  momento de la corrida, con los precios de OpenRouter de ese momento.
