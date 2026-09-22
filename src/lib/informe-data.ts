export type Region = "west" | "china";

export type ModelId =
  | "claude"
  | "gpt"
  | "grok"
  | "gemini"
  | "glm"
  | "qwen"
  | "kimi"
  | "deepseek"
  | "minimax";

export type SourceKind =
  | "lab"
  | "open-source"
  | "research"
  | "social"
  | "market";

export type ModelInfo = {
  id: ModelId;
  label: string;
  lab: string;
  region: Region;
  flagship: string;
  inputPerM: number;
  outputPerM: number;
  plan: string;
  note: string;
};

export type Signal = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  region: Region;
  models: ModelId[];
  source: SourceKind;
  sourceLabel: string;
  sourceUrl?: string;
  published?: string;
  country?: string;
};

/** Precios API en USD / 1M tokens. Plan = suscripción de consumidor. Orientativo, sept 2026. */
export const MODELS: ModelInfo[] = [
  {
    id: "claude",
    label: "Claude",
    lab: "Anthropic",
    region: "west",
    flagship: "Fable 5.1",
    inputPerM: 10,
    outputPerM: 50,
    plan: "Max 20× · $200/mes",
    note: "Calidad de agentes y código. El token más caro del mapa.",
  },
  {
    id: "gpt",
    label: "GPT",
    lab: "OpenAI",
    region: "west",
    flagship: "GPT-5.6 Sol",
    inputPerM: 4,
    outputPerM: 20,
    plan: "Pro 20× · $200/mes",
    note: "Sol es frontera; Luna ($0.20 / $1.20) cubre volumen.",
  },
  {
    id: "grok",
    label: "Grok",
    lab: "xAI",
    region: "west",
    flagship: "Grok 4.6",
    inputPerM: 2,
    outputPerM: 6,
    plan: "SuperGrok Heavy · $300/mes",
    note: "Mejor ratio occidental calidad/precio con web en vivo.",
  },
  {
    id: "gemini",
    label: "Gemini",
    lab: "Google",
    region: "west",
    flagship: "3.7 Flash",
    inputPerM: 0.75,
    outputPerM: 3.75,
    plan: "AI Ultra 20× · $200/mes",
    note: "Tarifa promocional Flash hasta fin de año. Pro sigue más caro.",
  },
  {
    id: "glm",
    label: "GLM",
    lab: "Zhipu",
    region: "china",
    flagship: "GLM-5.3",
    inputPerM: 1.4,
    outputPerM: 4.4,
    plan: "GLM Coding · plan local",
    note: "5.3 Flash baja a ~$0.07 / $0.25. Open-weight 5.2 en MIT.",
  },
  {
    id: "qwen",
    label: "Qwen",
    lab: "Alibaba",
    region: "china",
    flagship: "Qwen3.8-Max",
    inputPerM: 2,
    outputPerM: 6,
    plan: "Qwen API / Tongyi",
    note: "Familia completa: Flash barato, Max frontera, 27B local.",
  },
  {
    id: "kimi",
    label: "Kimi",
    lab: "Moonshot",
    region: "china",
    flagship: "Kimi K3",
    inputPerM: 3,
    outputPerM: 15,
    plan: "Kimi + membresía",
    note: "Open-weight enorme. API cara frente a DeepSeek y GLM Flash.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    lab: "DeepSeek",
    region: "china",
    flagship: "V4 Pro",
    inputPerM: 0.43,
    outputPerM: 0.87,
    plan: "API pay-as-you-go",
    note: "El más barato usable a escala. Flash aún más bajo. Pico/valle.",
  },
  {
    id: "minimax",
    label: "MiniMax",
    lab: "MiniMax",
    region: "china",
    flagship: "M3",
    inputPerM: 0.3,
    outputPerM: 1.2,
    plan: "Hailuo / API",
    note: "Agentes y multimodal a precio de presupuesto.",
  },
];

export const WEST_MODELS = MODELS.filter((m) => m.region === "west");
export const CHINA_MODELS = MODELS.filter((m) => m.region === "china");
export const ALL_MODELS = MODELS;

export const MODEL_BY_ID: Record<ModelId, ModelInfo> = MODELS.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<ModelId, ModelInfo>,
);

export const WEEK_LABEL = "1 – 7 de septiembre 2026";

