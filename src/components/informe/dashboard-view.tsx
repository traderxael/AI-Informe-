import { ArrowRight, ExternalLink, TrendingDown, TrendingUp, Activity, DollarSign, Zap } from "lucide-react";
import {
  MODEL_BY_ID,
  SOURCE_LABEL,
  ALL_MODELS,
  WEST_MODELS,
  CHINA_MODELS,
  blendedPerM,
  formatUsd,
  type ModelInfo,
  type Signal,
  type SourceKind,
} from "@/lib/informe-data";
import type { LiveModelRow } from "@/lib/live-feed";
import { cn } from "@/lib/utils";

type Props = {
  signals: Signal[];
  models: ModelInfo[];
  arena: LiveModelRow[] | null;
  arenaAt: string | null;
  loading: boolean;
  week: string;
  live: boolean;
  onGoBriefing: () => void;
  onGoPrecios: () => void;
};

export function DashboardView({
  signals,
  models,
  arena,
  arenaAt,
  loading,
  week,
  live,
  onGoBriefing,
  onGoPrecios,
}: Props) {
  const westSignals = signals.filter((s) => s.region === "west");
  const chinaSignals = signals.filter((s) => s.region === "china");

  const sortedByBlend = [...ALL_MODELS].sort((a, b) => blendedPerM(a) - blendedPerM(b));
  const cheapest = sortedByBlend[0];
  const mostExpensive = sortedByBlend[sortedByBlend.length - 1];
  const avgBlend = ALL_MODELS.reduce((sum, m) => sum + blendedPerM(m), 0) / ALL_MODELS.length;
  const priceSpread = blendedPerM(mostExpensive) - blendedPerM(cheapest);

  const cheapestWest = [...WEST_MODELS].sort((a, b) => blendedPerM(a) - blendedPerM(b))[0];
  const cheapestChina = [...CHINA_MODELS].sort((a, b) => blendedPerM(a) - blendedPerM(b))[0];
  const avgWest = WEST_MODELS.reduce((s, m) => s + blendedPerM(m), 0) / WEST_MODELS.length;
  const avgChina = CHINA_MODELS.reduce((s, m) => s + blendedPerM(m), 0) / CHINA_MODELS.length;

  const topArena = arena?.slice(0, 5) ?? [];
  const latestSignals = signals.slice(0, 5);

  // Signals by source
  const bySource = Object.entries(
    signals.reduce(
      (acc, s) => {
        acc[s.source] = (acc[s.source] ?? 0) + 1;
        return acc;
      },
      {} as Record<SourceKind, number>,
    ),
  ).sort((a, b) => b[1] - a[1]);

  const maxBlend = blendedPerM(mostExpensive);

  return (
    <div id="panel-resumen" role="tabpanel" className="mt-8 space-y-8">
      {/* KPI Grid */}
      <section aria-label="Indicadores clave">
        <h2 className="mb-3 font-display text-lg text-fg">Indicadores clave</h2>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            value={loading ? "—" : String(signals.length)}
            label="Señales totales"
            sub={`${westSignals.length} occ. · ${chinaSignals.length} china`}
            icon={<Activity className="size-4 text-accent" />}
          />
          <KpiCard
            value={loading ? "—" : String(ALL_MODELS.length)}
            label="Modelos activos"
            sub={`${WEST_MODELS.length} occ. · ${CHINA_MODELS.length} china`}
            icon={<Zap className="size-4 text-accent" />}
          />
          <KpiCard
            value={`$${formatUsd(avgBlend)}`}
            label="Precio promedio"
            sub="blend 75/25 · 1M tokens"
            icon={<DollarSign className="size-4 text-muted" />}
          />
          <KpiCard
            value={`$${formatUsd(priceSpread)}`}
            label="Brecha de precio"
            sub="más caro − más barato"
            icon={<TrendingUp className="size-4 text-west" />}
          />
        </div>
      </section>

      {/* Extremes: cheapest vs most expensive */}
      <section aria-label="Extremos de precio">
        <div className="grid grid-cols-2 gap-3">
          <ExtremeCard
            title="Más barato"
            model={cheapest}
            accent="text-china"
            icon={<TrendingDown className="size-4 text-china" />}
          />
          <ExtremeCard
            title="Más caro"
            model={mostExpensive}
            accent="text-west"
            icon={<TrendingUp className="size-4 text-west" />}
          />
        </div>
      </section>

      {/* Price bar chart — all models */}
      <section aria-label="Comparativa de precios">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-fg">Precio blend por modelo</h2>
          <button
            type="button"
            onClick={onGoPrecios}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            Ver tabla completa
            <ArrowRight className="size-3" />
          </button>
        </div>
        <div className="mt-4 space-y-2.5">
          {sortedByBlend.map((m) => {
            const pct = Math.max(4, (blendedPerM(m) / maxBlend) * 100);
            const isChina = m.region === "china";
            return (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-20 shrink-0 text-right">
                  <span className="text-xs font-medium text-fg">{m.label}</span>
                  <p className="text-[10px] text-subtle">{m.lab}</p>
                </div>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-elevated">
                  <div
                    className={cn(
                      "flex h-full items-center justify-end rounded-md px-2 text-[10px] font-mono font-medium text-white transition-all",
                      isChina ? "bg-china" : "bg-west",
                    )}
                    style={{ width: `${pct}%` }}
                  >
                    ${formatUsd(blendedPerM(m))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Region comparison */}
      <section aria-label="Comparación por región">
        <h2 className="mb-3 font-display text-lg text-fg">Por región</h2>
        <div className="grid grid-cols-2 gap-3">
          <RegionPriceCard
            title="Occidente"
            models={WEST_MODELS}
            cheapest={cheapestWest}
            avg={avgWest}
            accent="text-west"
          />
          <RegionPriceCard
            title="China"
            models={CHINA_MODELS}
            cheapest={cheapestChina}
            avg={avgChina}
            accent="text-china"
          />
        </div>
      </section>

      {/* Signals by source + latest signals */}
      <section aria-label="Últimas señales">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-fg">Últimas señales</h2>
          <button
            type="button"
            onClick={onGoBriefing}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            Ver todas
            <ArrowRight className="size-3" />
          </button>
        </div>
        {bySource.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bySource.map(([src, count]) => (
              <span
                key={src}
                className="rounded-full bg-elevated px-2.5 py-1 text-xs text-muted"
              >
                {SOURCE_LABEL[src as SourceKind]} · {count}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border border-border bg-surface"
                />
              ))}
            </div>
          ) : latestSignals.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              No hay señales disponibles.
            </p>
          ) : (
            latestSignals.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={onGoBriefing}
                className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent/40"
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tracking-wide uppercase",
                    s.region === "china" ? "bg-elevated text-china" : "bg-elevated text-west",
                  )}
                >
                  {s.region === "china" ? "China" : "Occ."}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{s.title}</p>
                  <p className="truncate text-xs text-muted">{s.summary}</p>
                </div>
                {s.sourceUrl ? <ExternalLink className="mt-1 size-3.5 shrink-0 text-subtle" /> : null}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Arena top 5 */}
      {topArena.length > 0 ? (
        <section aria-label="Top modelos LMArena">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-fg">Top 5 LMArena</h2>
            {arenaAt ? (
              <span className="text-xs text-subtle">Corte {arenaAt.slice(0, 10)}</span>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {topArena.map((r, i) => (
              <div
                key={r.modelo}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    i === 0
                      ? "bg-accent text-accent-fg"
                      : i === 1
                        ? "bg-elevated text-fg"
                        : "bg-elevated text-subtle",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-fg">{r.modelo}</p>
                  <p className="truncate text-xs text-subtle">{r.org}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm tabular-nums text-fg">{r.elo}</span>
                  <span className="ml-1.5 text-xs text-subtle">Elo</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Update info */}
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center">
        <p className="text-xs text-subtle">
          {live ? "Señales RSS del día" : "Edición editorial"} · Actualizado {week}
        </p>
      </div>
    </div>
  );
}

function KpiCard({
  value,
  label,
  sub,
  icon,
}: {
  value: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-wide text-subtle uppercase">{label}</span>
        {icon}
      </div>
      <div className="mt-1 font-display text-2xl tabular-nums text-fg">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

function ExtremeCard({
  title,
  model,
  accent,
  icon,
}: {
  title: string;
  model: ModelInfo;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-wide text-subtle uppercase">{title}</span>
        {icon}
      </div>
      <div className={cn("mt-1 font-display text-xl tabular-nums", accent)}>
        ${formatUsd(blendedPerM(model))}
      </div>
      <p className="mt-0.5 text-xs text-muted">{model.label} · {model.lab}</p>
      <p className="mt-1 text-xs text-subtle">{model.flagship}</p>
    </div>
  );
}

function RegionPriceCard({
  title,
  models,
  cheapest,
  avg,
  accent,
}: {
  title: string;
  models: ModelInfo[];
  cheapest: ModelInfo;
  avg: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4">
      <p className="mb-2 text-xs tracking-wide text-subtle uppercase">{title}</p>
      <div className={cn("font-display text-xl tabular-nums", accent)}>
        ${formatUsd(blendedPerM(cheapest))}
        <span className="ml-1 text-xs text-muted">/ 1M blend</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">{cheapest.label} · {cheapest.lab}</p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-subtle">Promedio</span>
        <span className="font-mono tabular-nums text-fg">${formatUsd(avg)}</span>
      </div>
      <div className="mt-3 space-y-1">
        {models.slice(0, 4).map((m) => (
          <div key={m.id} className="flex items-center justify-between text-xs">
            <span className="text-muted">{m.label}</span>
            <span className="font-mono tabular-nums text-fg">${formatUsd(blendedPerM(m))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
