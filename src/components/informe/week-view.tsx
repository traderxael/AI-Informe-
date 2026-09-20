import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, ChevronDown, ExternalLink, Globe2, Landmark, Search } from "lucide-react";
import {
  COUNTRY_META,
  REGION_LABEL,
  SOURCE_LABEL,
  TOP_MODELS,
  filterSignals,
  loadRestSignals,
  loadSignals,
  modelMeta,
  type Region,
  type Signal,
} from "@/lib/informe-data";
import { cn } from "@/lib/utils";

type RegionFilter = Region | "all";

const REGION_CHIPS: { id: RegionFilter; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "west", label: "Occidente" },
  { id: "china", label: "China" },
  { id: "global", label: "Global" },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function relativeDate(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  return new Date(iso).toLocaleDateString("es-CL", { month: "short", day: "numeric" });
}

function dayKey(iso?: string): string {
  if (!iso) return "sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin fecha";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" });
}

function groupByDay(signals: Signal[]): [string, Signal[]][] {
  const groups = new Map<string, Signal[]>();
  for (const s of signals) {
    const k = dayKey(s.published);
    const list = groups.get(k);
    if (list) list.push(s);
    else groups.set(k, [s]);
  }
  return [...groups.entries()];
}

// --- Filtros en la URL como store externo (useSyncExternalStore) ---
type UrlFilterState = {
  region: RegionFilter | null;
  model: string | null;
  country: string | null;
  query: string;
  openFilters: boolean;
};

const neutralUrlState: UrlFilterState = {
  region: null,
  model: null,
  country: null,
  query: "",
  openFilters: false,
};

// getSnapshot debe ser ESTABLE: mismo objeto entre llamadas si la URL no
// cambió (React lo compara con Object.is). Un objeto nuevo por llamada =
// loop infinito de re-renders.
let cachedSearch: string | null = null;
let cachedUrl: UrlFilterState = neutralUrlState;

function parseUrlState(search: string): UrlFilterState {
  const p = new URLSearchParams(search);
  const r = p.get("region");
  const m = p.get("model");
  const c = p.get("country");
  const q = p.get("q");
  return {
    region: r && ["west", "china", "global"].includes(r) ? (r as RegionFilter) : null,
    model: m,
    country: c,
    query: q ?? "",
    openFilters: Boolean(m || c || q),
  };
}

function readUrlState(): UrlFilterState {
  if (typeof window === "undefined") return neutralUrlState;
  const search = window.location.search;
  if (search !== cachedSearch) {
    cachedSearch = search;
    cachedUrl = parseUrlState(search);
  }
  return cachedUrl;
}

