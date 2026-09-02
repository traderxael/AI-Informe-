export type Region = "west" | "china";

export type ModelId = "claude" | "grok" | "gemini" | "glm" | "qwen" | "kimi";

export type SourceKind =
  | "lab"
  | "open-source"
  | "research"
  | "social"
  | "market";

export type Signal = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  region: Region;
  models: ModelId[];
  source: SourceKind;
  sourceLabel: string;
};

export const WEST_MODELS: { id: ModelId; label: string; lab: string }[] = [
  { id: "claude", label: "Claude", lab: "Anthropic" },
  { id: "grok", label: "Grok", lab: "xAI" },
  { id: "gemini", label: "Gemini", lab: "Google" },
];

export const CHINA_MODELS: { id: ModelId; label: string; lab: string }[] = [
  { id: "glm", label: "GLM", lab: "Zhipu" },
  { id: "qwen", label: "Qwen", lab: "Alibaba" },
  { id: "kimi", label: "Kimi", lab: "Moonshot" },
];

export const ALL_MODELS = [...WEST_MODELS, ...CHINA_MODELS];

export const WEEK_LABEL = "1 – 7 de septiembre 2026";

export const SIGNALS: Signal[] = [
  {
    id: "claude-fable",
    title: "Claude Fable 5.1 llega al frente de razonamiento",
    summary:
      "Anthropic publica Fable 5.1. En evaluaciones de agentes y corrección de código sigue liderando frente a GPT y Gemini en casos límite.",
    detail:
      "Opus 5 y Fable 5.1 destacan en tareas de ingeniería con edge cases. El coste por token es más alto que Gemini Flash o GLM, pero la tasa de éxito en flujos largos justifica el premium para trabajo de producto. En X y HN el debate es calidad vs. precio, no si Claude sigue en el top.",
    region: "west",
    models: ["claude"],
    source: "lab",
    sourceLabel: "Anthropic",
  },
  {
    id: "grok-46",
    title: "Grok 4.6: más cerca del tope, más barato por token",
    summary:
      "xAI sitúa Grok 4.6 a pocos puntos del líder, con precio agresivo. Su ventaja clara: búsqueda en vivo y contexto actualizado.",
    detail:
      "En benchmarks de agosto queda cerca de GPT-5.6 Sol a un tercio del precio de salida. Sigue por detrás de Claude en generación de código y recall de contexto largo (>128k). Si el trabajo depende de la web en tiempo real, Grok es el modelo occidental más competitivo por coste.",
    region: "west",
    models: ["grok"],
    source: "lab",
    sourceLabel: "xAI",
  },
  {
    id: "gemini-flash",
    title: "Gemini 3.7 Flash: volumen y código a precio promocional",
    summary:
      "Google baja de precio Flash hasta fin de año. Es el modelo occidental más eficiente para volumen, con salto claro en código vs. 3.6.",
    detail:
      "Gemini 3.7 Flash mejora cuatro puntos a 3.6 Flash y Google lo deja en tarifa promocional. Equipos lo usan para generadores de sitios, simuladores y pipelines de agentes. Gemini 3.5 Pro sigue siendo la pieza de contexto ultra-largo (Deep Think). La conversación en Occidente: Flash para escala, Claude para precisión.",
    region: "west",
    models: ["gemini"],
    source: "lab",
    sourceLabel: "Google",
  },
  {
    id: "west-compare",
    title: "Occidente: Claude precisión, Gemini escala, Grok en vivo",
    summary:
      "El mapa occidental se estabiliza en tres roles. Nadie cierra el gap de agentes de Claude; Gemini gana volumen; Grok gana actualidad.",
    detail:
      "Suscripciones tope (Claude Max, SuperGrok Heavy, Google Ultra) se comparan sobre todo en coding. Claude gana calidad. Gemini gana coste por millón y contexto. Grok gana integración con X y datos en vivo. Elegir uno ya no es ranking único: es rol.",
    region: "west",
    models: ["claude", "grok", "gemini"],
    source: "market",
    sourceLabel: "Occidente",
  },
  {
    id: "glm-53",
    title: "GLM-5.3 iguala a Kimi K3 a menor coste por tarea",
    summary:
      "Zhipu publica GLM-5.3. Empata el score de Kimi K3 y sale más barato por tarea que Grok 4.6. GLM-5.3 Flash lidera preferencia de usuarios.",
    detail:
      "Artificial Analysis aún lo clasifica como API propietaria. GLM-5.2 MIT sigue siendo el open-weight más usable en hardware modesto (753B MoE, ~40B activos). En China el hilo dominante es inferencia barata y agentes locales, no el Elo de Arena.",
    region: "china",
    models: ["glm", "kimi"],
    source: "lab",
    sourceLabel: "Zhipu",
  },
  {
    id: "qwen-38",
    title: "Qwen 3.8 se parte en dos: Max cerrado y checkpoint abierto",
    summary:
      "Alibaba lanza Qwen3.8-Max (API multimodal, score 58) y un checkpoint 2.4T A95B descargable, texto-only y con licencia comercial restringida.",
    detail:
      "La familia Qwen es la más completa del año en China: Coder-Next para código, 3.6 para local, 3.8-Max para frontera, 3.8 Flash y 27B para latencia. Quien sigue un solo linaje chino, sigue Qwen. En Weibo y Zhihu el debate es licencia vs. rendimiento, no si Qwen está en el mapa.",
    region: "china",
    models: ["qwen"],
    source: "lab",
    sourceLabel: "Alibaba",
  },
  {
    id: "kimi-k3",
    title: "Kimi K3 open-weight: el más grande publicado hasta ahora",
    summary:
      "Moonshot suelta pesos de Kimi K3 (~2.8T). Lidera Frontend Code Arena. Hardware serio: cientos de GB en disco.",
    detail:
      "K3 sale el 26 de julio y sigue dominando conversación en septiembre. En agentes de UI queda por encima de Fable 5 en Frontend Code Arena. El coste por tarea en API sigue alto frente a DeepSeek o GLM Flash. En redes chinas: ‘¿quién puede hospedarlo?’ más que ‘¿quién gana el bench?’",
    region: "china",
    models: ["kimi"],
    source: "open-source",
    sourceLabel: "Moonshot",
  },
  {
    id: "china-compare",
    title: "China: Qwen cobertura, GLM agentes locales, Kimi peso bruto",
    summary:
      "Tres polos claros. Qwen cubre local + frontera. GLM es el agente que dejas corriendo. Kimi empuja el techo open-weight.",
    detail:
      "En Weibo, Zhihu y Bilibili la semana no gira alrededor de OpenAI. Gira alrededor de coste de inferencia, chips locales y si GLM-5.3 Flash o Qwen Flash ganan el día a día. Occidente actualiza; China comprime precio y open-weight al mismo tiempo.",
    region: "china",
    models: ["glm", "qwen", "kimi"],
    source: "social",
    sourceLabel: "Weibo / Zhihu",
  },
  {
    id: "arxiv-agents",
    title: "arXiv: planificación y memoria, no más chat",
    summary:
      "Los papers de cs.AI / cs.LG de la semana empujan agentes multi-paso. El chat plano ya no es el objeto de estudio.",
    detail:
      "Trabajos recientes se centran en planificar antes de actuar y en memoria de largo plazo. Eso alinea investigación con lo que Claude, GLM y Kimi venden en producto: sistemas que ejecutan, no que contestan. GitHub Trending sigue la misma línea (orquestación RAG + agentes).",
    region: "west",
    models: ["claude", "gemini"],
    source: "research",
    sourceLabel: "arXiv",
  },
  {
    id: "github-agents",
    title: "GitHub Trending: orquestación, no demos de chatbot",
    summary:
      "Los repos que suben son frameworks de agentes, RAG y observabilidad. El chatbot suelto ya no trending.",
    detail:
      "Tanto stacks occidentales (Claude / Grok tool-use) como chinos (Qwen-Coder, GLM agent loops) alimentan las mismas plantillas: plan → herramienta → verificación. Quien publique un wrapper de chat esta semana no entra en el ranking.",
    region: "west",
    models: ["claude", "grok", "qwen", "glm"],
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

export function filterSignals(
  region: Region | "all",
  model: ModelId | "all",
): Signal[] {
  const westIds: ModelId[] = ["claude", "grok", "gemini"];
  const chinaIds: ModelId[] = ["glm", "qwen", "kimi"];
  return SIGNALS.filter((s) => {
    const regionOk =
      region === "all" ||
      s.region === region ||
      (region === "west" && s.models.some((m) => westIds.includes(m))) ||
      (region === "china" && s.models.some((m) => chinaIds.includes(m)));
    const modelOk = model === "all" || s.models.includes(model);
    return regionOk && modelOk;
  });
}
