# Changelog

Todas las novedades relevantes de **AI Informe**. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/).

El sitio en producción es siempre el último commit de `main`. Los informes diarios
se publican automáticamente y no se listan aquí uno por uno.

## [No publicado]

### Corregido
- **XSS en el HTML del informe**: el texto de las señales de X es no confiable y un
  post con `[mira](javascript:alert(1))` se convertía en un `<a href="javascript:...">`
  en el HTML generado (`web/dias/<fecha>.html`). Ahora los enlaces markdown solo
  aceptan `http`, `https`, `mailto` y rutas del propio sitio; el resto se deja como
  texto.
- **La caché de imágenes crecía para siempre**: en el cron, `git checkout` deja
  todos los archivos con la fecha del checkout, así que la limpieza por antigüedad
  (5 días) nunca borraba nada y la carpeta `public/data/x-img/` crecía ~1,5 MB por
  día para siempre. Ahora se borra además lo que el payload del día no referencia.
- **El informe recibía pocos candidatos de IA**: el top-40 por views lo dominaban
  las cuentas de trading (18 de 40), así que al informe solo llegaban 22 candidatos
  para 12 huecos y los posts antiguos entraban por alcance. Ahora el JSON guarda
  además `viral_ia` (el top-40 sin trading), que es el pool que usa el sitio.
- **La caché guardaba respuestas que no eran imágenes**: `pbs.twimg.com` a veces
  responde 200 con un HTML de error, que se guardaba como `.jpg` y dejaba una
  tarjeta con la foto rota. Ahora se comprueban los bytes de la imagen.
- **La descarga de imágenes no reintentaba**: un corte de conexión Bratava la
  imagen para todo el día. Ahora reintenta 3 veces.
- **La fecha de los posts de X en el feed era la del informe**: un post de hace 3
  días salía en el RSS con la fecha de hoy. Ahora lleva su fecha real.
- **Atribución de X**: la API de FxTwitter devuelve, junto a los posts propios, los
  **retweets** de la cuenta (con el autor original). El monitor los etiquetaba con el
  nicho de la cuenta monitoreada, así que un post cualquiera se publicaba como señal de
  China-IA o de IA. Ahora solo entran los posts propios (`author.screen_name` = la
  cuenta); los retweets se pueden pedir con `--incluir-retweets` y salen marcados.
- **Rate limit de FxTwitter**: el 404 que devuelve la API es transitorio (medido: 12 de
  25 requests seguidas lo recibieron). El monitor reintenta hasta 3 veces, así que ya
  no se pierde la mitad de las cuentas en cada corrida.
- **Posts viejos como señal de hoy**: una cuenta que publica poco deja posts de hace
  semanas en su "últimos 20" y, con muchas views, entraban al informe del día. Ahora
  la ventana de recencia es de 7 días.
- **La sección de X era una sola cuenta**: con las cuentas nuevas, `@WatcherGuru`
  (cripto) se llevaba 12 de las 24 tarjetas de la portada y 8 de las 12 del informe, en
  una sección titulada "Lo que la IA está haciendo". Ahora la sección del sitio excluye
  el nicho de trading y ninguna cuenta puede tener más de 3 posts. Las cuentas de
  trading se siguen monitoreando: quedan en `datos/fx_viral_*.json`, que es la cola de
  clips de AutoClip.
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
- **X dentro del informe diario y del feed**: las señales de X ya no se quedan en la
  portada. Cada informe markdown tiene su sección **"Lo que la IA está haciendo en X"**
  y esas señales también entran en la lista simple que alimenta el **feed RSS/Atom**,
  el buscador y el newsletter. El workflow ahora recolecta X **antes** de generar el
  informe, que es lo que hace posible que el informe lea las señales del día.
- **Caché local de las imágenes de X** (`public/data/x-img/`): las imágenes y los
  avatares se descargan al repo (hasta 120 KB) en vez de depender del hotlink al CDN
  de X. Se conservan 5 días.
- **35 cuentas monitoreadas** en vez de 17 (laboratorios, empresas de IA, hardware,
  IA china y gente que explica IA en la práctica), todas verificadas contra la API.
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
