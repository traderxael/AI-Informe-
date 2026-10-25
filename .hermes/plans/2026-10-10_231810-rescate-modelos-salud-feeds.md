# Plan: Rescate de datos + Robustez del pipeline AI-Informe-

> **For Hermes:** Usar el skill `ai-informe` + `subagent-driven-development` para implementar tarea por tarea.

**Goal:** Restaurar la sección "Ranking de modelos" (hoy publica un JSON vacío en producción) y blindar el pipeline contra los dos fallos que ya midió: degradación silenciosa de feeds y ausencia de un indicador de salud del run.

**Arquitectura:** Sin cambios de arquitectura. Todo ocurre dentro del workflow existente (`.github/workflows/informe-diario.yml`) y los scripts Python del repo. Principio operativo: **un paso que falla debe publicar evidencia, no solo un log** — el informe diario deja de ser la única superficie de observabilidad.

**Tech Stack:** Python 3.10+ (stdlib), GitHub Actions, Vercel (deploy de `main`), Playwright para QA visual.

---

## Contexto (verificado 2026-10-10)

**Estado general: el pipeline corre en verde.** Los últimos 5 runs del cron (12:00 UTC) terminaron `success`, y el informe del 2026-10-10 tiene 716 piezas (484 novedades / 26 usos / 44 economía / 59 futuro / 103 seguridad), con resumen en español generado por Groq. **No hay que "arreglar lo que funciona"** — esto es un plan de rescate + robustez, no una reescritura.

### Problemas confirmados

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| **P1** | `public/data/modelos.json` está **vacío** (`"total": 0`, `"modelos": []`) pese a decir `"actualizado": 2026-10-10T17:02` | JSON en `main` (169 bytes) | La sección "Ranking de modelos" de la web muestra nada; el paso `actualizar_modelos.py` corre pero no produce modelos. Regla 11 de la skill: 200 OK / timestamp fresco **no** implica contenido — hay que mirar los items. |
| **P2** | Degradación silenciosa de feeds: un feed puede devolver 200 con 0 items parseables y el soft-fail del pipeline no registra nada | Nota regla 11 + run 42 (2026-10-05) que falló | La cobertura se degrada mientras el run queda verde. `auditar_feeds.py` existe pero **no corre en el workflow diario**. |
| **P3** | Rama local en `chore/audit-hardening-final`, **18 commits detrás de `origin/main`**, con datos de X sin commitear (25/26/27-sep) y un `_dash_test.html` suelto | `git status -sb` | Regla 27: no mezclar. Regla 1: fetch/status antes de push. Hay que decidir qué se conserva de la rama. |

### Supuestos

1. `actualizar_modelos.py` ya está en el workflow (sí — el JSON lleva timestamp fresco) pero sus fuentes (LMArena `arena.ai/leaderboard/text` + OpenRouter) cambian de formato o bloquean con frecuencia. Hay que diagnosticar antes de programar.
2. El resto del pipeline (34 feeds, Groq, fx_viral) está sano según el último informe.
3. Se respetan las reglas siempre-on del skill: no exigir el check `generar` como required (regla 3), remote SSH (regla 2), `__pycache__` limpio antes de testear (regla 7b), validar con `workflow_dispatch` + artefacto publicado (reglas 25-26).

---

## Propuesta

Dos ejes, ordenados por retorno:

1. **Diagnosticar y reparar `modelos.json`** — la sección visible de la web está muerta hoy. Requiere reproducir el fallo en local con las funciones reales antes de tocar código.
2. **Salud del pipeline publicada, no solo logueada** — un `feed_health.json` con items por feed, commiteado junto al informe, para que la degradación sea visible en la web y en el repo. Es el "alarma" que falta (P2).

El tercer eje (P3, rama local) es **limpieza de git**, no código — se resuelve primero por higiene para no arrastrar conflictos.

---

## Plan paso a paso

### Fase 0 — Higiene de git (sin código, ~10 min)

**Task 0.1: Sincronizar la rama local**

`Files:` repo `C:\Users\USUARIO\AI-Informe-`

```bash
cd ~/AI-Informe- && git fetch origin && git status -sb
git stash push -u -m "wip-antiguo"        # conserva _dash_test.html + datos X viejos
git checkout main && git pull --rebase     # queda en origin/main (18 commits al día)
git stash pop                               # si conflictúa: los datos de X viejos ya los
                                            # regeneró el bot → git stash drop (regla 17)
git stash drop                              # si solo quedan datos generados (regla 17)
git remote -v                               # verificar SSH; si hay token: regla 2
```

