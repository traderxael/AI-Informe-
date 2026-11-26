# Module: `scripts/resumir_con_llm.py`

Variante anterior de resúmenes con LLM: soporta Moonshot y OpenAI además del fallback simple. 141 líneas.

## Responsibilities
- `cargar_api_key()` — choose de proveedor según env.
- `resumir_con_moonshot()` / `resumir_con_openai()` — llamadas HTTP a cada API.
- `resumen_simple()` — fallback sin LLM.
- `agregar_resumenes_a_noticias()` — enriquece la lista de noticias.

## Public API
- `cargar_api_key() -> dict`
- `resumir_con_moonshot(texto, api_key) -> str`
- `resumir_con_openai(texto, api_key) -> str`
- `resumen_simple(texto) -> str`
- `generar_resumen_noticia(titulo, fuente, contenido="") -> str`
- `agregar_resumenes_a_noticias(noticias) -> list[dict]`

## Notable Patterns / Gotchas
- El workflow usa `resumir_groq.py` (más nuevo); este queda como alternativa multi-proveedor.
- `resumen_simple()` garantiza que nunca falte un resumen aunque no haya API key.
