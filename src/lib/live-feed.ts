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

/** Caché de sesión: evita re-fetchear los mismos JSON al navegar entre vistas
 *  (informe ↔ noticias). Los datos se regeneran una vez al día vía CI, así que
 *  cachear en memoria es seguro y reduce peticiones y parpadeos de loading. */
let signalsCache: { signals: Signal[]; generatedAt?: string; live: boolean } | null = null;
let signalsInflight: Promise<{ signals: Signal[]; generatedAt?: string; live: boolean }> | null = null;
let modelsCache: LiveModelsPayload | null | undefined; // undefined = sin consultar aún
let modelsInflight: Promise<LiveModelsPayload | null> | null = null;

/** Fuerza la recarga de señales (usado por el botón «Refrescar»). */
export function invalidateLiveSignals() {
  signalsCache = null;
}

export async function loadLiveSignals(): Promise<{
  signals: Signal[];
  generatedAt?: string;
  live: boolean;
}> {
  if (signalsCache) return signalsCache;
  if (signalsInflight) return signalsInflight; // dedupe de llamadas concurrentes
  signalsInflight = (async () => {
    try {
      // Ambos feeds se piden en paralelo (antes eran secuenciales: 2 RTTs).
      const [firstRes, restRes] = await Promise.all([
        fetch("/data/signals-first.json"),
        fetch("/data/signals-rest.json").catch(() => null),
      ]);
      if (!firstRes || !firstRes.ok) throw new Error(String(firstRes?.status ?? "network"));
      const first = (await firstRes.json()) as LivePayload;
      let restSignals: LiveRaw[] = [];
      if (restRes && restRes.ok) {
        try {
          const rest = (await restRes.json()) as LivePayload;
          restSignals = rest.signals || [];
        } catch {
          /* first page still usable */
        }
      }
      const mapped = [...(first.signals || []), ...restSignals].map(mapLiveSignal);
      if (!mapped.length) return { signals: SIGNALS, live: false };
      const result = { signals: mapped, generatedAt: first.generated_at, live: true };
      signalsCache = result;
      return result;
    } catch {
      return { signals: SIGNALS, live: false };
    } finally {
      signalsInflight = null;
    }
  })();
  return signalsInflight;
}

export async function loadLiveModels(): Promise<LiveModelsPayload | null> {
  if (modelsCache !== undefined) return modelsCache;
  if (modelsInflight) return modelsInflight;
  modelsInflight = (async () => {
    try {
      const res = await fetch("/data/modelos.json");
      if (!res.ok) return null;
      const data = (await res.json()) as LiveModelsPayload;
      modelsCache = data;
      return data;
    } catch {
      modelsCache = null;
      return null;
    } finally {
      modelsInflight = null;
    }
  })();
  return modelsInflight;
}

export function modelLabel(id: string): string {
  return MODEL_BY_ID[id as ModelId]?.label ?? id;
}