export const SIGNALS: Signal[] = [
  {
    id: "claude-fable",
    title: "Claude Fable 5.1 llega al frente de razonamiento",
    summary:
      "Anthropic publica Fable 5.1. En agentes y corrección de código sigue liderando frente a GPT y Gemini en casos límite.",
    detail:
      "Opus 5 y Fable 5.1 destacan en ingeniería con edge cases. A $10 / $50 por millón es el token más caro del mapa: se paga tasa de éxito en flujos largos, no volumen.",
    region: "west",
    models: ["claude"],
    source: "lab",
    sourceLabel: "Anthropic",
  },
  {
    id: "gpt-56",
    title: "GPT-5.6: Sol en frontera, Luna en volumen",
    summary:
      "OpenAI parte la familia. Sol compite arriba; Luna ($0.20 / $1.20) es el flagship barato de Occidente.",
    detail:
      "ChatGPT Pro 20× sigue en $200/mes. Quien mide coste por millón usa Luna o Terra; quien mide SWE-bench mira Sol. El debate en X ya no es ‘GPT vs todos’, es qué SKU de GPT.",
    region: "west",
    models: ["gpt"],
    source: "lab",
    sourceLabel: "OpenAI",
  },
  {
    id: "grok-46",
    title: "Grok 4.6: más cerca del tope, más barato por token",
    summary:
      "xAI sitúa 4.6 a pocos puntos del líder, a $2 / $6. Su ventaja: búsqueda en vivo.",
    detail:
      "Sigue por detrás de Claude en código y recall >128k. SuperGrok Heavy ($300) es la suscripción más cara; el API, en cambio, es el occidental más razonable si el trabajo vive en la web.",
    region: "west",
    models: ["grok"],
    source: "lab",
    sourceLabel: "xAI",
  },
  {
    id: "gemini-flash",
    title: "Gemini 3.7 Flash: volumen a precio promocional",
    summary:
      "Google deja Flash en $0.75 / $3.75 hasta fin de año. Salto claro en código vs. 3.6.",
    detail:
      "Equipos lo usan para generadores de sitios y pipelines de agentes. Pro sigue siendo la pieza de contexto ultra-largo. En Occidente: Flash para escala, Claude para precisión, GPT para el stack ya instalado.",
    region: "west",
    models: ["gemini"],
    source: "lab",
    sourceLabel: "Google",
  },
  {
    id: "west-compare",
    title: "Occidente: cuatro roles, no un ranking",
    summary:
      "Claude calidad, GPT ecosistema, Gemini escala, Grok actualidad. Eligiendo rol, no Elo.",
    detail:
      "Suscripciones tope (Claude Max, ChatGPT Pro, SuperGrok Heavy, Google Ultra) se comparan en coding. El API cuenta otra historia: Luna y Flash aplastan a Fable en coste. Mezclar SKUs es la norma.",
    region: "west",
    models: ["claude", "gpt", "grok", "gemini"],
    source: "market",
    sourceLabel: "Occidente",
  },
  {
    id: "glm-53",
    title: "GLM-5.3 iguala a Kimi K3 a menor coste por tarea",
    summary:
      "Zhipu publica 5.3 a $1.40 / $4.40. Flash (~$0.07 / $0.25) lidera preferencia de usuarios.",
    detail:
      "GLM-5.2 MIT sigue siendo el open-weight más usable en hardware modesto. En China el hilo es inferencia barata y agentes locales, no el Elo de Arena.",
    region: "china",
    models: ["glm", "kimi"],
    source: "lab",
    sourceLabel: "Zhipu",
  },
  {
    id: "qwen-38",
    title: "Qwen 3.8 se parte en dos: Max cerrado y checkpoint abierto",
    summary:
      "Alibaba lanza Qwen3.8-Max (API) y un checkpoint 2.4T descargable, texto-only y con licencia comercial restringida.",
    detail:
      "La familia más completa del año en China: Coder-Next, 3.6 local, 3.8-Max frontera, Flash para latencia. En Weibo el debate es licencia vs. rendimiento.",
    region: "china",
    models: ["qwen"],
    source: "lab",
    sourceLabel: "Alibaba",
  },
  {
    id: "kimi-k3",
    title: "Kimi K3 open-weight: el más grande publicado hasta ahora",
    summary:
      "Moonshot suelta pesos de K3 (~2.8T). Lidera Frontend Code Arena. Hardware serio.",
    detail:
      "API a $3 / $15. Frente a DeepSeek V4 Pro ($0.43 / $0.87) el coste por tarea duele. En redes chinas: quién puede hospedarlo, no quién gana el bench.",
    region: "china",
    models: ["kimi"],
    source: "open-source",
    sourceLabel: "Moonshot",
  },
  {
    id: "deepseek-v4",
    title: "DeepSeek V4: el suelo de precio no se mueve",
    summary:
      "V4 Pro y Flash siguen siendo el referente de coste por tarea. Picos y valles en la tarifa.",
    detail:
      "Quien corre volumen en China o en proxy occidental empieza aquí. No gana Arena frente a Kimi o Claude; gana la factura. Flash es el default de scraping, RAG y agentes baratos.",
    region: "china",
    models: ["deepseek"],
    source: "lab",
    sourceLabel: "DeepSeek",
  },
  {
    id: "minimax-m3",
    title: "MiniMax M3: agentes y multimodal baratos",
    summary:
      "M3 se sitúa ~$0.30 / $1.20. Entra en conversaciones de Hailuo y de orquestación, no solo de chat.",
    detail:
      "No desplaza a Qwen en cobertura ni a GLM en coding local. Sí ocupa el hueco ‘barato y suficiente’ junto a DeepSeek cuando el trabajo es multimodal o de agente corto.",
    region: "china",
    models: ["minimax"],
    source: "lab",
    sourceLabel: "MiniMax",
  },
  {
    id: "china-compare",
    title: "China: precio, open-weight y cobertura",
    summary:
      "DeepSeek y MiniMax comprimen factura. GLM agentes locales. Qwen cubre el stack. Kimi empuja peso bruto.",
    detail:
      "Weibo, Zhihu y Bilibili no giran alrededor de OpenAI. Giran alrededor de chips locales y de si GLM-5.3 Flash o Qwen Flash ganan el día a día. Occidente actualiza; China comprime precio al mismo tiempo.",
    region: "china",
    models: ["glm", "qwen", "kimi", "deepseek", "minimax"],
    source: "social",
    sourceLabel: "Weibo / Zhihu",
  },
  {
    id: "arxiv-agents",
    title: "arXiv: planificación y memoria, no más chat",
    summary:
      "cs.AI / cs.LG de la semana empujan agentes multi-paso. El chat plano ya no es el objeto de estudio.",
    detail:
      "Planificar antes de actuar y memoria de largo plazo. Alinea investigación con lo que Claude, GLM y Kimi venden en producto: sistemas que ejecutan.",
    region: "west",
    models: ["claude", "gemini"],
    source: "research",
    sourceLabel: "arXiv",
  },
  {
    id: "github-agents",
    title: "GitHub Trending: orquestación, no demos de chatbot",
    summary:
      "Suben frameworks de agentes, RAG y observabilidad. El chatbot suelto no entra al ranking.",
    detail:
      "Stacks occidentales (Claude / Grok / GPT tool-use) y chinos (Qwen-Coder, GLM loops, DeepSeek) alimentan la misma plantilla: plan → herramienta → verificación.",
    region: "west",
    models: ["claude", "gpt", "grok", "qwen", "glm", "deepseek"],
    source: "open-source",
    sourceLabel: "GitHub",
  },
];

