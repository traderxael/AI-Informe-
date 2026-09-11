# 🤖 AI Informe

> **Recopilación automática diaria** de noticias de IA, usos reales, economía y señales de futuro.  
> Generado por GitHub Actions + Python + LLM, publicado en Vercel.

[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/traderxael/AI-Informe-/informe-diario.yml?branch=main&style=flat-square&logo=github-actions&logoColor=white)](https://github.com/traderxael/AI-Informe-/actions)
[![Último commit](https://img.shields.io/github/last-commit/traderxael/AI-Informe-/main?style=flat-square&logo=git&logoColor=white)](https://github.com/traderxael/AI-Informe-/commits/main)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square&logo=open-source-initiative&logoColor=white)](LICENSE)
[![Vercel](https://img.shields.io/badge/deploy-vercel-black?style=flat-square&logo=vercel&logoColor=white)](https://ai-informe-dashboard.vercel.app)

---

## 🌐 Ver el dashboard

| Entorno | URL |
|--------|-----|
| 🚀 **Producción** | [ai-informe-dashboard.vercel.app](https://ai-informe-dashboard.vercel.app) |
| 📦 Repositorio | [github.com/traderxael/AI-Informe-](https://github.com/traderxael/AI-Informe-) |

---

## ✨ Características

| Feature | Detalle |
|---------|--------|
| 📡 **Recopilación automática** | 15+ fuentes (OpenAI, Anthropic, Hugging Face, arXiv, MIT News, Google AI, Meta AI, etc.) |
| 🧠 **Resúmenes con LLM** | Cada noticia tiene resumen generado por IA (opcional, configurable) |
| 🏷️ **Categorización inteligente** | Clasificación por tema y relevancia |
| 📊 **Dashboard web** | Búsqueda, filtros, estadísticas, diseño Liquid Glass |
| 🔄 **GitHub Actions** | Workflow programado a las 12:00 UTC (09:00 Chile) |
| 📱 **Responsive** | Funciona en móvil y escritorio |
| 🆓 **100% gratis** | Sin costos de hosting, sin API keys obligatorias |

---

## 📁 Estructura del proyecto

```
AI-Informe-/
├── 📜 scripts/
│   ├── generar_informe.py      # Script principal (RSS → markdown)
│   └── collect_signals.py     # Señales reales multi-país para la web
├── 🌐 web/                     # Generado por el pipeline (markdown → html/json)
├── 📰 informes/                # Informes diarios en markdown
│   ├── _plantilla.md
│   └── YYYY-MM-DD.md          # Un archivo por día
├── 📦 public/                  # Assets estáticos + signals.json
├── ⚙️ .github/workflows/
│   └── informe-diario.yml     # Workflow automático
├── 🐳 docker/                   # RSSHub opcional para scraping
├── 📋 requirements.txt         # Dependencias Python
├── 📦 package.json             # Dependencias Node.js
└── 📄 vercel.json              # Config Vercel
```

---

## 🚀 Uso local

### Requisitos
- Python 3.10+ 
- Node.js 18+ (para la web)
- No requiere API keys para funcionar

### Generar un informe

```bash
# Solo RSS (rápido, ~11s)
python scripts/generar_informe.py

# Recolector completo de señales reales (Google News + Reddit + HN + RSS)
python scripts/collect_signals.py
```

### Actualizar datos de la web

```bash
python scripts/collect_signals.py   # regenera public/signals.json
```

### Correr la web local

```bash
npm install && npm run dev
# → http://localhost:8080
```

---

## ⚙️ Configurar API keys (opcional)

Solo si querés resúmenes con LLM:

```env
# scripts/.env
MOONSHOT_API_KEY=sk-...
# o: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY
```

---

## 🔧 GitHub Actions

El workflow corre todos los días a las 12:00 UTC:

```yaml
schedule:
  - cron: "0 12 * * *"  # 09:00 hora de Chile
```

Pasos:
1. Checkout del repo
2. Setup Python 3.12
3. Generar informe (`generar_informe.py`)
4. Recolectar señales (`collect_signals.py`)
5. Commit y push automático

---

## 🐳 RSSHub (opcional)

Para scraping avanzado sin bloqueos:

```bash
cd docker/rsshub
docker-compose up -d
# → http://localhost:1200
```

---

## 🛡️ Seguridad

- ✅ Branch protection en `main` (force-push bloqueado)
- ✅ GitHub Actions con permisos mínimos
- ✅ Sin API keys en código
- ✅ Licencia MIT

---

## 📊 Estadísticas

![GitHub commit activity](https://img.shields.io/github/commit-activity/m/traderxael/AI-Informe-?style=flat-square)

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-fuente`)
3. Commit (`git commit -m 'feat: agregar fuente X'`)
4. Push (`git push origin feature/nueva-fuente`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la licencia **MIT** — ver [LICENSE](LICENSE) para detalles.

---

<div align="center">

**Hecho con ❤️ y demasiados ☕**

[![GitHub](https://img.shields.io/badge/GitHub-traderxael-181717?style=flat-square&logo=github)](https://github.com/traderxael)
[![Vercel](https://img.shields.io/badge/Vercel-AI-Informe-000000?style=flat-square&logo=vercel)](https://ai-informe-dashboard.vercel.app)

</div>
