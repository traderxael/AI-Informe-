import { useEffect, useMemo, useState } from "react";
import type { UseNavigateResult } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Globe2, Landmark, Search, X } from "lucide-react";
import {
  MODEL_BY_ID,
  SIGNALS,
  SOURCE_LABEL,
  WEEK_LABEL,
  blendedPerM,
  filterSignals,
  formatUsd,
  matchesQuery,
  modelsForRegion,
  type InformeSearch,
  type ModelId,
  type ModelInfo,
  type Signal,
} from "@/lib/informe-data";
import { loadLiveModels, loadLiveSignals, weekLabelFrom, type LiveModelRow } from "@/lib/live-feed";
import { cn } from "@/lib/utils";

type PriceSort = "blend" | "in" | "out" | "label";

export function WeekView({
  search,
  navigate,
}: {
  search: InformeSearch;
  navigate: UseNavigateResult<"/">;
}) {
  const { region, model, tab } = search;
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [priceSort, setPriceSort] = useState<PriceSort>("blend");
  const [priceDir, setPriceDir] = useState<"asc" | "desc">("asc");
  const [feed, setFeed] = useState<Signal[]>(SIGNALS);
  const [live, setLive] = useState(false);
  // El efecto de carga termina con setLoading(false) y el render lo consulta
  // (lineas 285/304), pero el estado no estaba declarado: con strict:true eso
  // es TS2304 "Cannot find name 'loading' / 'setLoading'" y rompia el build.
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(WEEK_LABEL);
  const [showAll, setShowAll] = useState(false);
  const [arena, setArena] = useState<LiveModelRow[] | null>(null);
  const [arenaAt, setArenaAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ signals, generatedAt, live: isLive }, models] = await Promise.all([
        loadLiveSignals(),
        loadLiveModels(),
      ]);
      if (cancelled) return;
      setFeed(signals);
      setLive(isLive);
      setWeek(weekLabelFrom(generatedAt));
      setLoading(false);
      if (models?.modelos?.length) {
        setArena(models.modelos);
        setArenaAt(models.actualizado ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelOptions = modelsForRegion(region);

  function patch(next: Partial<InformeSearch>) {
    void navigate({
      search: (prev) => {
        const merged = { ...prev, ...next };
        // `prev`/`next` son Partial, así que region/model pueden venir
        // undefined: TS2345 al pasarlos a modelsForRegion(). Se coalescen a
        // "all" antes de usar, que es el valor neutro de los filtros.
        const regionNext: InformeSearch["region"] = merged.region ?? "all";
        let modelNext: InformeSearch["model"] = merged.model ?? "all";
        if (regionNext !== "all" && modelNext !== "all") {
          const allowed = modelsForRegion(regionNext).some((m) => m.id === modelNext);
          if (!allowed) modelNext = "all";
        }
        return { region: regionNext, model: modelNext, tab: merged.tab };
      },
      replace: true,
    });
  }

  const pricedModels = useMemo(() => {
    const pool = model === "all" ? modelOptions : modelOptions.filter((m) => m.id === model);
    const dir = priceDir === "asc" ? 1 : -1;
    return [...pool].sort((a, b) => {
      if (priceSort === "label") return dir * a.label.localeCompare(b.label, "es");
      if (priceSort === "in") return dir * (a.inputPerM - b.inputPerM);
      if (priceSort === "out") return dir * (a.outputPerM - b.outputPerM);
      return dir * (blendedPerM(a) - blendedPerM(b));
    });
  }, [model, modelOptions, priceSort, priceDir]);

  const signals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filterSignals(feed, region, model).filter((s) => matchesQuery(s, q));
  }, [feed, region, model, query]);

  // Derive the visible open signal instead of synchronising state from an effect.
  // When a filter change removes the selected signal, none is rendered open.
  const visibleOpenId = useMemo(
    () => (openId && signals.some((s) => s.id === openId) ? openId : null),
    [openId, signals],
  );

  const filtered = region !== "all" || model !== "all" || query.trim().length > 0;
  const shown = useMemo(() => {
    if (filtered || showAll) return signals;
    return signals.slice(0, 24);
  }, [filtered, showAll, signals]);
  const cheapestId = pricedModels[0]?.id;
  const cheapestBlend = pricedModels[0] ? blendedPerM(pricedModels[0]) : 0;

  function toggleSort(col: PriceSort) {
    if (priceSort === col) setPriceDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setPriceSort(col);
      setPriceDir("asc");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
      <header className="relative mb-7 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-elevated via-surface to-bg px-5 py-7 shadow-2xl shadow-black/20 sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 right-8 size-72 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-subtle uppercase">
            <span className="size-2 rounded-full bg-accent shadow-[0_0_14px_rgba(131,229,190,0.7)]" />
            AI Informe <span className="text-border">/</span>
            {live ? "Señales del día" : "Informe semanal"}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-fg sm:text-6xl">
            El pulso de la inteligencia artificial
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Noticias, modelos y movimientos que importan, ordenados por región y por modelo.
            Una lectura clara del ecosistema global de IA.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span className="text-xs text-subtle">Corte del informe · {week}</span>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                live ? "border-accent/25 bg-accent/10 text-accent" : "border-border bg-bg/60 text-muted",
              )}
              role="status"
              aria-live="polite"
            >
              <span className={cn("size-1.5 rounded-full", live ? "bg-accent" : "bg-subtle")} />
              {live ? "Actualizado con señales en vivo" : "Edición de referencia"}
            </span>
          </div>
        </div>
      </header>

      <div className="mt-7 flex gap-2" role="tablist" aria-label="Vista">
        <Chip
          active={tab === "briefing"}
          onClick={() => patch({ tab: "briefing" })}
          testId="tab-briefing"
          role="tab"
          controls="panel-briefing"
        >
          Briefing
        </Chip>
        <Chip
          active={tab === "precios"}
          onClick={() => patch({ tab: "precios" })}
          testId="tab-precios"
          role="tab"
          controls="panel-precios"
        >
          Precios
        </Chip>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          value={tab === "precios" ? pricedModels.length : signals.length}
          label={tab === "precios" ? "Modelos" : "Señales"}
        />
        <Stat
          value={region === "china" ? "China" : region === "west" ? "Occidente" : "Global"}
          label="Región"
        />
        <Stat
          value={
            tab === "precios" && pricedModels.length
              ? `$${formatUsd(cheapestBlend)}`
              : model === "all"
                ? "Todos"
                : MODEL_BY_ID[model].label
          }
          label={tab === "precios" ? "Más barato" : "Modelo"}
        />
      </div>

      <section className="mt-7 space-y-5 rounded-3xl border border-border/80 bg-surface/65 p-4 shadow-lg shadow-black/10 sm:p-5"
        aria-label="Filtros">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-subtle uppercase">Región</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={region === "all"}
              onClick={() => patch({ region: "all" })}
              icon={<Globe2 className="size-3.5" />}
              testId="region-all"
            >
              Todo
            </Chip>
            <Chip
              active={region === "west"}
              onClick={() => patch({ region: "west" })}
              icon={<Landmark className="size-3.5" />}
              testId="region-west"
            >
              Occidente
            </Chip>
            <Chip
              active={region === "china"}
              onClick={() => patch({ region: "china" })}
              testId="region-china"
            >
              China
            </Chip>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-subtle uppercase">
            {region === "china"
              ? "Modelos chinos"
              : region === "west"
                ? "Modelos occidentales"
                : "Modelos"}
          </p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Chip
              active={model === "all"}
              onClick={() => patch({ model: "all" })}
              testId="model-all"
            >
              Todos
            </Chip>
            {modelOptions.map((m) => (
              <Chip
                key={m.id}
                active={model === m.id}
                onClick={() => patch({ model: model === m.id ? "all" : m.id })}
                testId={`model-${m.id}`}
              >
                {m.label}
                <span className="text-subtle"> · {m.lab}</span>
              </Chip>
            ))}
          </div>
        </div>

        {tab === "briefing" ? (
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <span className="sr-only">Buscar en el informe</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar señales, modelos o laboratorios"
              className="h-12 w-full rounded-xl border border-border bg-bg/70 pr-10 pl-10 text-sm text-fg placeholder:text-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
            />
            {query ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-subtle transition hover:bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
        ) : null}

        {filtered ? (
          <button
            type="button"
            className="mt-4 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/30 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            onClick={() => {
              setQuery("");
              patch({ region: "all", model: "all" });
            }}
          >
            Quitar filtros
          </button>
        ) : null}
      </section>

      {tab === "precios" ? (
        <>
          <PriceTable
            models={pricedModels}
            cheapestId={cheapestId}
            sort={priceSort}
            dir={priceDir}
            onSort={toggleSort}
          />
          {arena ? <ArenaTable rows={arena} updated={arenaAt} /> : null}
        </>
      ) : (
        <div id="panel-briefing" role="tabpanel" className="mt-8 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-subtle uppercase">Briefing · 01</p>
            <h2 className="mt-1 font-display text-2xl text-fg">Radar de señales</h2>
          </div>
          <p className="text-xs text-muted" role="status" aria-live="polite">
            {signals.length} {signals.length === 1 ? "señal" : "señales"}
            {filtered ? " con estos filtros" : " en esta edición"}
          </p>
        </div>
          {loading ? (
            <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              Cargando señales del día…
            </p>
          ) : signals.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              Nada coincide. Quita filtros o cambia de modelo.
            </p>
          ) : (
            shown.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                open={visibleOpenId === s.id}
                onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
                onModel={(id) => patch({ model: id, region: MODEL_BY_ID[id].region })}
              />
            ))
          )}
          {!loading && !filtered && !showAll && signals.length > shown.length ? (
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-border bg-surface text-sm font-medium text-muted transition hover:border-accent/30 hover:bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={() => setShowAll(true)}
            >
              Ver las {signals.length - shown.length} señales restantes
            </button>
          ) : null}
        </div>
      )}

      <footer className="mt-14 border-t border-border pt-6 text-xs text-subtle">
        AI Informe · {live ? "Señales RSS del día" : "Edición editorial"} · Precios API en USD / 1M
        tokens · Los filtros se guardan en la URL.
      </footer>
    </main>
  );
}

