# AI Informe

📰 Recopilación automática diaria de **noticias de IA**, usos en el mundo real, economía y señales de futuro.

**Repositorio:** [traderxael/AI-Informe-](https://github.com/traderxael/AI-Informe-)  
**Sitio web:** [https://ai-informe.vercel.app](https://ai-informe.vercel.app)

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
│   ├── generar_informe.py         # Script principal (RSS + scraping)
│   ├── scraper_camoufox.py        # Scraper con Camoufox (anti-detección)
│   └── resumir_con_llm.py         # Resúmenes con LLM (opcional)
├── web/
│   ├── index.html                 # Dashboard principal
│   ├── informe.html               # Vista de un informe
│   ├── styles.css                 # Estilos mejorados
│   └── informes.json              # Datos para la web
├── informes/
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

# Con scraping avanzado (Camoufox)
python scripts/generar_informe.py --scrape

# Con resúmenes LLM
python scripts/generar_informe.py --resumen --llm moonshot

# Forzar sobrescribir
python scripts/generar_informe.py --force
```

### Ver la web

```bash
cd web && python -m http.server 8080
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

El proyecto se despliega automáticamente desde GitHub. 

**Nota:** Si haces cambios en el workflow, asegúrate de que el repo tenga permisos de escritura en GitHub Actions.

---

## 📊 Fuentes de datos

| Fuente | Tipo | Frecuencia |
|--------|------|------------|
| OpenAI | Blog | Diario |
| Google AI | Blog | Diario |
| DeepMind | Blog | Diario |
| TechCrunch AI | RSS | Diario |
| The Verge AI | RSS | Diario |
| Hacker News | Scraping | Diario |
| ... | ... | ... |

---

## Licencia

MIT
