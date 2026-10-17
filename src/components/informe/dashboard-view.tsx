import { ArrowRight, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
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

  const sortedByBlend = [...models].sort((a, b) => blendedPerM(a) - blendedPerM(b));
  const cheapest = sortedByBlend[0];
  const mostExpensive = sortedByBlend[sortedByBlend.length - 1];

  const cheapestWest = [...WEST_MODELS].sort((a, b) => blendedPerM(a) - blendedPerM(b))[0];
  const cheapestChina = [...CHINA_MODELS].sort((a, b) => blendedPerM(a) - blendedPerM(b))[0];

  const topArena = arena?.slice(0, 5) ?? [];
  const latestSignals = signals.slice(0, 4);

  return (
    <div id="panel-resumen" role="tabpanel" className="mt-8 space-y-8">
      {/* KPI Grid */}
      <section aria-label="Resumen general">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            value={loading ? "—" : String(signals.length)}
            label="Señales totales"
            sub={`${westSignals.length} occidente · ${chinaSignals.length} china`}
          />
          <KpiCard
            value={loading ? "—" : String(models.length)}
            label="Modelos activos"
            sub={`${WEST_MODELS.length} occidente · ${CHINA_MODELS.length} china`}
          />
          <KpiCard
            value={cheapest ? `$${formatUsd(blendedPerM(cheapest))}` : "—"}
            label="Más barato (blend)"
            sub={cheapest ? `${cheapest.label} · ${cheapest.lab}` : ""}
            icon={<TrendingDown className="size-4 text-china" />}
          />
          <KpiCard
            value={mostExpensive ? `$${formatUsd(blendedPerM(mostExpensive))}` : "—"}
            label="Más caro (blend)"
            sub={mostExpensive ? `${mostExpensive.label} · ${mostExpensive.lab}` : ""}
            icon={<TrendingUp className="size-4 text-west" />}
          />
        </div>
      </section>

      {/* Price comparison by region */}
      <section aria-label="Comparación por región">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-fg">Precio por región</h2>
          <button
            type="button"
            onClick={onGoPrecios}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            Ver tabla completa
            <ArrowRight className="size-3" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <RegionPriceCard
            title="Occidente"
            models={WEST_MODELS}
            cheapest={cheapestWest}
          />
          <RegionPriceCard
            title="China"
            models={CHINA_MODELS}
            cheapest={cheapestChina}
          />
        </div>
      </section>

      {/* Latest signals */}
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

function RegionPriceCard({
  title,
  models,
  cheapest,
}: {
  title: string;
  models: ModelInfo[];
  cheapest: ModelInfo;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4">
      <p className="mb-2 text-xs tracking-wide text-subtle uppercase">{title}</p>
      <div className="font-display text-xl text-fg">
        ${formatUsd(blendedPerM(cheapest))}
        <span className="ml-1 text-xs text-muted">/ 1M blend</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">{cheapest.label} · {cheapest.lab}</p>
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
