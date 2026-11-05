# Changelog

Todas las novedades relevantes de **AI Informe**. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/).

El sitio en producción es siempre el último commit de `main`. Los informes diarios
se publican automáticamente y no se listan aquí uno por uno.

## [No publicado]

### Corregido
- **CSP**: el script que carga el archivo de informes en la portada estaba inline en
  `index.html` y su hash no estaba en la lista de `vercel.json`, por lo que el navegador
  lo bloqueaba y la sección "Archivo de informes" quedaba vacía en producción. Se movió
  a `public/static-archivo.js`, igual que el resto del JS de la portada.
- **CSP**: scripts inline bloqueados en `public/pwa/app.html`, `static/pwa/app.html` y
  `docs/index.html` (registro de Service Worker, prompt de instalación y filtros de
  búsqueda). Ahora son archivos externos servidos desde el mismo origen.
- **Dependencias**: `minimatch` actualizado a `^11.0.1` (DoS por amplificación de
  `globparts`, CVE reportado por Dependabot). `npm audit` queda en 0 vulnerabilidades.

### Añadido
- **Sección "Lo que la IA está haciendo ahora mismo"**: grid en la portada con las
  publicaciones **con imagen** de las cuentas de X que se monitorean (NVIDIA, Google DeepMind,
  OpenAI, Anthropic…), ordenadas por alcance. `fx_viral.py` ahora guarda las imágenes
  (`public/data/x-viral.json`) y `public/static-x.js` las pinta.
- **Feed RSS + Atom** (`public/feed.xml`, `public/feed.atom`) con las noticias del día,
  regenerado por el workflow diario; botón y `<link rel="alternate">` en la portada.
- **Buscador full-text** del archivo (30 días) en la portada.
- **Notificaciones** opcionales por Telegram/Discord y **newsletter** por Resend.
- `CONTRIBUTING.md`, `SECURITY.md` y este `CHANGELOG.md`.
- Sección de **Tendencias** (Elo de LMArena con historial diario en SVG) y de
  **Estadísticas** (señales, Elo promedio, feeds, organizaciones y fuentes) en la portada.
- Toggle **ES/EN** y botón de **compartir** en la portada (`public/static-i18n.js`,
  `public/static-secciones.js`).
- Historial diario del ranking en `public/data/modelos-history.json`.
- Archivo de informes consultable desde la web (`public/data/archivo.json`).
- `robots.txt` y `sitemap.xml` reales en producción.
- Capturas reales de la portada en el README (`screenshots/readme/`) y un script para
  regenerarlas (`scripts/capturar_readme.mjs`).

### Cambiado
- Los enlaces "Tendencias" y "Estadísticas" de la portada apuntan a anchors reales
  (`#tendencias`, `#estadisticas`) en vez de rutas que volvían a cargar la portada.
- La portada carga las señales **del día** en vivo en vez de una semana congelada.
- El pipeline se auto-repara: si un run falla, recupera los informes faltantes y publica
  sin bloquearse por el gate de npm.

## [2026-10-27]

### Corregido
- Recuperación de feeds con TLS 1.2 (fallaban con 403), clasificación de arXiv y
  robustez de la salud de fuentes.
- Estado del ranking y salud de fuentes visibles en la web.
- `better-auth` 1.7.14: corrige 1 vulnerabilidad crítica y 2 altas. Auditoría limpia.

### Añadido
- Sección de ciberseguridad en el informe, con 5 feeds de seguridad.
- Filtros de relevancia (IA, antibacterial) y sección de seguridad sin fugas.

## [2026-10-06]

### Añadido
- Rediseño de la portada estática: sistema de color, layout responsive y vistas de
  briefing y precios.

### Cambiado
- Migración del frontend a TanStack Router con rutas canónicas.

## [2026-09-24]

### Corregido
- El cron nunca aplicaba los filtros porque el informe ya existía: se corrigió el
  orden de generación y filtros.
- Se reemplazó el feed muerto de "AI Revolution" y se actualizaron los runtimes de
  las acciones.

### Añadido
- Health check de los 33 feeds con item por feed y estado del ranking.
- Ranking de modelos con dataset oficial de Hugging Face (LMArena) × precios OpenRouter.