function subscribeToLocation(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function WeekView() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  // Filtros en la URL vía useSyncExternalStore (idiomático React 19 para
  // estado del navegador): el server snapshot es neutro y el cliente hidrata
  // con los params reales — sin mismatch ni setState en effects.
  const urlState = useSyncExternalStore(subscribeToLocation, readUrlState, () => neutralUrlState);
  // Los filtros activos combinan la URL (fuente de verdad compartible) con
  // la interacción local: los handlers escriben en ambos.
  const [regionOverride, setRegionOverride] = useState<RegionFilter | null>(null);
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const [countryOverride, setCountryOverride] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const region = regionOverride ?? urlState.region ?? "all";
  const model = modelOverride ?? urlState.model ?? "all";
  const country = countryOverride ?? urlState.country ?? "all";
  const queryFromUrl = urlState.query;
  const searchQuery = query || queryFromUrl;

  // Carga progresiva: 20 señales al instante, el resto en segundo plano.
  useEffect(() => {
    let alive = true;
    loadSignals().then((bundle) => {
      if (!alive) return;
      setSignals(bundle.signals);
      setGeneratedAt(bundle.generatedAt ?? null);
      loadRestSignals().then((rest) => {
        if (!alive || rest.length === 0) return;
        setSignals((cur) => {
          const seen = new Set(cur.map((s) => s.id));
          return [...cur, ...rest.filter((s) => !seen.has(s.id))];
        });
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  // Filtros → URL (salida). No corre en el mount (borraría el param antes
  // de que useSyncExternalStore lo lea) ni cuando la URL ya refleja el estado.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const p = new URLSearchParams();
    if (region !== "all") p.set("region", region);
    if (model !== "all") p.set("model", model);
    if (country !== "all") p.set("country", country);
    if (searchQuery.trim()) p.set("q", searchQuery.trim());
    const qs = p.toString();
    const next = qs ? `?${qs}` : window.location.pathname;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
      // readUrlState cachea por search string: invalidar para que el
      // siguiente snapshot refleje la URL que acabo de escribir.
      cachedSearch = null;
    }
  }, [region, model, country, searchQuery]);

  // Atajo "/" enfoca la búsqueda (como GitHub).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Botón "volver arriba" tras hacer scroll. El estado inicial se lee en
  // el primer render vía lazy init del listener (sin setState sincrónico).
  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    // El primer valor real llega con el primer evento de scroll; rAF difiere
    // la lectura inicial fuera del render síncrono del effect.
    requestAnimationFrame(onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // modelos y países presentes en los datos (para chips dinámicos)
  const presentModels = useMemo(() => {
    const set = new Set<string>();
    for (const s of signals) for (const m of s.models) set.add(m);
    return [...set].map((id) => ({ id, ...modelMeta(id) })).filter((m) => m.label);
  }, [signals]);

  const presentCountries = useMemo(() => {
    const set = new Set<string>();
    for (const s of signals) if (s.country) set.add(s.country);
    return [...set].sort();
  }, [signals]);

  const modelOptions = useMemo(() => {
    // Primero los 7 modelos protagonistas (en orden curado), luego el resto.
    const inRegion = region === "all" ? presentModels : presentModels.filter((m) => m.region === region);
    const rank = new Map(TOP_MODELS.map((t, i) => [t.id, i]));
    return [...inRegion].sort(
      (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
    );
  }, [presentModels, region]);

  const filtered = useMemo(() => {
    const base = filterSignals(signals, region, model, country);
    const q = normalizeText(searchQuery.trim());
    if (!q) return base;
    return base.filter(
      (s) =>
        normalizeText(s.title).includes(q) ||
        normalizeText(s.summary || "").includes(q) ||
        s.models.some((m) => normalizeText(m).includes(q)) ||
        (s.country ? normalizeText(s.country).includes(q) : false),
    );
  }, [signals, region, model, country, searchQuery]);

  // Nota: no hay effect que resetee filtros inválidos al cambiar los datos —
  // pickRegion ya valida modelo↔región al interactuar, y un filtro sin
  // resultados cae en el empty state con botón "Limpiar filtros".
  // (react-hooks v7: setState sincrónico dentro de effect = cascading renders.)

  function pickRegion(next: RegionFilter) {
    setRegionOverride(next === (urlState.region ?? "all") ? null : next);
    if (next !== "all" && model !== "all") {
      const allowed = presentModels.filter((m) => m.region === next).map((m) => m.id);
      if (!allowed.includes(model)) setModelOverride(null);
    }
  }

  const activeFilterCount =
    (region !== "all" ? 1 : 0) + (model !== "all" ? 1 : 0) + (country !== "all" ? 1 : 0);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <header className="border-b border-border pb-6">
        <p className="mb-3 text-xs font-medium tracking-[0.18em] text-subtle uppercase">
          Informe semanal
        </p>
        <h1 className="font-display text-[2rem] leading-tight tracking-tight text-fg sm:text-4xl">
          Inteligencia artificial, por país y por modelo
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>Señales reales con fuente enlazable — Occidente, China y el resto del mundo.</span>
          {generatedAt && (
            <span className="inline-flex items-center gap-1.5 text-subtle">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400" aria-hidden />
              Actualizado {relativeDate(generatedAt)}
            </span>
          )}
        </p>
      </header>

      <div className="mt-6 flex items-baseline gap-6">
        <div>
          <span className="font-display text-3xl tabular-nums text-fg sm:text-4xl">
            {signals.length}
          </span>
          <span className="ml-1.5 text-sm text-subtle">señales</span>
        </div>
        <div>
          <span className="font-display text-3xl tabular-nums text-fg sm:text-4xl">
            {presentCountries.length}
          </span>
          <span className="ml-1.5 text-sm text-subtle">países</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {(["west", "china", "global"] as Region[]).map((r) => {
            const count = signals.filter((s) => s.region === r).length;
            return (
              <div key={r} className="flex items-center gap-1.5 text-xs text-subtle">
                <span className={cn(
                  "inline-block size-2 rounded-full",
                  r === "west" && "bg-west",
                  r === "china" && "bg-china",
                  r === "global" && "bg-accent",
                )} />
                <span>{REGION_LABEL[r]}</span>
                <span className="tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
        <div className="ml-auto text-xs text-subtle">
          {filtered.length !== signals.length && (
            <span>
              {filtered.length} de {signals.length} con filtros
            </span>
          )}
        </div>
      </div>

      <section className="mt-6 space-y-3" aria-label="Filtros">
        <div className="flex flex-wrap items-center gap-2">
          {REGION_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={region === c.id}
              onClick={() => pickRegion(c.id)}
              icon={
                c.id === "all" ? (
                  <Globe2 className="size-3.5" />
                ) : c.id === "west" ? (
                  <Landmark className="size-3.5" />
                ) : undefined
              }
              testId={`region-${c.id}`}
            >
              {c.label}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => setMoreFilters((v) => !v)}
            aria-expanded={moreFilters}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-sm text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
          >
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">
                {activeFilterCount}
              </span>
            )}
            {moreFilters ? "Menos filtros" : "Más filtros"}
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", moreFilters && "rotate-180")}
            />
          </button>
        </div>

        {moreFilters && (
          <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
            {modelOptions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Modelos</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={model === "all"} onClick={() => setModelOverride(null)} testId="model-all">
                    Todos
                  </Chip>
                  {modelOptions.map((m) => {
                    const top = TOP_MODELS.find((t) => t.id === m.id);
                    return (
                      <Chip
                        key={m.id}
                        active={model === m.id}
                        onClick={() => setModelOverride(m.id)}
                        testId={`model-${m.id}`}
                      >
                        {m.label}
                        <span className="text-subtle"> · {m.lab}</span>
                        {top && (
                          <span className="text-[10px] font-semibold uppercase">
                            {" "}{COUNTRY_META[top.countryId]?.flag}
                          </span>
                        )}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}

            {presentCountries.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">País</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={country === "all"} onClick={() => setCountryOverride(null)} testId="country-all">
                    Todos
                  </Chip>
                  {presentCountries.map((c) => (
                    <Chip key={c} active={country === c} onClick={() => setCountryOverride(c)} testId={`country-${c}`}>
                      {COUNTRY_META[c]?.flag ?? "🌐"} {COUNTRY_META[c]?.label ?? c}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <span className="sr-only">Buscar en el informe</span>
          <input
            ref={searchRef}
            value={query || queryFromUrl}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en títulos, notas, modelos o países"
            aria-controls="signal-results"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-accent"
          />
        </label>
      </section>

      <div id="signal-results" className="mt-8 space-y-6" aria-live="polite">
        <p className="sr-only" role="status">
          {filtered.length} {filtered.length === 1 ? "señal encontrada" : "señales encontradas"}.
        </p>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
            <p className="text-sm text-muted">
              Nada coincide con esos filtros.
            </p>
            <button
              type="button"
              onClick={() => {
                setRegionOverride(null);
                setModelOverride(null);
                setCountryOverride(null);
                setQuery("");
              }}
              className="mt-3 inline-flex min-h-9 items-center rounded-full border border-border bg-elevated px-4 text-sm text-fg transition-colors duration-150 hover:border-accent"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          groupByDay(filtered).map(([day, daySignals]) => (
            <section key={day} aria-label={day}>
              <div className="sticky top-0 z-10 -mx-4 mb-3 bg-bg/85 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
                <h3 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">
                  {day}{" "}
                  <span className="ml-1 tracking-normal normal-case">
                    · {daySignals.length}
                  </span>
                </h3>
              </div>
              <div className="space-y-3">
                {daySignals.map((s) => (
                  <SignalCard
                    key={s.id}
                    signal={s}
                    open={openId === s.id}
                    onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          className="fixed right-5 bottom-6 z-20 inline-flex size-11 items-center justify-center rounded-full border border-border bg-elevated text-muted shadow-lg transition-colors duration-150 hover:border-accent hover:text-fg"
        >
          <ArrowUp className="size-5" />
        </button>
      )}

      <footer className="mt-14 border-t border-border pt-6 text-xs text-subtle">
        AI Informe · Datos reales con fuente · {signals.length} señales ·
        {generatedAt ? ` generado ${new Date(generatedAt).toLocaleString("es-CL")}` : " sin fecha"}
      </footer>
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
  icon,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150",
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
}: {
  signal: Signal;
  open: boolean;
  onToggle: () => void;
}) {
  const when = relativeDate(signal.published);
  const countryMeta = signal.country ? COUNTRY_META[signal.country] : undefined;
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors duration-150 hover:border-accent/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
            <span>{when || "sin fecha"}</span>
            <span aria-hidden>·</span>
            <span>{signal.sourceLabel ?? SOURCE_LABEL[signal.source ?? ""] ?? "Noticias"}</span>
            {signal.publisher && (
              <>
                <span aria-hidden>·</span>
                <span>{signal.publisher}</span>
              </>
            )}
            {countryMeta && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>{countryMeta.flag}</span>
                  {countryMeta.label}
                </span>
              </>
            )}
          </div>
          <h2 className="font-display text-lg leading-snug text-fg">
            {signal.sourceUrl ? (
              <a
                href={signal.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {signal.title}
              </a>
            ) : (
              signal.title
            )}
          </h2>
          {signal.summary && !open && (
            <p className="mt-1 line-clamp-2 text-sm text-muted">{signal.summary}</p>
          )}
          {signal.models.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {signal.models.map((m) => {
                const meta = modelMeta(m);
                return (
                  <span
                    key={m}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                      meta?.region === "china"
                        ? "bg-elevated text-china"
                        : "bg-elevated text-fg",
                    )}
                    title={meta ? `${meta.label} · ${meta.lab}` : m}
                  >
                    {meta?.label ?? m}
                    {meta && <span className="ml-1 text-subtle normal-case font-normal">· {meta.lab}</span>}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-subtle transition-transform duration-200 ease-[var(--ease-out-smooth)]",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 pt-3 pb-4 text-sm leading-relaxed text-muted sm:px-5">
          {(signal as Signal & { title_orig?: string }).title_orig && (
            <p className="mb-2 text-xs italic text-subtle">
              Título original: {(signal as Signal & { title_orig?: string }).title_orig}
            </p>
          )}
          {signal.summary ? (
            <p>{signal.summary}</p>
          ) : (
            <p className="text-subtle italic">Sin resumen disponible.</p>
          )}
          {signal.sourceUrl && (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-accent hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Leer fuente original
            </a>
          )}
        </div>
      ) : null}
    </article>
  );
}
