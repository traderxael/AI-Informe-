# Module: `scripts/servidor_csp.py`

Servidor HTTP local con headers de seguridad (CSP) para probar la web antes de publicar. 89 líneas.

## Responsibilities
- Clase `Handler(BaseHTTPRequestHandler)` — sirve archivos estáticos inyectando `Content-Security-Policy`.
- `ThreadingHTTPServer` — arranque local.

## Public API
- `class Handler(BaseHTTPRequestHandler)`

## Dependencies
- **Usa:** `http.server`, `pathlib`, `json`, `re`.

## Notable Patterns / Gotchas
- Herramienta **local de QA**, no parte del deploy en Vercel.
- Útil para validar que los componentes CSP-safe (share button, i18n) no rompan la política.
