export type Region = "west" | "china" | "global";

export type Signal = {
  id: string;
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceLabel?: string;
  publisher?: string;
  region: Region;
  country?: string;
  models: string[];
  source?: string;
  published?: string;
};

export type ModelMeta = { label: string; lab: string; region: Region };

// Los ~25 modelos de la portada original, con label + lab + región.
export const MODEL_META: Record<string, ModelMeta> = {
  claude: { label: "Claude", lab: "Anthropic", region: "west" },
  gpt: { label: "GPT / OpenAI", lab: "OpenAI", region: "west" },
  grok: { label: "Grok", lab: "xAI", region: "west" },
  gemini: { label: "Gemini", lab: "Google", region: "west" },
  llama: { label: "Llama", lab: "Meta", region: "west" },
  mistral: { label: "Mistral", lab: "Mistral AI", region: "west" },
  "aleph-alpha": { label: "Aleph Alpha", lab: "Aleph Alpha", region: "west" },
  "black-forest": { label: "Black Forest", lab: "BFL", region: "west" },
  stability: { label: "Stability", lab: "Stability AI", region: "west" },
  deepl: { label: "DeepL", lab: "DeepL", region: "west" },
  lighton: { label: "LightOn", lab: "LightOn", region: "west" },
  cohere: { label: "Cohere", lab: "Cohere", region: "west" },
  perplexity: { label: "Perplexity", lab: "Perplexity", region: "west" },
  copilot: { label: "Copilot", lab: "Microsoft", region: "west" },
  titan: { label: "Titan / Nova", lab: "Amazon", region: "west" },
  glm: { label: "GLM", lab: "Zhipu", region: "china" },
  qwen: { label: "Qwen", lab: "Alibaba", region: "china" },
  kimi: { label: "Kimi", lab: "Moonshot", region: "china" },
  deepseek: { label: "DeepSeek", lab: "DeepSeek", region: "china" },
  minimax: { label: "MiniMax", lab: "MiniMax", region: "china" },
  hunyuan: { label: "Hunyuan", lab: "Tencent", region: "china" },
  ernie: { label: "ERNIE", lab: "Baidu", region: "china" },
  doubao: { label: "Doubao", lab: "ByteDance", region: "china" },
  fugaku: { label: "Fugaku", lab: "RIKEN", region: "west" },
    hyperclova: { label: "HyperCLOVA", lab: "NAVER", region: "west" },
    gigachat: { label: "GigaChat / Kandinsky", lab: "Sber", region: "west" },
    falcon: { label: "Falcon", lab: "TII", region: "global" },
  };

export const COUNTRY_META: Record<string, { label: string; flag: string }> = {
  usa: { label: "Estados Unidos", flag: "🇺🇸" },
  china: { label: "China", flag: "🇨🇳" },
  japan: { label: "Japón", flag: "🇯🇵" },
  germany: { label: "Alemania", flag: "🇩🇪" },
  france: { label: "Francia", flag: "🇫🇷" },
  korea: { label: "Corea del Sur", flag: "🇰🇷" },
  canada: { label: "Canadá", flag: "🇨🇦" },
  russia: { label: "Rusia", flag: "🇷🇺" },
  uae: { label: "EAU", flag: "🇦🇪" },
  uk: { label: "Reino Unido", flag: "🇬🇧" },
  global: { label: "Global", flag: "🌐" },
};

export const REGION_LABEL: Record<Region, string> = {
  west: "Occidente",
  china: "China",
  global: "Global",
};

// Los 7 modelos protagonistas de los países líderes (USA + China).
// Son los que se muestran primero / destacan en el dashboard.
export const TOP_MODELS: { id: string; countryId: keyof typeof COUNTRY_META | "global" }[] = [
  { id: "gpt", countryId: "usa" },
  { id: "gemini", countryId: "usa" },
  { id: "claude", countryId: "usa" },
  { id: "llama", countryId: "usa" },
  { id: "deepseek", countryId: "china" },
  { id: "qwen", countryId: "china" },
  { id: "glm", countryId: "china" },
];

export const SOURCE_LABEL: Record<string, string> = {
  lab: "Laboratorio",
  "open-source": "Open source",
  research: "Investigación",
  social: "Redes",
  market: "Mercado",
  news: "Noticias",
};

export function modelMeta(id: string): ModelMeta | undefined {
  return MODEL_META[id];
}

export function filterSignals(
  signals: Signal[],
  region: Region | "all",
  model: string | "all",
  country: string | "all",
): Signal[] {
  return signals.filter((s) => {
    const regionOk = region === "all" || s.region === region;
    const modelOk = model === "all" || s.models.includes(model);
    const countryOk = country === "all" || s.country === country;
    return regionOk && modelOk && countryOk;
  });
}

export type SignalsBundle = { signals: Signal[]; generatedAt?: string };

type SignalsPayload = { signals?: Signal[]; generated_at?: string };

// Carga progresiva: los primeros 20 (signals-first.json) para pintar al
// instante con payload mínimo. Si falta (run viejo / dev), cae al JSON
// completo y después a un fallback mínimo: la página nunca queda en blanco.
export async function loadSignals(): Promise<SignalsBundle> {
  try {
    const res = await fetch("/data/signals-first.json", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as SignalsPayload;
      if (data && Array.isArray(data.signals) && data.signals.length) {
        return { signals: data.signals, generatedAt: data.generated_at };
      }
    }
  } catch {
    // fallback abajo
  }
  try {
    const res = await fetch("/signals.json", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as SignalsPayload;
      if (data && Array.isArray(data.signals) && data.signals.length) {
        return { signals: data.signals, generatedAt: data.generated_at };
      }
    }
  } catch {
    // fetch fallback abajo
  }
  return { signals: DEFAULT_SIGNALS };
}

// El resto de las señales (signals-rest.json), para cargar en segundo plano
// tras el primer render. Devuelve [] si falta el archivo o no hay red.
export async function loadRestSignals(): Promise<Signal[]> {
  try {
    const res = await fetch("/data/signals-rest.json", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as SignalsPayload;
      if (data && Array.isArray(data.signals)) return data.signals;
    }
  } catch {
    // sin red / dev: quedarse con lo cargado
  }
  return [];
}

// Fallback mínimo (solo para no mostrar página vacía si no hay datos).
const DEFAULT_SIGNALS: Signal[] = [
  {
    id: "fallback",
    title: "Cargando datos…",
    summary: "Si ves esto más de unos segundos, el recolector aún no generó signals.json. Ejecuta python scripts/recolectar_señales.py.",
    region: "global",
    models: [],
    source: "news",
  },
];