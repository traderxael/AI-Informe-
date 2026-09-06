# AI Informe

📰 Recopilación automática diaria de **noticias de IA**, usos en el mundo real, economía y señales de futuro.

**Repositorio:** [traderxael/AI-Informe-](https://github.com/traderxael/AI-Informe-)  
**Sitio web:** [https://ai-informe-dashboard.vercel.app](https://ai-informe-dashboard.vercel.app)  
**Dashboard alternativo:** [https://ai-informe-dashboard-traderxael.vercel.app](https://ai-informe-dashboard-traderxael.vercel.app)

---

## ✨ Características

- **📡 Recopilación automática** de 15+ fuentes (RSS + scraping avanzado con Camoufox anti-detección)
- **🧠 Resúmenes con LLM** — cada noticia tiene un resumen generado por IA (opcional)
- **🏷️ Categorización inteligente** por tema y relevancia
- **📊 Dashboard web** con búsqueda, filtros y estadísticas
- **🔄 GitHub Actions** que corre cada día automáticamente
- **📱 Responsive** — funciona en móvil y escritorio

---

## 📁 Estructura

```
AI-Informe-/
├── scripts/
│   ├── generar_informe.py         # Script principal (RSS → markdown)
│   └── collect_signals.py         # Señales reales multi-país para la web
├── web/                           # Generado por el pipeline (markdown → html/json)
├── informes/                      # Informes diarios en markdown
│   ├── _plantilla.md              # Plantilla base
│   └── YYYY-MM-DD.md              # Informes diarios
├── .github/workflows/
│   └── informe-diario.yml         # Workflow automático
└── requirements.txt
```

---

## 🚀 Uso

### Requisitos

- Python 3.10+
- Scrapy/Camoufox para scraping (opcional)
- Una API key de LLM para resúmenes (opcional)

### Generar un informe

```bash
# Solo RSS (rápido)
python scripts/generar_informe.py

# Recolector de señales reales multi-país + traducción gratis
python scripts/collect_signals.py
```

### Actualizar datos de la web

El sitio lee `public/signals.json` (señales reales con fuente enlazable):

```bash
python scripts/collect_signals.py   # regenera public/signals.json
```

### Ver la web

```bash
npm install && npm run dev
# → http://localhost:8080
```

---

## 🤖 Configurar LLM (opcional)

Edita `scripts/.env`:

```env
MOONSHOT_API_KEY=sk-...
# o: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY
```

---

## 🌐 Despliegue en Vercel

El proyecto se despliega automáticamente desde GitHub (rama `main`).

**Sitio:** https://ai-informe-dashboard.vercel.app

> ⚠️ URLs eliminadas que ya no existen: `ai-informe.vercel.app` y `ai-informe-dashboard-traderxael.vercel.app` (404).
>
> ⚠️ `vercel.json` debe ser `"version": 2` — con `version: 3` Vercel rechaza el build por completo y la web queda congelada sin error visible.

**Nota:** Si haces cambios en el workflow, asegúrate de que el repo tenga permisos de escritura en GitHub Actions.

---

## 📊 Fuentes de datos

| Fuente | Tipo | Frecuencia |
|--------|------|------------|
| Google News (global + 8 países) | RSS | Diario |
| OpenAI / Google / DeepMind / Meta AI | Blog RSS | Diario |
| TechCrunch / The Verge / Ars / VentureBeat / MIT TR | RSS | Diario |
| Synced / 36Kr / QbitAI / DeepSeek | RSS | Diario |
| Hacker News | RSS | Diario |
| Reddit (r/artificial, r/MachineLearning…) | RSS | Diario (best-effort) |
| X / Instagram / TikTok / Xiaohongshu | RSSHub (opt-in) | Diario si está configurado |

### Capa social opt-in (X / Instagram / TikTok / Xiaohongshu)

Estas redes no tienen API pública abierta. Para activarlas:

1. Levanta tu propia instancia de [RSSHub](https://docs.rsshub.app/) con tus cookies/sesión.
2. Define `RSSHUB_BASE_URL` en el environment del runner (o `.env` local).
3. Copia `social_sources.example.json` → `social_sources.json` y rellena las cuentas.

Si no está configurado, el pipeline sigue funcionando igual sin ellas.

---

## Licencia

MIT