export const SOURCE_LABEL: Record<SourceKind, string> = {
  lab: "Laboratorio",
  "open-source": "Open source",
  research: "Investigación",
  social: "Redes",
  market: "Mercado",
};

export function blendedPerM(m: ModelInfo, inShare = 0.75): number {
  return m.inputPerM * inShare + m.outputPerM * (1 - inShare);
}

export function filterSignals(
  list: Signal[],
  region: Region | "all",
  model: ModelId | "all",
): Signal[] {
  return list.filter((s) => {
    const regionOk =
      region === "all" ||
      s.region === region ||
      s.models.some((id) => MODEL_BY_ID[id]?.region === region);
    const modelOk = model === "all" || s.models.includes(model);
    return regionOk && modelOk;
  });
}

export function matchesQuery(s: Signal, q: string): boolean {
  if (!q) return true;
  const hay = [
    s.title,
    s.summary,
    s.detail,
    s.sourceLabel,
    ...s.models.flatMap((id) => {
      const m = MODEL_BY_ID[id];
      return m ? [m.id, m.label, m.lab, m.flagship] : [id];
    }),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function isModelId(v: unknown): v is ModelId {
  return typeof v === "string" && v in MODEL_BY_ID;
}

export function modelsForRegion(region: Region | "all"): ModelInfo[] {
  if (region === "west") return WEST_MODELS;
  if (region === "china") return CHINA_MODELS;
  return ALL_MODELS;
}

export function formatUsd(n: number) {
  return n >= 10 ? n.toFixed(0) : n.toFixed(2);
}

export type InformeSearch = {
  region: Region | "all";
  model: ModelId | "all";
  tab: "briefing" | "precios";
};

export function parseInformeSearch(raw: Record<string, unknown>): InformeSearch {
  const region = raw.region === "west" || raw.region === "china" ? raw.region : "all";
  const model = isModelId(raw.model) ? raw.model : "all";
  const tab = raw.tab === "precios" ? "precios" : "briefing";
  return { region, model, tab };
}
