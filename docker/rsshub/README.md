# RSSHub local para AI-Informe- (capa social opt-in)

Guarda tu `auth_token` de X en `docker-compose.yml` y levanta:

```bash
cd docker/rsshub
docker compose up -d
curl http://localhost:1200/healthz   # -> "web has been created and is running"
```

Activa la capa social y corre el colector:

```bash
export RSSHUB_BASE_URL=http://localhost:1200      # Git Bash (solo esta sesion)
python ../../scripts/collect_signals.py
```

- Para probar solo un feed X: `curl "http://localhost:1200/twitter/user/OpenAI"`
- Si sale vacio / solo perfil: la cookie expiro. Repite: F12 -> Application -> Cookies -> x.com -> `auth_token` -> pegalo en el compose -> `docker compose restart`.
- Otras redes: añade la cookie de la sesion de esa red a `environment` y ruta en `social_sources.json`. Dcoumentacion oficial de cada ruta: https://docs.rsshub.app/routes/

Honesto: estas redes no tienen API abierta. Esto es "lo mejor que se puede sin pagar", pero caduca cada pocas semanas. El pipeline ya funciona perfecto sin esta capa.
