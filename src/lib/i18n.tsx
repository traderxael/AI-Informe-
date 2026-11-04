import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "es" | "en";

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}>({ lang: "es", setLang: () => {}, t: (k) => k });

/** Diccionario del dashboard (portada, navegación y páginas nuevas). */
const DICT: Record<Lang, Record<string, string>> = {
  es: {
    "hero.eyebrow.week": "Informe semanal",
    "hero.eyebrow.live": "Señales del día",
    "hero.title": "El pulso de la inteligencia artificial",
    "hero.sub":
      "Noticias, modelos y movimientos que importan, ordenados por región y por modelo. Una lectura clara del ecosistema global de IA.",
    "hero.corte": "Corte del informe",
    "hero.live": "Actualizado con señales en vivo",
    "hero.ref": "Edición de referencia",
    "tabs.briefing": "Briefing",
    "tabs.precios": "Precios",
    "nav.noticias": "Noticias del día",
    "nav.noticiasShort": "Noticias",
    "nav.tendencias": "Tendencias",
    "nav.estadisticas": "Estadísticas",
    "stat.signals": "Señales",
    "stat.models": "Modelos",
    "stat.region": "Región",
    "stat.west": "Occidente",
    "stat.china": "China",
    "stat.global": "Global",
    "stat.cheapest": "Más barato",
    "stat.model": "Modelo",
    "stat.all": "Todos",
    "share.label": "Compartir",
    "share.done": "¡Copiado!",
    "footer.built": "Hecho con señales públicas de IA",
    "footer.weekly": "Informe semanal",
    "tendencias.title": "Tendencias del ranking de modelos",
    "tendencias.sub":
      "Evolución del Elo de LMArena, run a run. La historia se construye con cada ejecución diaria.",
    "tendencias.empty":
      "Aún no hay suficiente historia para graficar curvas. Cada día se agrega un punto — vuelve mañana. Mientras tanto, el ranking actual:",
    "tendencias.top": "Ranking actual (top 15)",
    "tendencias.elo": "Elo",
    "tendencias.chart.aria": "Curvas de Elo por modelo",
    "estadisticas.title": "Estadísticas del proyecto",
    "estadisticas.sub": "Totales y tendencias calculados de los datos del informe.",
    "estadisticas.signalsByCat": "Señales por categoría",
    "estadisticas.modelsOrg": "Modelos por organización",
    "estadisticas.pricing": "Cobertura de precios",
    "estadisticas.feeds": "Salud de fuentes",
    "estadisticas.feedsOk": "feeds OK",
    "estadisticas.feedsItems": "items recolectados",
    "estadisticas.avgElo": "Elo promedio",
    "estadisticas.orgaMax": "Organización líder",
    "common.back": "← Volver al informe",
    lang: "Idioma",
  },
  en: {
    "hero.eyebrow.week": "Weekly report",
    "hero.eyebrow.live": "Today's signals",
    "hero.title": "The pulse of artificial intelligence",
    "hero.sub":
      "News, models and moves that matter, sorted by region and by model. A clear read on the global AI ecosystem.",
    "hero.corte": "Report cut",
    "hero.live": "Updated with live signals",
    "hero.ref": "Reference edition",
    "tabs.briefing": "Briefing",
    "tabs.precios": "Pricing",
    "nav.noticias": "Today's news",
    "nav.noticiasShort": "News",
    "nav.tendencias": "Trends",
    "nav.estadisticas": "Stats",
    "stat.signals": "Signals",
    "stat.models": "Models",
    "stat.region": "Region",
    "stat.west": "West",
    "stat.china": "China",
    "stat.global": "Global",
    "stat.cheapest": "Cheapest",
    "stat.model": "Model",
    "stat.all": "All",
    "share.label": "Share",
    "share.done": "Copied!",
    "footer.built": "Built with public AI signals",
    "footer.weekly": "Weekly report",
    "tendencias.title": "Model ranking trends",
    "tendencias.sub":
      "LMArena Elo evolution, run by run. History grows with every daily run.",
    "tendencias.empty":
      "Not enough history yet to plot curves. One point is added every day — check back tomorrow. Meanwhile, the current ranking:",
    "tendencias.top": "Current ranking (top 15)",
    "tendencias.elo": "Elo",
    "tendencias.chart.aria": "Elo curves by model",
    "estadisticas.title": "Project statistics",
    "estadisticas.sub": "Totals and trends computed from the report data.",
    "estadisticas.signalsByCat": "Signals by category",
    "estadisticas.modelsOrg": "Models by organization",
    "estadisticas.pricing": "Price coverage",
    "estadisticas.feeds": "Source health",
    "estadisticas.feedsOk": "feeds OK",
    "estadisticas.feedsItems": "items collected",
    "estadisticas.avgElo": "Average Elo",
    "estadisticas.orgaMax": "Leading organization",
    "common.back": "← Back to report",
    lang: "Language",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    let id: number | undefined;
    try {
      const saved = window.localStorage.getItem("ai-informe-lang");
      if (saved === "en" || saved === "es") {
        // aplazado para no llamar setState síncronamente dentro del efecto
        id = window.setTimeout(() => setLangState(saved), 0);
      }
    } catch {
      // localStorage no disponible — se mantiene el idioma por defecto
    }
    return () => {
      if (id !== undefined) window.clearTimeout(id);
    };
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("ai-informe-lang", l);
    } catch {
      // ignorar
    }
  };

  const t = (key: string) => DICT[lang][key] ?? DICT.es[key] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
