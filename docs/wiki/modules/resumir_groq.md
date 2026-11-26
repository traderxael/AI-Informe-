# Module: `scripts/resumir_groq.py`

Resumen del día + traducción de señales vía Groq. 243 líneas. Opcional: sin `GROQ_API_KEY` se omite.

## Responsibilities

- `cargar_api_key()` — lee `GROQ_API_KEY` del entorno.
- `groq_chat()` / `groq_chat_robusto()` — llamada con reintentos.
- `resumen_dia()` — genera el resumen ejecutivo.
- `traducir_signals()` — traduce hasta `--max` señales (24 en el workflow).

## Key Files

- `scripts/resumir_groq.py` — todo el módulo.
- `scripts/resumir_con_llm.py` — variante anterior (141 líneas).

## Public API

- `cargar_api_key() -> str`
- `groq_chat(prompt, api_key, max_tokens, modelo) -> str`
- `groq_chat_robusto(prompt, api_key, max_tokens) -> tuple[str, str]`
- `es_espanol(texto) -> bool`
- `resumen_dia(api_key, force) -> bool`
- `traducir_signals(api_key, max_items, force) -> bool`
- `main() -> int`

## Internal Structure

- `es_espanol()` evita retraducir texto ya en español.
- `force` permite regenerar aunque el artefacto ya exista.
- Env del workflow: `TRANSLATE_MAX=40` para `collect_signals.py`, `--max 24` para Groq.

## Dependencies

- **Usa:** salida de `collect_signals.py`.
- **Usado por:** el informe enriquecido y la web.

## Notable Patterns / Gotchas

- `continue-on-error: true` en el workflow: fallar no tumba el día.
- El resumen del día se guarda en un artefacto; `force=False` evita sobrescribir.
