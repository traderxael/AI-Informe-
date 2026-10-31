/**
 * noticias-data.ts — dominio de la sección «Noticias del día».
 *
 * Reutiliza el pipeline real de señales (signals-first/rest.json) y añade:
 *  - clasificación por categoría (IA, ciencia, política, china, economía, seguridad),
 *  - detección de idioma para priorizar contenido en español,
 *  - helpers puros y testeables (sin red, sin DOM).
 */
import type { Signal } from "./informe-data";

export const CATEGORIAS = [
  "ia",
  "ciencia",
  "politica",
  "china",
  "economia",
  "seguridad",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_META: Record<Categoria, { label: string; color: string }> = {
  ia: { label: "IA", color: "text-accent border-accent/30 bg-accent/10" },
  ciencia: { label: "Ciencia", color: "text-west border-west/30 bg-west/10" },
  politica: { label: "Política", color: "text-china border-china/30 bg-china/10" },
  china: { label: "China", color: "text-amber-300 border-amber-300/30 bg-amber-300/10" },
  economia: { label: "Economía", color: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10" },
  seguridad: { label: "Seguridad", color: "text-rose-300 border-rose-300/30 bg-rose-300/10" },
};

/** Reglas ordenadas: la primera coincidencia gana. Palabras en minúsculas,
 *  sin acentos (se comparan contra texto plegado con foldText). */
const CATEGORY_RULES: Array<[Categoria, string[]]> = [
  ["china", ["china", "chinese", "beijing", "shanghai", "zhipu", "moonshot", "alibaba", "baidu", "tencent", "bytedance", "doubao", "hunyuan", "ernie", "weibo", "xi'an"]],
  ["seguridad", ["security", "vulnerab", "exploit", "malware", "breach", "hack", "ransom", "phishing", "safety", "peligro", "ciberseguridad", "incidente"]],
  ["politica", ["policy", "regulat", "government", "congress", "senate", "eu ", "white house", "ley", "gobierno", "eleccion", "democrat", "republican", "senador", "mandato", "trump", "biden", "union europea", "antitrust", "sanction", "arancel", "tariff", "geopolit", "election", "vote", "parliament", "senado", "politico", "política", "president", "minister"]],
  ["ciencia", ["research", "study", "science", "arxiv", "nature", "journal", "discovery", "quantum", "biotech", "climate", "space", "ciencia", "investigacion", "estudio", "descubrimiento", "cuantico", "medicina", "neuro", "physics", "nasa"]],
  ["economia", ["market", "economy", "investment", "funding", "valuation", "revenue", "profit", "stock", "ipo", "merger", "acquisition", "mercado", "economia", "inversion", "financiamiento", "billion", "millon", "startup", "venture", "capital"]],
  ["ia", ["ai", "artificial intelligence", "inteligencia artificial", "llm", "model", "gpt", "claude", "gemini", "grok", "deepseek", "qwen", "kimi", "glm", "machine learning", "neural", "chatbot", "agent", "training", "inference"]],
];

function textHay(s: Signal): string {
  return `${s.title} ${s.summary} ${s.detail} ${s.sourceLabel} ${(s.country ?? "")} ${s.models.join(" ")}`.toLowerCase();
}

/** Términos cortos/ambiguos que exigen coincidencia por palabra completa
 *  (evals: «ai» dentro de «said», «chain» o «maintain» falseaba la categoría). */
const WORD_BOUNDARY_TERMS = new Set(["ai", "eu", "ley"]);

function ruleMatches(hay: string, word: string): boolean {
  const w = word.trim();
  if (WORD_BOUNDARY_TERMS.has(w)) {
    // Reexpresión cacheada perezosamente: se compila una sola vez por término.
    let re = termRegexes.get(w);
    if (!re) {
      re = new RegExp(`(?:^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`);
      termRegexes.set(w, re);
    }
    return re.test(hay);
  }
  return hay.includes(word);
}
const termRegexes = new Map<string, RegExp>();

/** Clasifica una señal en una categoría determinista. */
export function categorizeSignal(s: Signal): Categoria {
  const hay = textHay(s);
  // China como región explícita manda sobre otras reglas léxicas.
  if (s.region === "china") return "china";
  for (const [cat, words] of CATEGORY_RULES) {
    if (words.some((w) => ruleMatches(hay, w))) return cat;
  }
  return "ia";
}

/** Heurística ligera de idioma basada en caracteres y stopwords. */
export function detectLang(text: string): "es" | "en" | "zh" | "other" {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  const t = text.toLowerCase();
  const es = ["á", "é", "í", "ó", "ú", "ñ", " ¿", " la ", " el ", " los ", " una ", " para ", " con ", " más ", " inteligencia"];
  const en = [" the ", " and ", " of ", " to ", " in ", " is ", " for ", " with ", " artificial", " model", " release"];
  const scoreEs = es.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  const scoreEn = en.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  if (scoreEs >= 2 && scoreEs >= scoreEn) return "es";
  if (scoreEn >= 2) return "en";
  return "other";
}

export type NoticiaDelDia = Signal & { categoria: Categoria; lang: "es" | "en" | "zh" | "other" };

export function enrichSignals(list: Signal[]): NoticiaDelDia[] {
  return list.map((s) => ({ ...s, categoria: categorizeSignal(s), lang: detectLang(`${s.title} ${s.summary}`) }));
}

/** Prioriza español, luego newest first by published. */
export function sortNoticias(list: NoticiaDelDia[]): NoticiaDelDia[] {
  return [...list].sort((a, b) => {
    const langRank = (x: NoticiaDelDia) => (x.lang === "es" ? 0 : x.lang === "en" ? 1 : 2);
    const lr = langRank(a) - langRank(b);
    if (lr !== 0) return lr;
    const pa = a.published ? Date.parse(a.published) : 0;
    const pb = b.published ? Date.parse(b.published) : 0;
    return pb - pa;
  });
}

export function filterByCategory(list: NoticiaDelDia[], cat: Categoria | "todas"): NoticiaDelDia[] {
  return cat === "todas" ? list : list.filter((n) => n.categoria === cat);
}

/** Agrupa por categoría preservando el orden relativo. */
export function groupByCategory(list: NoticiaDelDia[]): Array<{ categoria: Categoria; items: NoticiaDelDia[] }> {
  const map = new Map<Categoria, NoticiaDelDia[]>();
  for (const item of list) {
    const arr = map.get(item.categoria) ?? [];
    arr.push(item);
    map.set(item.categoria, arr);
  }
  return CATEGORIAS.filter((c) => map.has(c)).map((c) => ({ categoria: c, items: map.get(c)! }));
}
