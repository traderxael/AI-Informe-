# Sequence Diagrams

## Workflow: Publicación diaria (informe-diario.yml)

El flujo que corre a las 12:00 UTC. `test_pipeline.py` es el único gate bloqueante antes de publicar; los demás pasos son soft-fail.

```mermaid
sequenceDiagram
    participant CRON as GitHub Cron
    participant PUB as job publicar
    participant TEST as test_pipeline.py
    participant FX as fx_viral.py
    participant GEN as generar_informe.py
    participant FEED as generar_feed.py
    participant SIG as collect_signals.py
    participant MOD as actualizar_modelos.py
    participant GH as GitHub repo
    participant VER as Verificar artefactos

    CRON->>PUB: dispatch 12:00 UTC
    PUB->>TEST: python test_pipeline.py
    TEST-->>PUB: OK (o aborta el día)
    PUB->>FX: python fx_viral.py (soft-fail)
    FX-->>PUB: datos/fx_viral_*.json
    PUB->>GEN: python generar_informe.py
    GEN->>GEN: collect_items() → classify → filtrar
    GEN->>GEN: x_items() lee JSON de X
    GEN-->>PUB: informes/*.md + web/*.json + web/index.html
    PUB->>FEED: python generar_feed.py
    FEED-->>PUB: public/feed.xml + feed.atom
    PUB->>PUB: reparar_agujeros.py (soft-fail)
    PUB->>SIG: collect_signals.py (TRANSLATE_MAX=40)
    SIG-->>PUB: signals-first/rest.json
    PUB->>PUB: resumir_groq.py (soft-fail)
    PUB->>MOD: actualizar_modelos.py (soft-fail)
    MOD-->>PUB: modelos.json + modelos-history.json
    PUB->>PUB: feed_health.py (soft-fail)
    PUB->>GH: git add informes web public datos → commit → push
    PUB->>VER: validar modelos/health/feed.xml
    VER-->>PUB: rojo si falta evidencia (pero ya publicado)
    PUB->>PUB: notificar.py + newsletter (soft-fail)
```

### Walkthrough

1. **Trigger** — `.github/workflows/informe-diario.yml`, `on.schedule.cron: "0 12 * * *"`.
2. **Gate bloqueante** — `python scripts/test_pipeline.py`.
3. **X antes que el informe** — comentario explícito en el workflow.
4. **Commit** — `git add informes web public datos`; si no hay diff, "Sin cambios".
5. **Gate final** — Python inline valida tres artefactos **después** del push.

## Workflow: Generación del informe (`generar_informe.write_informe`)

```mermaid
sequenceDiagram
    participant CLI as main()
    participant WI as write_informe(day, force)
    participant CI as collect_items()
    participant SRC as sources.FEEDS
    participant X as datos/fx_viral_*.json
    participant RM as render_markdown()
    participant EW as export_web_json()
    participant RW as regenerate_web()

    CLI->>WI: --fecha / hoy UTC
    WI->>CI: collect_items(day, lookback=168h)
    CI->>SRC: _fetch_one() en paralelo
    SRC-->>CI: bytes RSS
    CI->>CI: parse_feed → classify → filtrar → relevancia
    WI->>X: leer_x_json(day)
    X-->>WI: x_items(limite=12)
    WI->>RM: render_markdown(day, items + x)
    RM-->>WI: informes/YYYY-MM-DD.md
    WI->>EW: export_web_json(day, items)
    EW-->>WI: public/data/*.json
    WI->>RW: regenerate_web()
    RW-->>WI: web/index.html + i18n
```

### Walkthrough

1. `main()` — [`scripts/generar_informe.py:1350`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/generar_informe.py#L1350).
2. `write_informe()` — [`:1322`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/generar_informe.py#L1322) — siempre regenera (`force=True` implícito).
3. `collect_items()` — [`:713`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/generar_informe.py#L713).
4. `x_items()` — [`:817`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/generar_informe.py#L817).
5. `render_markdown()` — [`:885`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/generar_informe.py#L885).

## Workflow: Ranking de modelos (LMArena × OpenRouter)

```mermaid
sequenceDiagram
    participant M as actualizar_modelos.py
    participant HF as Hugging Face (LMArena)
    participant OR as OpenRouter API
    participant FS as public/data/

    M->>HF: fetch_lmarena(board="text", limit=60)
    HF-->>M: Elo por modelo
    M->>OR: fetch_openrouter()
    OR-->>M: catálogo + precios
    M->>M: match(arena, ordr) → normalize_org + infer_licencia
    M->>M: construir_payload(total, con_precio, modelos)
    M->>FS: escribir_payload(modelos.json + web/modelos.json)
    M->>FS: _registrar_historial(modelos-history.json, keep=90)
    Note over M,FS: Si LMArena falla → NO sobrescribe,<br/>run rojo con evidencia
```

### Walkthrough

1. `fetch_lmarena()` — [`:121`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/actualizar_modelos.py#L121).
2. `fetch_openrouter()` — [`:140`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/actualizar_modelos.py#L140).
3. `match()` — [`:188`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/scripts/actualizar_modelos.py#L188).
4. El frontend consume `MODELS` en [`src/lib/informe-data.ts:48`](https://github.com/traderxael/AI-Informe-/blob/c51dcc5/src/lib/informe-data.ts#L48).
