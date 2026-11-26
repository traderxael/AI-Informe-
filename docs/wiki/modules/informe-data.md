# Module: `src/lib/informe-data.ts`

Núcleo de tipos y datos del frontend. Define `MODELS`, `SIGNALS`, búsqueda con resaltado, y las utilidades de región/precio.

## Responsibilities

- Tipos: `ModelId`, `Region`, `SourceKind`, `ModelInfo`, `Signal`, `InformeSearch`.
- `MODELS` (48) catálogo con Elo, precio, licencia y región (`west` / `china`).
- `WEST_MODELS`, `CHINA_MODELS`, `ALL_MODELS`, `MODEL_BY_ID`.
- `SIGNALS` (164) señales embebidas; `SOURCE_LABEL`.
- Búsqueda: `foldText`, `foldWithMap`, `queryTokens`, `matchesQuery`, `matchRanges`, `parseInformeSearch`.

## Key Files

- `src/lib/informe-data.ts` — tipos y datos.
- `src/lib/noticias-data.ts` — `CATEGORIAS`, `categorizeSignal()`, `detectLang()`, `enrichSignals()`, `sortNoticias()`, `groupByCategory()`.
- `src/lib/live-feed.ts` — `LiveRaw → Signal`, `weekLabelFrom()`, `invalidateLiveSignals()`, `modelLabel()`.
- `src/lib/i18n.tsx` — `LanguageProvider`, `useLang()` (ES/EN/ZH).
- `src/lib/db.ts` — `dbSource` (`neon` si hay databaseUrl, si no `pglite`), `getSql()`, `ensureDbReady()`.

## Public API

- `blendedPerM(m, inShare=0.75) -> number`
- `filterSignals(signals, search, region, sourceKind) -> Signal[]`
- `modelsForRegion(region) -> ModelInfo[]`
- `formatUsd(n) -> string`
- `isModelId(v) -> v is ModelId`

## Internal Structure

- Los modelos chinos (DeepSeek, Qwen, Kimi, GLM) tienen `region: "china"`.
- `foldWithMap()` preserva el índice original para resaltar coincidencias sin perder acentos.
- `live-feed.ts` permite que la web muestre señales nuevas sin regenerar el build.

## Dependencies

- **Usa:** JSON versionados de `public/data/` generados por el pipeline Python.
- **Usado por:** `src/routes/*.tsx` (`index`, `noticias`, `tendencias`, `estadisticas`, `analitica`), `src/components/*`.

## Notable Patterns / Gotchas

- `MODELS` y `SIGNALS` están **embebidos en TS**; si el pipeline cambia el JSON, hay que regenerar o la web sigue con datos viejos salvo la capa live.
- `WEEK_LABEL = "1 – 7 de septiembre 2026"` es un literal; `weekLabelFrom()` lo reemplaza en vivo.
- Tests: `src/lib/informe-data.test.ts`, `noticias-data.test.ts`.