**Verify:** `git log --oneline -1` apunta al commit del bot del 2026-10-10; `git remote -v` muestra `git@github.com:...`.

**Decisión abierta (ver "Riesgos"):** si la rama `chore/audit-hardening-final` tiene trabajo de código que preservar, extraer el diff útil ANTES de descartarla.

### Fase 1 — Rescate del ranking de modelos (P1)

**Task 1.1: Reproducir el fallo en local (diagnóstico, sin cambiar código)**

`Files:` `scripts/actualizar_modelos.py` (solo lectura)

```bash
cd ~/AI-Informe-
find scripts -name "__pycache__" -type d -exec rm -rf {} +     # regla 7b
python scripts/actualizar_modelos.py                            # correr de verdad
cat public/data/modelos.json | head -20
```

**Verify esperado:** si falla en local → capturar la excepción real (no adivinar). Si "pasa" pero produce `modelos: []` → el fallo está aguas arriba (fuente): añadir temporalmente `print()` de conteos por fuente y el status HTTP de cada endpoint.

**Task 1.2: Probar las fuentes a mano (evidencia, no suposición)**

```bash
curl -s -w "\nHTTP:%{http_code} CT:%{content_type}\n" https://openrouter.ai/api/v1/models -o /tmp/or.json | tail -1
python -c "import json;d=json.load(open('/tmp/or.json'));print('modelos:',len(d.get('data',[])))"
# LMArena: inspeccionar qué lee el script (selector/HTML/JSON) y repetir el curl equivalente
```

**Verify:** saber qué fuente da 0 items y por qué (auth, cambio de schema, rate-limit). El fix depende de esto — **no escribir parche antes de tener el conteo real de items** (lección regla 11).

**Task 1.3: Test primero, arreglo después (TDD)**

`Files:`
- Modify: `scripts/test_pipeline.py` (agregar tests)
- Modify: `scripts/actualizar_modelos.py` (el fix, tamaño a definir tras 1.1/1.2)

**Step 1 — test que falla:**
```python
class ModelosJsonTests(unittest.TestCase):
    def test_modelos_no_vacio_con_red_real(self):
        # usa las funciones reales del script, no mocks
        data = actualizar_modelos.construir_modelos()
        self.assertGreater(data["total"], 0, "modelos.json quedaria vacio en produccion")
    def test_json_tiene_actualizado_y_fuentes(self):
        data = actualizar_modelos.construir_modelos()
        self.assertIn("actualizado", data)
        self.assertGreater(len(data.get("modelos", [])), 0)
```
Correr: `python -m pytest scripts/test_pipeline.py -k modelos -v` → **FAIL** esperado.

**Step 2 — fix mínimo** (depende de 1.1/1.2; candidatos típicos: cambiar la URL de LMArena, ajustar el parser al schema nuevo, reintentos con backoff como en `fetch_url`, o `continue-on-error` por fuente para que una fuente caída no vacíe el JSON completo).

**Step 3:** `python -m pytest scripts/test_pipeline.py -v` → 44 + 2 = **46 PASS**.

**Task 1.4: Verificar en GitHub, no en local (regla 26)**

```bash
gh workflow run informe-diario.yml --ref main
# poll hasta completed
gh run view <id> --json status,conclusion --jq '.status,.conclusion'
# verificar el ARTEFACTO publicado
gh api repos/traderxael/AI-Informe-/contents/public/data/modelos.json --jq '.content' | base64 -d | python -c "import sys,json;d=json.load(sys.stdin);print('total:',d['total'],'modelos:',len(d['modelos']))"
```

**Verify:** `total > 0` en el JSON de `main`. El log del run no basta.

### Fase 2 — Salud de feeds publicada (P2)

**Task 2.1: Script de salud**

`Files:`
- Create: `scripts/feed_health.py` — corre `auditar_feeds.py`, captura items por feed, escribe `public/data/feed_health.json` con `{generado, feeds: [{nombre, url, items, estado}], total_feeds, feeds_rotos}`. Debe **no fallar el run** si un feed está roto (los rojos se listan en el JSON, con `estado: "roto"` / `"vacio"`).
- Test: `scripts/test_pipeline.py` — `test_feed_health_json_tiene_todos_los_feeds` (34 entradas), `test_feed_health_marca_roto_sin_explotar` (feed con 0 items → `estado: "vacio"`, no excepción).

