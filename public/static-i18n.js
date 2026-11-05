/* AI Informe — toggle ES/EN de la portada estática (CSP-safe: JS externo) */
(function () {
  var DICT = {
    es: {
      eyebrow: "AI Informe semanal",
      h1: "Inteligencia artificial, por país y por modelo",
      sub: "El ecosistema global de IA en una semana: laboratorios, investigación, código abierto, redes y mercado. Las cifras de abajo se calculan en vivo desde las señales del día.",
      date: "Actualizado a diario · Sin números inventados: todo sale de las fuentes",
      summary: "Resumen ejecutivo",
      "summary.title": "Resumen ejecutivo",
      "summary.sub": "Las tres ideas que conviene llevarse de esta semana.",
      "summary.eyebrow": "En 30 segundos",
      "stat.signals": "señales visibles",
      "stat.models": "modelos cubiertos",
      "stat.sources": "países cubiertos",
      "search.placeholder": "Buscar en títulos, notas, modelos o países",
      reset: "Limpiar",
      share: "Copiar enlace",
      "nav.tendencias": "Tendencias",
      "nav.estadisticas": "Estadísticas",
      "nav.rss": "RSS",
      "archivo.sub": "Todos los informes diarios publicados, desde septiembre de 2026. El texto completo vive en GitHub.",
      "archivo.search": "Buscar en todo el archivo (30 días)…",
      "x.title": "Lo que la IA está haciendo ahora mismo",
      "x.count": "Cargando…",
      "x.sub": "Publicaciones con imagen de los laboratorios y cuentas que seguimos en X, ordenadas por alcance.",
      "tendencias.title": "Tendencias del ranking",
      "tendencias.sub": "Evolución del Elo de los 8 modelos mejor clasificados. La historia crece con cada ejecución diaria.",
      "estadisticas.title": "Estadísticas del proyecto",
      "estadisticas.signals": "señales en 30 días",
      "estadisticas.perDay": "promedio por día",
      "estadisticas.avgElo": "Elo promedio",
      "estadisticas.feedsOk": "feeds OK",
      "estadisticas.orgs": "Modelos por organización",
      "estadisticas.topFeeds": "Fuentes con más artículos"
    },
    en: {
      eyebrow: "AI Weekly Report",
      h1: "Artificial intelligence, by country and by model",
      sub: "The global AI ecosystem in one week: labs, research, open source, networks and the market. The figures below are computed live from today's signals.",
      date: "Updated daily · No invented numbers: everything comes from the sources",
      summary: "Executive summary",
      "summary.title": "Executive summary",
      "summary.sub": "The three ideas worth taking away from this week.",
      "summary.eyebrow": "In 30 seconds",
      "stat.signals": "visible signals",
      "stat.models": "models covered",
      "stat.sources": "countries covered",
      "search.placeholder": "Search titles, notes, models or countries",
      reset: "Clear",
      share: "Copy link",
      "nav.tendencias": "Trends",
      "nav.estadisticas": "Stats",
      "nav.rss": "RSS",
      "archivo.sub": "All daily reports published since September 2026. The full text lives on GitHub.",
      "archivo.search": "Search the whole archive (30 days)…",
      "x.title": "What AI is doing right now",
      "x.count": "Loading…",
      "x.sub": "Posts with images from the labs and accounts we follow on X, ranked by reach.",
      "tendencias.title": "Model ranking trends",
      "tendencias.sub": "Elo evolution of the top 8 models. History grows with every daily run.",
      "estadisticas.title": "Project statistics",
      "estadisticas.signals": "signals in 30 days",
      "estadisticas.perDay": "average per day",
      "estadisticas.avgElo": "Average Elo",
      "estadisticas.feedsOk": "feeds OK",
      "estadisticas.orgs": "Models by organization",
      "estadisticas.topFeeds": "Sources with most articles"
    }
  };

  var lang = "es";
  try { lang = window.localStorage.getItem("ai-informe-lang") === "en" ? "en" : "es"; } catch (e) { /* storage no disponible */ }

  function apply(l) {
    lang = l;
    try { window.localStorage.setItem("ai-informe-lang", l); } catch (e) { /* storage no disponible */ }
    var d = DICT[l];
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute("data-i18n");
      if (d[key]) nodes[i].textContent = d[key];
    }
    var ph = document.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < ph.length; j++) {
      var pkey = ph[j].getAttribute("data-i18n-placeholder");
      if (d[pkey]) ph[j].setAttribute("placeholder", d[pkey]);
    }
    var es = document.getElementById("lang-es");
    var en = document.getElementById("lang-en");
    if (es && en) {
      es.setAttribute("aria-pressed", String(l === "es"));
      en.setAttribute("aria-pressed", String(l === "en"));
    }
    document.documentElement.lang = l;
  }

  var esBtn = document.getElementById("lang-es");
  var enBtn = document.getElementById("lang-en");
  if (esBtn) esBtn.addEventListener("click", function () { apply("es"); });
  if (enBtn) enBtn.addEventListener("click", function () { apply("en"); });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { apply(lang); });
  } else {
    apply(lang);
  }
})();
