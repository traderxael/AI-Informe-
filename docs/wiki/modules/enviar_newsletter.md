# Module: `scripts/enviar_newsletter.py`

Email tipo "resumen del día" vía Resend. 114 líneas.

## Responsibilities
- `build_html(day)` — genera el HTML del email con `xml.sax.saxutils.escape`.
- `main()` — POST a la API de Resend con el payload.

## Public API
- `latest_day() -> dict | None`
- `build_html(day) -> str`

## Internal Structure
- Env: `RESEND_API_KEY`, `NEWSLETTER_FROM`, `NEWSLETTER_TO`.
- Opcional: sin secrets se omite; `continue-on-error: true`.

## Dependencies
- **Usa:** JSON del día más reciente.
- **Usado por:** workflow, al final de `publicar`.

## Notable Patterns / Gotchas
- HTML escapado porque los títulos de noticias traen caracteres arbitrarios.
