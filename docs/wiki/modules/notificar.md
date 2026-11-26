# Module: `scripts/notificar.py`

Notificación del resumen diario a Telegram y Discord. 97 líneas, stdlib `urllib`.

## Responsibilities
- `latest_day()` — lee el JSON del día más reciente.
- `build_message(day)` — arma el texto con cifras del resumen.
- `post_json(url, payload)` — POST genérico con timeout.
- `main()` — envía a ambos destinos si hay secrets.

## Key Files
- `scripts/notificar.py` — todo el módulo.

## Public API
- `latest_day() -> dict | None`
- `build_message(day) -> str`
- `post_json(url, payload) -> bool`

## Internal Structure
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`.
- Sin secrets configurados el paso se omite sin romper nada (`continue-on-error: true`).

## Dependencies
- **Usa:** JSON versionado del día.
- **Usado por:** workflow, al final de `publicar`.

## Notable Patterns / Gotchas
- Corre **después** del commit y del gate de artefactos: si falla, el informe ya está publicado.
