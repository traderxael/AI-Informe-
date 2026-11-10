import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Loader2 } from "lucide-react";

export const Route = createFileRoute("/analitica")({
  head: () => ({
    meta: [
      { title: "Analítica — AI Informe" },
      {
        name: "description",
        content:
          "Analítica first-party de AI Informe: visitas, páginas y referentes. Sin cookies y sin terceros.",
      },
    ],
  }),
  component: AnaliticaPage,
});

type Summary = {
  total: number;
  days: Record<string, number>;
  paths: Record<string, number>;
  refs: Record<string, number>;
  updated: string;
};

type StatsResponse = {
  ok: boolean;
  reason?: string;
  summary: Summary | null;
};

function toRows(map: Record<string, number>, limit = 8) {
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-xs text-muted" title={label}>
        {label}
      </span>
      <div className="h-5 flex-1 overflow-hidden rounded-full bg-bg/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-semibold text-fg">{value}</span>
    </div>
  );
}

function AnaliticaPage() {
  const [data, setData] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: StatsResponse | null) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = data?.summary ?? null;
  const maxPath = useMemo(
    () => Math.max(...toRows(summary?.paths ?? {}).map((r) => r.count), 1),
    [summary],
  );
  const maxRef = useMemo(
    () => Math.max(...toRows(summary?.refs ?? {}).map((r) => r.count), 1),
    [summary],
  );
  const last14 = useMemo(() => {
    const days = summary?.days ?? {};
    const out: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, count: days[key] ?? 0 });
    }
    return out;
  }, [summary]);
  const maxDay = Math.max(...last14.map((d) => d.count), 1);
  const today = new Date().toISOString().slice(0, 10);
  const pathTotal = useMemo(
    () => Object.values(summary?.paths ?? {}).reduce((a, b) => a + b, 0),
    [summary],
  );
  const refTotal = useMemo(
    () => Object.values(summary?.refs ?? {}).reduce((a, b) => a + b, 0),
    [summary],
  );

  const fmt = (n: number) => n.toLocaleString("es-CL");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-subtle uppercase">
          <BarChart3 className="size-4 text-accent" />
          AI Informe
        </p>
        <a href="/" className="text-xs text-subtle transition hover:text-fg">
          Volver
        </a>
      </div>

      <h1 className="mt-4 max-w-2xl font-display text-3xl leading-[1.1] tracking-tight text-fg sm:text-5xl">
        Analítica del sitio
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        First-party, sin cookies y sin terceros. Se registra la página, el referente y el día — nunca
        datos personales.
      </p>

      {!data ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" /> cargando…
        </p>
      ) : data.reason === "no_token" ? (
        <p className="mt-8 rounded-2xl border border-border/70 bg-surface/60 p-4 text-sm text-muted">
          La analítica está construida pero aún sin conectar: falta el{" "}
          <code className="text-fg">BLOB_READ_WRITE_TOKEN</code> del proyecto.
        </p>
      ) : !summary || summary.total === 0 ? (
        <p className="mt-8 rounded-2xl border border-border/70 bg-surface/60 p-4 text-sm text-muted">
          Aún no hay visitas registradas. El beacon ya está activo: apenas llegue la primera, acá se
          ve.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { v: fmt(summary.total), l: "visitas totales" },
              { v: fmt(summary.days[today] ?? 0), l: "hoy" },
              { v: fmt(pathTotal), l: "páginas vistas" },
              { v: fmt(refTotal), l: "desde referentes" },
            ].map(({ v, l }) => (
              <div
                key={l}
                className="rounded-2xl border border-border/70 bg-surface/60 px-4 py-4 text-center"
              >
                <p className="text-xl font-bold text-fg">{v}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-subtle">{l}</p>
              </div>
            ))}
          </div>
          {summary.updated && (
            <p className="mt-2 text-right text-[10px] text-subtle">
              Último registro: {new Date(summary.updated).toLocaleString("es-CL")}
            </p>
          )}

          <section className="mt-8 rounded-3xl border border-border/80 bg-surface/65 p-5">
            <h2 className="text-[11px] font-semibold tracking-[0.18em] text-subtle uppercase">
              Últimos 14 días
            </h2>
            <div className="mt-4 space-y-2">
              {last14.map((d) => (
                <BarRow key={d.day} label={d.day.slice(5)} value={d.count} max={maxDay} />
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-border/80 bg-surface/65 p-5">
            <h2 className="text-[11px] font-semibold tracking-[0.18em] text-subtle uppercase">
              Páginas más vistas
            </h2>
            <div className="mt-4 space-y-2">
              {toRows(summary.paths).map((r) => (
                <BarRow key={r.name} label={r.name} value={r.count} max={maxPath} />
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-border/80 bg-surface/65 p-5">
            <h2 className="text-[11px] font-semibold tracking-[0.18em] text-subtle uppercase">
              Referentes
            </h2>
            {toRows(summary.refs).length === 0 ? (
              <p className="mt-4 text-sm text-muted">Sin referentes todavía.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {toRows(summary.refs).map((r) => (
                  <BarRow key={r.name} label={r.name} value={r.count} max={maxRef} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
