import { defineEventHandler } from "h3";
import { get } from "@vercel/blob";

/** Devuelve el resumen de analítica para el dashboard /analitica. */

const SUMMARY_PATH = "analytics/summary.json";

export default defineEventHandler(async () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false as const, reason: "no_token" };
  try {
    const res = await get(SUMMARY_PATH, { access: "private", token });
    if (res.statusCode !== 200 || !res.stream) {
      return { ok: true as const, summary: null };
    }
    const text = await new Response(res.stream).text();
    return { ok: true as const, summary: JSON.parse(text) };
  } catch {
    return { ok: true as const, summary: null };
  }
});
