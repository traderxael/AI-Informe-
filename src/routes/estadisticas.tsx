import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Loader2 } from "lucide-react";
import { SIGNALS } from "@/lib/informe-data";
import {
  CATEGORIAS,
  CATEGORIA_META,
  enrichSignals,
  groupByCategory,
} from "@/lib/noticias-data";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/estadisticas")({
  head: () => ({
    meta: [
      { title: "EstadÃ­sticas â€” AI Informe" },
      {
        name: "description",
        content: "Totales y tendencias del informe: seÃ±ales por categorÃ­a, modelos por organizaciÃ³n, salud de fuentes.",
      },
    ],
  }),
  component: EstadisticasPage,
});

type ModelRow = { modelo: string; elo: number; org: string; rank: number; org_normalized?: string };
type Feed = { nombre: string; items: number; estado: string };
type FeedHealth = {
  total_feeds: number;
  ok: number;
  feeds: Feed[];
  ranking?: { estado?: string; detalles?: string };
};

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs text-muted" title={label}>
        {label}
      </span>
      <div className="h-5 flex-1 overflow-hidden rounded-full bg-bg/60">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-fg">{value}</span>
    </div>
  );
}

function EstadisticasPage() {
  const { t, lang } = useLang();
  const [modelos, setModelos] = useState<ModelRow[] | null>(null);
  const [conPrecio, setConPrecio] = useState<number | null>(null);
  const [feeds, setFeeds] = useState<FeedHealth | null>(null);
  const [informes, setInformes] = useState<{ days: number; total: number; latest: string | null } | null>(null);

  // SeÃ±ales por categorÃ­a (deterministas, del snapshot empaquetado)
  const porCategoria = useMemo(() => {
    const enriched = enrichSignals(SIGNALS);
    const groups = groupByCategory(enriched);
    const map = new Map<string, number>(groups.map((g) => [g.categoria, g.items.length]));
    const total = enriched.length;
    return {
      total,
      rows: CATEGORIAS.map((c) => ({ cat: c, count: map.get(c) ?? 0 })).sort(
        (a, b) => b.count - a.count,
      ),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/modelos.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/data/feed_health.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/data/informes.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, fh, inf]) => {
        if (cancelled) return;
        if (m?.modelos?.length) {
          setModelos(m.modelos as ModelRow[]);
          setConPrecio(typeof m.con_precio === "number" ? m.con_precio : null);
        }
        if (fh?.feeds) setFeeds(fh as FeedHealth);
        if (Array.isArray(inf) && inf.length) {
          setInformes({
            days: inf.length,
            total: inf.reduce((acc: number, x: { total?: number }) => acc + (x.total ?? 0), 0),
            latest: inf[inf.length - 1]?.fecha ?? null,
          });
        }
      })
      .catch(() => {
        // sin datos en vivo, la pÃ¡gina igual muestra las mÃ©tricas deterministas
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const orgs = useMemo(() => {
    if (!modelos) return [];
    const map = new Map<string, { count: number; eloSum: number }>();
    for (const m of modelos) {
      const key = m.org || "â€”";
      const e = map.get(key) ?? { count: 0, eloSum: 0 };
      e.count += 1;
      e.eloSum += m.elo;
      map.set(key, e);
    }
    return [...map.entries()]
      .map(([org, v]) => ({ org, count: v.count, avgElo: Math.round(v.eloSum / v.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [modelos]);

  const avgElo = useMemo(
    () => (modelos?.length ? Math.round(modelos.reduce((a, m) => a + m.elo, 0) / modelos.length) : null),
    [modelos],
  );
  const orgLeader = orgs[0]?.org;
  const maxCat = Math.max(...porCategoria.rows.map((r) => r.count), 1);
  const maxOrg = Math.max(...orgs.map((o) => o.count), 1);
  const feedsOkPct = feeds && feeds.total_feeds ? Math.round((feeds.ok / feeds.total_feeds) * 100) : null;
  const topFeeds = useMemo(
    () => (feeds ? [...feeds.feeds].sort((a, b) => b.items - a.items).slice(0, 5) : []),
    [feeds],
  );
  const maxFeed = Math.max(...topFeeds.map((f) => f.items), 1);

  const fmt = (n: number) => (lang === "en" ? n.toLocaleString("en-US") : n.toLocaleString("es-CL"));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-subtle uppercase">
          <BarChart3 className="size-4 text-accent" />
          AI Informe
        </p>
        <a href="/" className="text-xs text-subtle transition hover:text-fg">
          {t("common.back")}
        </a>
      </div>

      <h1 className="mt-4 max-w-2xl font-display text-3xl leading-[1.1] tracking-tight text-fg sm:text-5xl">
        {t("estadisticas.title")}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{t("estadisticas.sub")}</p>

      {/* Cifras destacadas */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { v: informes ? fmt(informes.total) : "â€”", l: t("estadisticas.feedsItems") },
          { v: informes ? String(informes.days) : "â€”", l: "dÃ­as" },
          { v: avgElo ?? "â€”", l: t("estadisticas.avgElo") },
          { v: feedsOkPct != null ? `${feedsOkPct}%` : "â€”", l: t("estadisticas.feedsOk") },
        ].map(({ v, l }) => (
          <div key={l} className="rounded-2xl border border-border/70 bg-surface/60 px-4 py-4 text-center">
            <p className="text-xl font-bold text-fg">{v}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-subtle">{l}</p>
          </div>
        ))}
      </div>
      {informes?.latest && (
        <p className="mt-2 text-right text-[10px] text-subtle">Ãºltimo corte: {informes.latest}</p>
      )}

      {/* SeÃ±ales por categorÃ­a */}
      <section className="mt-8 rounded-3xl border border-border/80 bg-surface/65 p-5">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] text-subtle uppercase">
          {t("estadisticas.signalsByCat")} Â· {porCategoria.total} total
        </h2>
        <div className="mt-4 space-y-2">
          {porCategoria.rows.map((r) => (
            <BarRow
              key={r.cat}
              label={CATEGORIA_META[r.cat].label}
              value={r.count}
              max={maxCat}
              color="#83e5be"
            />
          ))}
        </div>
      </section>

      {/* Modelos por organizaciÃ³n */}
      <section className="mt-6 rounded-3xl border border-border/80 bg-surface/65 p-5">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] text-subtle uppercase">
          {t("estadisticas.modelsOrg")}
        </h2>
        {!modelos ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-subtle">
            <Loader2 className="size-4 animate-spin" /> cargandoâ€¦
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-2">
              {orgs.map((o) => (
                <BarRow key={o.org} label={o.org} value={o.count} max={maxOrg} color="#7dd3fc" />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
              {conPrecio != null && (
                <span>{t("estadisticas.pricing")}: <strong className="text-fg">{conPrecio}/{modelos.length}</strong></span>
              )}
              {orgLeader && (
                <span>{t("estadisticas.orgaMax")}: <strong className="text-fg">{orgLeader}</strong></span>
              )}
            </div>
          </>
        )}
      </section>

      {/* Salud de fuentes */}
      <section className="mt-6 rounded-3xl border border-border/80 bg-surface/65 p-5">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] text-subtle uppercase">
          {t("estadisticas.feeds")}
        </h2>
        {!feeds ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-subtle">
            <Loader2 className="size-4 animate-spin" /> cargandoâ€¦
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted">
              <strong className="text-fg">{feeds.ok}/{feeds.total_feeds}</strong> {t("estadisticas.feedsOk")}
              {feeds.ranking?.estado ? <span className="text-subtle"> Â· ranking: {feeds.ranking.estado}</span> : null}
            </p>
            <div className="mt-4 space-y-2">
              {topFeeds.map((f) => (
                <BarRow key={f.nombre} label={f.nombre} value={f.items} max={maxFeed} color="#c4b5fd" />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