function PriceTable({
  models,
  cheapestId,
  sort,
  dir,
  onSort,
}: {
  models: ModelInfo[];
  cheapestId?: ModelId;
  sort: PriceSort;
  dir: "asc" | "desc";
  onSort: (col: PriceSort) => void;
}) {
  return (
    <section id="panel-precios" role="tabpanel" className="mt-8" aria-label="Precios">
      <p className="mb-3 text-sm text-muted">
        API en USD por millón de tokens. Blend 75/25 entrada/salida. Plan = suscripción de
        consumidor, no el API. Clic en una columna para ordenar.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border/80 shadow-lg shadow-black/10">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-elevated/80 text-[11px] font-semibold tracking-wider text-subtle uppercase">
            <tr>
              <SortTh active={sort === "label"} dir={dir} onClick={() => onSort("label")} align="left">
                Modelo
              </SortTh>
              <th className="px-3 py-3 font-medium">Flagship</th>
              <SortTh active={sort === "in"} dir={dir} onClick={() => onSort("in")}>
                In
              </SortTh>
              <SortTh active={sort === "out"} dir={dir} onClick={() => onSort("out")}>
                Out
              </SortTh>
              <SortTh active={sort === "blend"} dir={dir} onClick={() => onSort("blend")}>
                Blend
              </SortTh>
              <th className="px-4 py-3 font-medium">Plan</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const cheapest = m.id === cheapestId && sort === "blend" && dir === "asc";
              return (
                <tr
                  key={m.id}
                  className={cn("border-t border-border bg-surface", cheapest && "bg-elevated")}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">
                      {m.label}
                      {cheapest ? (
                        <span className="ml-2 text-xs font-medium tracking-wide text-subtle uppercase">
                          menor blend
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-subtle">
                      {m.lab} · {m.region === "china" ? "China" : "Occidente"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted">{m.flagship}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-fg">
                    ${formatUsd(m.inputPerM)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-fg">
                    ${formatUsd(m.outputPerM)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-accent">
                    ${formatUsd(blendedPerM(m))}
                  </td>
                  <td className="px-4 py-3 text-muted">{m.plan}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 space-y-2">
        {models.map((m) => (
          <li key={m.id} className="text-sm text-muted">
            <span className="text-fg">{m.label}.</span> {m.note}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ArenaTable({ rows, updated }: { rows: LiveModelRow[]; updated: string | null }) {
  const top = rows.slice(0, 12);
  return (
    <section className="mt-10" aria-label="Ranking LMArena">
      <h2 className="font-display text-lg text-fg">Elo en vivo</h2>
      <p className="mt-1 mb-3 text-sm text-muted">
        LMArena texto × OpenRouter. {updated ? `Corte ${updated.slice(0, 10)}.` : null} OpenAI no
        se marca como open-weight.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead className="bg-elevated text-xs tracking-wide text-subtle uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-3 py-3 text-right font-medium">Elo</th>
              <th className="px-3 py-3 font-medium">Licencia</th>
              <th className="px-3 py-3 text-right font-medium">In</th>
              <th className="px-3 py-3 text-right font-medium">Out</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.modelo} className="border-t border-border bg-surface">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-fg">{r.modelo}</div>
                  <div className="text-xs text-subtle">{r.org}</div>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-fg">{r.elo}</td>
                <td className="px-3 py-3 text-muted">
                  {r.licencia === "open" ? "abierto" : "cerrado"}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-muted">
                  {r.precio_in == null ? "—" : `$${formatUsd(r.precio_in)}`}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-muted">
                  {r.precio_out == null ? "—" : `$${formatUsd(r.precio_out)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortTh({
  children,
  active,
  dir,
  onClick,
  align = "right",
}: {
  children: React.ReactNode;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-3 font-medium", align === "left" ? "text-left" : "text-right")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase",
          active ? "text-fg" : "text-subtle hover:text-fg",
        )}
      >
        {children}
        {active ? <Icon className="size-3" /> : null}
      </button>
    </th>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface/75 px-4 py-4 text-left shadow-lg shadow-black/10">
      <div className="font-display text-2xl leading-none tabular-nums text-fg">{value}</div>
      <div className="mt-2 text-[10px] font-semibold tracking-[0.16em] text-subtle uppercase">{label}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  icon,
  testId,
  role,
  controls,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  testId?: string;
  role?: "tab";
  controls?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      role={role}
      aria-selected={role === "tab" ? active : undefined}
      aria-pressed={role === "tab" ? undefined : active}
      aria-controls={controls}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border/70 bg-surface/55 text-muted hover:border-accent/30 hover:bg-elevated hover:text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SignalCard({
  signal,
  open,
  onToggle,
  onModel,
}: {
  signal: Signal;
  open: boolean;
  onToggle: () => void;
  onModel: (id: ModelId) => void;
}) {
  const regionLabel = signal.region === "china" ? "China" : "Occidente";
  return (
    <article className="group overflow-hidden rounded-2xl border border-border/80 bg-surface/80 shadow-lg shadow-black/10 transition duration-200 hover:border-accent/20 hover:bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-elevated/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase",
                signal.region === "china" ? "border-china/20 bg-china/10 text-china" : "border-west/20 bg-west/10 text-west",
              )}
            >
              {regionLabel}
            </span>
            <span className="rounded-md border border-border bg-elevated/70 px-2 py-1 text-[10px] font-medium tracking-[0.1em] text-muted uppercase">
              {SOURCE_LABEL[signal.source]}
            </span>
          </div>
          <h2 className="font-display text-lg leading-snug text-fg transition-colors group-hover:text-white sm:text-xl">{signal.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{signal.summary}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-subtle transition-transform duration-200 ease-[var(--ease-out-smooth)]",
            open && "rotate-180",
          )}
        />
      </button>
      {signal.models.length ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4 sm:px-5">
          {signal.models.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onModel(id)}
              className="rounded-md border border-border/70 bg-elevated/60 px-2 py-1 text-[10px] font-medium tracking-wide text-muted transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {MODEL_BY_ID[id]?.label ?? id}
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="border-t border-border/80 bg-bg/35 px-4 pt-4 pb-5 sm:px-5">
          <p className="text-sm leading-relaxed text-muted">{signal.detail}</p>
          {signal.sourceUrl ? (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3.5 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Leer fuente
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
