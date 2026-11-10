import { get, put } from "@vercel/blob";

/**
 * Analítica first-party de AI Informe.
 * Recepción de visitas: el beacon de /analytics.js hace POST a /api/ping.
 * Guarda un resumen agregado (sin PII, sin cookies) en Vercel Blob.
 */

const SUMMARY_PATH = "analytics/summary.json";

type Summary = {
  total: number;
  days: Record<string, number>;
  paths: Record<string, number>;
  refs: Record<string, number>;
  updated: string;
};

function emptySummary(): Summary {
  return { total: 0, days: {}, paths: {}, refs: {}, updated: "" };
}

async function readSummary(token: string): Promise<Summary> {
  try {
    const res = await get(SUMMARY_PATH, { access: "private", token });
    if (res.statusCode !== 200 || !res.stream) return emptySummary();
    const text = await new Response(res.stream).text();
    const parsed = JSON.parse(text);
    return { ...emptySummary(), ...parsed };
  } catch {
    // primer arranque o blob inexistente: se empieza de cero
    return emptySummary();
  }
}

export default defineEventHandler(async (event) => {
  if (event.method !== "POST") {
    throw createError({ statusCode: 405, statusMessage: "Method Not Allowed" });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    // sin token no se rompe la app: la visita solo no se registra
    return { ok: false, reason: "no_token" };
  }

  const body = (await readBody(event).catch(() => null)) as
    | { path?: unknown; ref?: unknown }
    | null;

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const path = typeof body?.path === "string" && body.path ? body.path.slice(0, 200) : "/";
  const ref = typeof body?.ref === "string" ? body.ref.slice(0, 300) : "";

  const summary = await readSummary(token);
  summary.total += 1;
  summary.days[day] = (summary.days[day] ?? 0) + 1;
  summary.paths[path] = (summary.paths[path] ?? 0) + 1;
  if (ref) {
    try {
      const host = new URL(ref).host;
      if (host) summary.refs[host] = (summary.refs[host] ?? 0) + 1;
    } catch {
      /* referente sin URL válida: se ignora */
    }
  }
  summary.updated = now.toISOString();

  await put(SUMMARY_PATH, JSON.stringify(summary), {
    access: "private",
    token,
    contentType: "application/json",
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });

  return { ok: true };
});
