# RSSHub local para AI-Informe- (capa social opt-in)

El pipeline diario **no depende** de esto: si RSSHub no está levantado, el
informe se publica igual. Esta capa es para redes sin API pública (X,
Instagram, TikTok, Xiaohongshu/RedNote).

## Levantar

```bash
cd docker/rsshub
docker compose up -d
curl http://localhost:1200/healthz   # -> "ok"
```

`docker-compose.yml` es la plantilla que sí se commitea. Tus cookies van en
`docker-compose.override.yml` (está en `.gitignore`): Docker auto-carga ese
archivo encima del base.

## Cookies

Ninguna de estas redes tiene API abierta: todas bloquean a los bots sin
sesión iniciada.

| Red | Variable | Cómo se obtiene |
|---|---|---|
| X | `TWITTER_AUTH_TOKEN` | F12 → Application → Cookies → x.com → `auth_token` |
| Xiaohongshu / RedNote | `XIAOHONGSHU_COOKIE` | F12 → Application → Cookies → xiaohongshu.com → `web_session` (y `a1`) |

La cookie de XHS caduca cada pocas semanas: cuando la ruta responda
`小红书未返回用户数据`, vuelve a copiarla.

## Endpoint del navegador

RSSHub moderno usa **Playwright**, no el `PUPPETEER_WS_ENDPOINT` legacy (que
queda como fallback). El override local debe traer:

```yaml
services:
  rsshub:
    environment:
      PLAYWRIGHT_CDP_ENDPOINT: "ws://browserless:3000"
      # XIAOHONGSHU_COOKIE: "a1=...; web_session=..."
```

Sin `PLAYWRIGHT_CDP_ENDPOINT` el error es
`browserType.connect: Cannot find object to "undefined"` y toda ruta que
necesita navegador responde 503.

## Rutas que funcionan (verificadas)

- X: `/twitter/user/<handle>` — ejemplo: `curl "http://localhost:1200/twitter/user/OpenAI"`
- Xiaohongshu: `/xiaohongshu/user/<user_id>/notes` — la categoría es
  obligatoria; `/user/<id>` a secas responde 404.
- Xiaohongshu tablero: `/xiaohongshu/board/<board_id>`

## Activar la capa social en el pipeline

```bash
export RSSHUB_BASE_URL=http://localhost:1200      # Git Bash (solo esta sesion)
python ../../scripts/collect_signals.py
```

Las rutas a seguir se configuran en `social_sources.json`
(plantilla: `social_sources.example.json`).

Honesto: estas redes no tienen API abierta. Esto es "lo mejor que se puede sin
pagar", pero caduca cada pocas semanas. El pipeline ya funciona perfecto sin
esta capa.
