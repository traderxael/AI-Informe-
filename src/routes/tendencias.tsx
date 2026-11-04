import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/tendencias")({
  head: () => ({
    meta: [
      { title: "Tendencias del ranking â€” AI Informe" },
      {
        name: "description",
        content: "EvoluciÃ³n del Elo LMArena de los principales modelos de IA, run a run.",
      },
    ],
  }),
  component: TendenciasPage,
});

type ModelRow = { modelo: string; elo: number; org: string; rank: number };
type HistoryPayload = {
  actualizado?: string;
  history?: Array<{ fecha: string; modelos: Record<string, number> }>;
};

const COLORS = [
  "#83e5be",
  "#7dd3fc",
  "#c4b5fd",
  "#fcd34d",
  "#fda4af",
  "#6ee7b7",
  "#fdba74",
  "#a5f3fc",
];

function TendenciasPage() {
  const { t } = useLang();
  const [rows, setRows] = useState<ModelRow[] | null>(null);
  const [history, setHistory] = useState<HistoryPayload["history"] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/modelos.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/data/modelos-history.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([modelos, hist]) => {
        if (cancelled) return;
        if (modelos?.modelos?.length) setRows(modelos.modelos as ModelRow[]);
        setHistory(hist?.history ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Los 8 mejores del ranking actual y sus curvas en el historial
  const top = useMemo(() => (rows ?? []).slice(0, 8), [rows]);
  const points = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [history]);

  const series = useMemo(
    () =>
      top.map((m) => ({
        modelo: m.modelo,
        color: COLORS[top.indexOf(m) % COLORS.length],
        values: points.map((p) => p.modelos[m.modelo] ?? null),
      })),
    [top, points],
  );

  const allValues = useMemo(
    () => series.flatMap((s) => s.values.filter((v): v is number => v != null)),
    [series],
  );
  const minE = allValues.length ? Math.min(...allValues) : 1400;
  const maxE = allValues.length ? Math.max(...allValues) : 1600;
  const pad = Math.max(15, Math.round((maxE - minE) * 0.15));
  const lo = minE - pad, hi = maxE + pad;

  // GeometrÃ­a del SVG
  const W = 720, H = 300, P = { l: 46, r: 12, t: 14, b: 30 };
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const xAt = (i: number) => P.l + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const yAt = (e: number) => P.t + (1 - (e - lo) / (hi - lo)) * innerH;

  const chartReady = series.length > 0 && points.length >= 2 && allValues.length > 0;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-subtle uppercase">
          <TrendingUp className="size-4 text-accent" />
          AI Informe
        </p>
        <a href="/" className="text-xs text-subtle transition hover:text-fg">
          {t("common.back")}
        </a>
      </div>

      <h1 className="mt-4 max-w-2xl font-display text-3xl leading-[1.1] tracking-tight text-fg sm:text-5xl">
        {t("tendencias.title")}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{t("tendencias.sub")}</p>

      {error && (
        <p className="mt-6 rounded-2xl border border-border bg-surface/60 p-4 text-sm text-muted">
          No se pudo cargar el ranking en vivo.
        </p>
      )}

      {!rows ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" /> cargandoâ€¦
        </p>
      ) : (
        <>
          {/* GrÃ¡fica */}
          <section className="mt-8 rounded-3xl border border-border/80 bg-surface/65 p-4 sm:p-6">
            {!chartReady && (
              <p className="mb-4 rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-accent">
                {t("tendencias.empty")}
              </p>
            )}
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("tendencias.chart.aria")} className="w-full">
              {/* rejilla */}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = P.t + f * innerH;
                const e = Math.round(hi - f * (hi - lo));
                return (
                  <g key={f}>
                    <line x1={P.l} x2={W - P.r} y1={y} y2={y} stroke="#ffffff14" strokeDasharray="3 4" />
                    <text x={P.l - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#ffffff66">{e}</text>
                  </g>
                );
              })}
              {/* fechas */}
              {points.map((p, i) =>
                i === 0 || i === points.length - 1 ? (
                  <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#ffffff55">
                    {p.fecha}
                  </text>
                ) : null,
              )}
              {/* lÃ­neas */}
              {series.map((s) => {
                const pts = s.values
                  .map((v, i) => (v == null ? null : `${xAt(i)},${yAt(v)}`))
                  .filter((v): v is string => v != null)
                  .join(" ");
                return pts ? (
                  <polyline key={s.modelo} points={pts} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                ) : null;
              })}
              {/* puntos */}
              {series.map((s) =>
                s.values.map((v, i) =>
                  v == null ? null : <circle key={s.modelo + i} cx={xAt(i)} cy={yAt(v)} r="3.4" fill={s.color} />,
                ),
              )}
            </svg>
            {/* Leyenda */}
            <div className="mt-4 flex flex-wrap gap-2">
              {series.map((s) => (
                <span key={s.modelo} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-bg/50 px-3 py-1 text-[11px] text-fg">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  {s.modelo}
                </span>
              ))}
            </div>
          </section>

          {/* Ranking actual */}
          <section className="mt-8">
            <h2 className="text-[11px] font-semibold tracking-[0.18em] text-subtle uppercase">{t("tendencias.top")}</h2>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {rows.slice(0, 15).map((m) => (
                <li key={m.modelo} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-bg/40 px-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <span className="w-6 text-right text-xs font-bold text-subtle">#{m.rank}</span>
                    <span>
                      <span className="block text-sm font-medium text-fg">{m.modelo}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-subtle">{m.org}</span>
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-accent">{m.elo}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}

