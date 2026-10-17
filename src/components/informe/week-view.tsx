import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseNavigateResult } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ExternalLink, Globe2, Landmark, Search, X } from "lucide-react";
import {
  MODEL_BY_ID,
  SIGNALS,
  SOURCE_LABEL,
  WEEK_LABEL,
  blendedPerM,
  filterSignals,
  formatUsd,
  matchRanges,
  matchesQuery,
  modelsForRegion,
  queryTokens,
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
  const { region, model, tab, q: query = "" } = search;
  const [openId, setOpenId] = useState<string | null>(null);
  const [priceSort, setPriceSort] = useState<PriceSort>("blend");
  const [priceDir, setPriceDir] = useState<"asc" | "desc">("asc");
  const [feed, setFeed] = useState<Signal[]>(SIGNALS);
  const [live, setLive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // El efecto de carga termina con setLoading(false) y el render lo consulta
  // (lineas 285/304), pero el estado no estaba declarado: con strict:true eso
  // es TS2304 "Cannot find name 'loading' / 'setLoading'" y rompia el build.
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(WEEK_LABEL);
  const [showAll, setShowAll] = useState(false);
  const [arena, setArena] = useState<LiveModelRow[] | null>(null);
  const [arenaAt, setArenaAt] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);

  const onScroll = useCallback(() => {
    setShowTop(window.scrollY > 600);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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

  // Atajo "/": enfoca la búsqueda desde cualquier parte, salvo que ya se esté
  // escribiendo en un campo de texto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        return { region: regionNext, model: modelNext, tab: merged.tab, q: merged.q || undefined };
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

  const tokens = useMemo(() => queryTokens(query), [query]);
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
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <p className="mb-3 text-xs font-medium tracking-widest text-subtle uppercase">
        {live ? "Señales del día" : "Informe semanal"}
      </p>
      <h1 className="font-display text-3xl leading-tight tracking-tight text-fg sm:text-4xl">
        Inteligencia artificial, por región y por modelo
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
        Occidente: Claude, GPT, Grok, Gemini. China: GLM, Qwen, Kimi, DeepSeek, MiniMax.
        Actualizado {week}.
      </p>

      <div
        className="sticky top-0 z-20 -mx-4 mt-6 flex items-center gap-2 border-border bg-bg/80 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-4"
        role="tablist"
        aria-label="Vista"
      >
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

      <div className="mt-6 grid grid-cols-3 gap-2">
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

      <section className="mt-8 space-y-4" aria-label="Filtros">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Región</p>
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
          <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">
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
          <div className="relative">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" />
              <span className="sr-only">Buscar en el informe</span>
              <input
                ref={searchRef}
                data-testid="search-input"
                value={query}
                onChange={(e) => patch({ q: e.target.value.slice(0, 140) })}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  if (query) patch({ q: "" });
                  else e.currentTarget.blur();
                }}
                placeholder="Buscar en títulos, labs y notas"
                className="h-12 w-full rounded-full border border-border bg-elevated pr-16 pl-11 text-sm text-fg shadow-lg shadow-black/20 placeholder:text-subtle outline-none transition-[border-color,background-color,box-shadow] duration-200 focus:border-accent/50 focus:bg-elevated focus:ring-4 focus:ring-accent/15"
              />
              {query ? (
                <button
                  type="button"
                  data-testid="search-clear"
                  className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-border text-subtle hover:bg-border hover:text-fg"
                  onClick={() => {
                    patch({ q: "" });
                    searchRef.current?.focus();
                  }}
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[10px] leading-none text-subtle sm:block">
                  /
                </kbd>
              )}
            </label>
          </div>
        ) : null}

        {filtered ? (
          <button
            type="button"
            className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
            onClick={() => {
              patch({ q: "", region: "all", model: "all" });
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
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-surface px-4 py-4 sm:px-5">
                  <div className="mb-2 flex gap-1.5">
                    <div className="h-4 w-16 animate-pulse rounded-md bg-elevated" />
                    <div className="h-4 w-20 animate-pulse rounded-md bg-elevated" />
                  </div>
                  <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-elevated" />
                  <div className="h-4 w-full animate-pulse rounded bg-elevated" />
                  <div className="mt-1 h-4 w-2/3 animate-pulse rounded bg-elevated" />
                </div>
              ))}
            </div>
          ) : signals.length === 0 ? (
            <div
              className="rounded-xl border border-border bg-surface px-4 py-10 text-center"
              data-testid="empty-state"
            >
              <p className="text-sm text-muted">
                {query.trim()
                  ? `Nada coincide con «${query.trim()}».`
                  : "Nada coincide. Quita filtros o cambia de modelo."}
              </p>
              {query.trim() ? (
                <button
                  type="button"
                  className="mt-3 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
                  onClick={() => patch({ q: "" })}
                >
                  Limpiar búsqueda
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {query.trim() ? (
                <p
                  className="text-xs tracking-wide text-subtle"
                  data-testid="search-count"
                  role="status"
                >
                  {signals.length} coincidencia{signals.length === 1 ? "" : "s"} para «
                  {query.trim()}»
                </p>
              ) : null}
              {shown.map((s) => (
                <SignalCard
                  key={s.id}
                  signal={s}
                  open={visibleOpenId === s.id}
                  tokens={tokens}
                  onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
                  onModel={(id) => patch({ model: id, region: MODEL_BY_ID[id].region })}
                />
              ))}
            </>
          )}
          {!loading && !filtered && !showAll && signals.length > shown.length ? (
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted hover:text-fg"
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

      {showTop ? (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Volver arriba"
          className="fixed bottom-6 right-6 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-lg transition-all duration-200 hover:bg-elevated hover:text-accent"
        >
          <ChevronUp className="size-5" />
        </button>
      ) : null}
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
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-elevated text-xs tracking-wide text-subtle uppercase">
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
    <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center">
      <div className="font-display text-lg tabular-nums text-fg">{value}</div>
      <div className="text-xs tracking-wide text-subtle uppercase">{label}</div>
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
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150",
        active
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface text-muted hover:border-accent hover:text-fg",
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
  tokens,
}: {
  signal: Signal;
  open: boolean;
  onToggle: () => void;
  onModel: (id: ModelId) => void;
  tokens: string[];
}) {
  const regionLabel = signal.region === "china" ? "China" : "Occidente";
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-xs font-medium tracking-wide uppercase",
                signal.region === "china" ? "bg-elevated text-china" : "bg-elevated text-west",
              )}
            >
              {regionLabel}
            </span>
            <span className="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium tracking-wide text-subtle uppercase">
              {SOURCE_LABEL[signal.source]}
            </span>
          </div>
          <h2 className="font-display text-lg leading-snug text-fg">
            <Highlight text={signal.title} tokens={tokens} />
          </h2>
          <p className="mt-1 text-sm text-muted">
            <Highlight text={signal.summary} tokens={tokens} />
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-subtle transition-transform duration-200 ease-[var(--ease-out-smooth)]",
            open && "rotate-180",
          )}
        />
      </button>
      {signal.models.length ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-5">
          {signal.models.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onModel(id)}
              className="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium tracking-wide text-fg uppercase hover:bg-border"
            >
              {MODEL_BY_ID[id]?.label ?? id}
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="border-t border-border px-4 pt-3 pb-4 sm:px-5">
          <p className="text-sm leading-relaxed text-muted">{signal.detail}</p>
          {signal.sourceUrl ? (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-fg underline-offset-2 hover:underline"
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

/** Resalta los tokens del query sobre el texto, sin romper acentos ni mayúsculas. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const ranges = useMemo(() => matchRanges(text, tokens), [text, tokens]);
  if (!ranges.length) return <>{text}</>;
  // Fusiona rangos que se solapan (un token puede pisar a otro).
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark
        key={`${start}-${end}`}
        className="rounded-[3px] bg-accent/25 px-0.5 text-fg box-decoration-clone"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
