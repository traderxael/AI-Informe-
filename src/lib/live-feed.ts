import {
  MODEL_BY_ID,
  SIGNALS,
  WEEK_LABEL,
  isModelId,
  type ModelId,
  type Signal,
  type SourceKind,
} from "./informe-data";

export type LivePayload = {
  generated_at?: string;
  count?: number;
  sources?: string[];
  signals: LiveRaw[];
};

export type LiveRaw = {
  id: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  publisher?: string;
  region?: string;
  country?: string;
  models?: string[];
  source?: string;
  published?: string | null;
  title_orig?: string;
};

export type LiveModelRow = {
  modelo: string;
  elo: number;
  org: string;
  licencia: string;
  precio_in?: number;
  precio_out?: number;
  context?: number;
};

export type LiveModelsPayload = {
  actualizado?: string;
  total?: number;
  con_precio?: number;
  modelos: LiveModelRow[];
};

const CHINA_MODELS = new Set([
  "glm",
  "qwen",
  "kimi",
  "deepseek",
  "minimax",
  "ernie",
  "hunyuan",
  "doubao",
]);

function mapSource(raw?: string): SourceKind {
  if (raw === "lab" || raw === "research" || raw === "social" || raw === "open-source" || raw === "market") {
    return raw;
  }
  if (raw === "news") return "market";
  return "market";
}

function mapRegion(s: LiveRaw): Signal["region"] {
  if (s.region === "china" || s.country === "china") return "china";
  if ((s.models || []).some((m) => CHINA_MODELS.has(m))) return "china";
  return "west";
}

export function mapLiveSignal(s: LiveRaw): Signal {
  const models = (s.models || []).filter(isModelId) as ModelId[];
  const summary = (s.summary || "").replace(/&nbsp;/g, " ").trim();
  const sourceLabel = s.publisher || s.sourceLabel || "Fuente";
  const detailParts = [
    summary && summary !== s.title ? summary : "",
    sourceLabel,
    s.published ? s.published.slice(0, 10) : "",
  ].filter(Boolean);

  return {
    id: s.id,
    title: s.title,
    summary: summary && summary !== s.title ? summary : sourceLabel,
    detail: detailParts.join(" · "),
    region: mapRegion(s),
    models,
    source: mapSource(s.source),
    sourceLabel,
    sourceUrl: s.sourceUrl,
    published: s.published || undefined,
    country: s.country,
  };
}

export function weekLabelFrom(iso?: string, fallback = WEEK_LABEL): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function loadLiveSignals(): Promise<{
  signals: Signal[];
  generatedAt?: string;
  live: boolean;
}> {
  try {
    const firstRes = await fetch("/data/signals-first.json");
    if (!firstRes.ok) throw new Error(String(firstRes.status));
    const first = (await firstRes.json()) as LivePayload;
    let restSignals: LiveRaw[] = [];
    try {
      const restRes = await fetch("/data/signals-rest.json");
      if (restRes.ok) {
        const rest = (await restRes.json()) as LivePayload;
        restSignals = rest.signals || [];
      }
    } catch {
      /* first page still usable */
    }
    const mapped = [...(first.signals || []), ...restSignals].map(mapLiveSignal);
    if (!mapped.length) return { signals: SIGNALS, live: false };
    return { signals: mapped, generatedAt: first.generated_at, live: true };
  } catch {
    return { signals: SIGNALS, live: false };
  }
}

export async function loadLiveModels(): Promise<LiveModelsPayload | null> {
  try {
    const res = await fetch("/data/modelos.json");
    if (!res.ok) return null;
    return (await res.json()) as LiveModelsPayload;
  } catch {
    return null;
  }
}

export function modelLabel(id: string): string {
  return MODEL_BY_ID[id as ModelId]?.label ?? id;
}
