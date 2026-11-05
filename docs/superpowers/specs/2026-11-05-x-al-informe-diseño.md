# Diseño: X al informe diario + caché local de imágenes (2026-11-05)

## Objetivo

Que las publicaciones de X **actualicen la información del sitio**, no solo la
portada: hoy la sección "Lo que la IA está haciendo" muestra 12 tarjetas, pero el
informe diario (`informes/*.md`), el JSON de la web y el feed RSS/Atom **no
contienen ni un solo item de X**. Quien lee el informe o suscribe el feed no ve
nada de X.

## Alcance (acordado con el usuario)

- **X ahora**: más fuentes, caché local de imágenes, y las señales de X dentro
  del informe diario y el feed.
- **RedNote después**: cuando haya cookie de sesión de Xiaohongshu, entra como
  pestaña `X | RedNote` en la misma sección. No se implementa ahora porque
  Xiaohongshu exige login (verificado por HTTP, navegador real y RSSHub:
  todo redirige a `rednote.com/login`).

## Hallazgos técnicos que condicionan el diseño

### 1. La API de FxTwitter mezcla retweets de terceros

`/2/profile/<handle>/statuses` devuelve también lo que la cuenta **retuiteó**.
Medido hoy:

| cuenta | items | propios | retweets de terceros |
|---|---|---|---|
| `zai_org` | 19 | 3 | 16 |
| `Kimi_Moonshot` | 17 | 13 | 4 |

El script actual etiqueta todo eso con el nicho de la cuenta monitoreada
(`china-ai`), así que un post cualquiera de `guhe120` se publica como señal
china-ai. **Atribución falsa.**

**Decisión**: el pipeline por defecto se queda solo con posts **propios**
(`author.screen_name == handle`, sin distinguir mayúsculas). Los retweets se
pueden pedir explícitamente con `--incluir-retweets`, que los marca con
`repost_de` para que la UI pueda distinguirlos.

### 2. El orden del workflow no permite que X llegue al informe

Hoy el workflow corre `generar_informe.py` → `generar_feed.py` → … → `fx_viral.py`.
El informe se genera **antes** de que exista el JSON de X, así que aunque el
informe lo leyera, leería el del día anterior.

**Decisión**: `fx_viral.py` se mueve **antes** de `generar_informe.py`. No
depende de nada del informe, así que el cambio es seguro, y el informe del día
ya puede leer `datos/fx_viral_<fecha>.json`.

### 3. El feed solo publica la sección "novedades"

`export_web_json` escribe en `public/data/informes.json` únicamente
`por_seccion["novedades"]`. Si X va a una sección propia, no llega al feed.

**Decisión**: sección propia `x` en el markdown (para que el informe sea legible)
y los items de X se **agregan también** a la lista simple que alimenta el feed,
el buscador y el newsletter. Así el RSS/Atom los incluye con `seccion: "x"`.

## Secciones tocadas

| archivo | cambio |
|---|---|
| `scripts/fx_viral.py` | filtro de autoría, flag `--incluir-retweets`, descarga y cache local de imágenes |
| `scripts/generar_informe.py` | `x_items()`: convierte el JSON de X en items de informe; sección `x` en el markdown y en el JSON simple |
| `.github/workflows/informe-diario.yml` | `fx_viral.py` antes de `generar_informe.py` |
| `scripts/test_pipeline.py` | tests de las funciones nuevas |
| `docker/rsshub/*` | ruta correcta de Xiaohongshu y `PLAYWRIGHT_CDP_ENDPOINT` (para cuando haya cookie) |
| `social_sources.example.json` | rutas con la categoría que RSSHub exige (`/user/<id>/notes`) |

## Caché local de imágenes

Motivo: si X cambia su CDN o bloquea el hotlink, la sección queda sin fotos
—hoy el fallback evita el error pero se pierde el contenido visual—. Con la
caché, las imágenes se sirven desde el propio repo (`public/data/x-img/`).

Costes asumidos:

- ~38 KB por imagen × 12 = **~450 KB/día** en el repositorio.
- Se conserva solo **5 días** de imágenes (el árbol de trabajo no crece; el
  historial de git sí, ~8 MB/mes).
- Solo se cachean imágenes de hasta 80 KB; las mayores siguen por hotlink.

Restricción: el workflow diario es **Python stdlib only** (por diseño: un
lockfile roto tumbó un día entero). Por eso no se redimensiona con Pillow: la
caché guarda los bytes tal cual llegan del CDN de X.

## Qué NO se hace

- No se implementa RedNote (sin cookie no hay datos).
- No se scrapea XHS directamente: `robots.txt` de xiaohongshu.com prohíbe todo
  para `User-agent: *`.
- No se rotan ni tocan secretos.

## Decisiones tomadas al implementar (05-nov-2026)

Encontrados midiendo la API, no asumidos:

- **El 404 de FxTwitter es transitorio**: en ráfaga, 12 de 25 requests lo
  recibieron (rate limit de X por IP). `api_get` reintenta hasta 3 veces: las
  10 cuentas probadas respondieron. Sin esto se perdía la mitad de las
  cuentas en cada corrida.
- **Ventana de recencia de 7 días**: una cuenta que publica poco deja posts
  de hace semanas en su "últimos 20" y, con muchas views, entraban al
  informe del día. El filtro va en `fx_viral.py` (origen de los datos).
- **El feed pasó de 25 a 40 items**: el día llena el cupo con 25 novedades,
  así que con 25 items los posts de X nunca entraban al RSS.
- **Los items de X van después de las novedades** en la lista simple: el
  resumen de Telegram (`items[:5]`) y el newsletter (`items[:10]`) toman la
  cabeza y lo titulan "Novedades".
- **El país de un item de X sale de su etiqueta de nicho** (`china-ai` →
  china, resto → global), no de `classify_country`: ese busca "openai" o
  "google" en el texto y mandaría a "usa" casi todo.
- **Entran al informe los posts sin imagen** (casi la mitad de los virales):
  el informe es texto y filtrarlos perdería la señal. La portada mantiene su
  propio filtro de imágenes.
- **La sección del sitio es de IA, no de mercado**: con las cuentas nuevas,
  `@WatcherGuru` (cripto) se llevaba 12 de las 24 tarjetas de la portada y 8
  de las 12 del informe. La sección excluye el nicho `trading` y ninguna
  cuenta puede tener más de 3 posts (`scripts/sources.py` es la fuente
  única de las dos reglas). Las cuentas de trading se siguen monitoreando:
  quedan en `datos/fx_viral_*.json`, que es la cola de clips de AutoClip.
- **La portada no depende del CDN de X**: las imágenes (tope de 120 KB: los
  posters de video pesan ~104 KB) y los avatares se descargan al repo. Sin
  cache, los avatares quedaban sin pixels cuando pbs.twimg.com no
  respondía.

## Verificación

1. Tests de Python (unitarios, sin red).
2. `scripts/servidor_csp.py` + Playwright: la sección carga, 12/12 imágenes
   desde la caché local, 0 errores de consola.
3. Push → Vercel → comprobación en producción de `/data/x-viral.json`,
   `/data/informes.json`, `/feed.xml` y `/feed.atom`.