**Task 2.2: Cablear al workflow + committear**

`Files:`
- Modify: `.github/workflows/informe-diario.yml` — paso nuevo tras generar el informe:
```yaml
- name: Salud de feeds
  run: python scripts/feed_health.py
  continue-on-error: true
- name: Commit feed health
  run: git add public/data/feed_health.json informes public/data && git commit -m "chore: feed health $(date +%F)" || echo "sin cambios"
```
(Ojo: ajustar al patrón de commit existente del bot; no crear un segundo paso de push si ya hay uno que cubre `public/data`.)

**Verify:** tras `workflow_dispatch`, `feed_health.json` existe en `main` con 34 feeds y el estado real de cada uno.

**Task 2.3 (opcional, depende de Fase 2):** mostrar el estado en la web leyendo `feed_health.json` (indicador "34/34 feeds vivos" o "2 feeds degradados"). Solo si el frontend ya tiene un lugar donde meterlo — **no inventar una página nueva** sin saber que encaja (YAGNI). Requiere `npm run typecheck` + `npm test` verdes.

---

## Archivos a tocar (resumen)

| Archivo | Cambio |
|---|---|
| `.github/workflows/informe-diario.yml` | paso "Salud de feeds" + commit del JSON |
| `scripts/actualizar_modelos.py` | fix del JSON vacío (P1) |
| `scripts/feed_health.py` | **nuevo** — salud de feeds |
| `scripts/test_pipeline.py` | +2 tests modelos, +2 tests health |
| `public/data/modelos.json` | regenerado, con contenido |
| `public/data/feed_health.json` | **nuevo**, commiteado por el bot |
| `references/pipeline-auditoria.md` (skill) | actualizar al cerrar: hallazgo "modelos.json vacío" + nota de salud de feeds |

**No tocar:** `generar_informe.py`, `collect_signals.py`, `sources.py` (están sanos y verificados en el último informe), `.vercel/output/`, ni `web/` (versión legada).

---

## Tests / validación (checklist final)

- [ ] `python -m pytest scripts/test_pipeline.py -v` → ≥48 PASS, 0 FAIL
- [ ] `npm run typecheck` → 0 errores (solo si tocaste frontend)
- [ ] `npm test` → sin comillas en el glob (regla 15), número esperado de tests
- [ ] `gh workflow run informe-diario.yml --ref main` → `completed/success`
- [ ] Artefacto publicado verificado: `modelos.json` con `total > 0` **y** `feed_health.json` con 34 feeds
- [ ] `git remote -v` sin token (regla 2)
- [ ] Playwright `channel: 'msedge'` headless sobre la web → la sección de modelos deja de estar vacía (camofox NO sirve)

---

## Riesgos, tradeoffs y preguntas abiertas

| Riesgo | Mitigación |
|---|---|
| El fix de `modelos.json` depende de datos que aún no tenemos (1.1/1.2 pueden revelar que LMArena cambió de formato y hay que reescribir el parser) | Fase 1 es diagnóstico-first: no escribir el parche hasta tener la evidencia del fallo |
| La rama local `chore/audit-hardening-final` puede contener trabajo útil | Decidir ANTES de descartarla (Fase 0) — si hay diff útil, extraerlo a un commit en `main` |
| `feed_health.json` commiteado diario = ruido en el historial de git | Es un artefacto de datos como `informes/`, consistente con el patrón del bot; monitorear si molesta |
| El workflow no tiene trigger de push (regla 25) → no se puede validar "el CI quedó verde" sin dispatch manual | El checklist ya lo incluye: dispatch + poll + artefacto |
| Cambios de esquema en OpenRouter/LMArena romperán esto otra vez | `feed_health.json` y los tests hacen visible la próxima degradación en vez de silenciarla |

**Preguntas para Axael (decidir antes de ejecutar):**
1. ¿Qué hacemos con la rama local: **la descarto** (recomendado — está 18 commits atrás y los datos ya los regeneró el bot) o extraigo algo antes?
2. ¿La sección de modelos en la web debe **quedar visible** (aunque sea parcial) o **ocultarse** si la fuente sigue caída tras el fix?

---

## Handoff

Plan completo y guardado. Para ejecutar: skill `subagent-driven-development` — un subagente fresco por tarea, con revisión de spec-compliance y luego de calidad. ¿Partimos?
