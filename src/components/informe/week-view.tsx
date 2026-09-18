import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Globe2,
  Home,
  LayoutGrid,
  Landmark,
  Search,
  Settings,
  Swords,
} from "lucide-react";
import {
  COUNTRY_META,
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

type RegionFilter = Region | "all" | "war";

const REGION_FILTERS: { id: RegionFilter; label: string; icon?: React.ReactNode }[] = [
  { id: "all", label: "Todo", icon: <Globe2 className="size-3.5" /> },
  { id: "west", label: "Occidente", icon: <Landmark className="size-3.5" /> },
  { id: "china", label: "China" },
  { id: "global", label: "Global" },
  { id: "war", label: "Guerra", icon: <Swords className="size-3.5" /> },
];

const WAR_KEYWORDS = [
  "guerra", "war", "militar", "military", "defense", "defensa",
  "armament", "drone", "dron", "ciberataque", "cyber", "weapons",
  "armas", "pentagon", "ejercito", "nato", "otan", "belico",
  "conflicto", "ataque", "armed", "troops", "combate",
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isWarSignal(s: Signal): boolean {
  const text = normalizeText(`${s.title} ${s.summary || ""}`);
  return WAR_KEYWORDS.some((kw) => text.includes(kw));
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

// --- URL filter state via useSyncExternalStore ---
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

let cachedSearch: string | null = null;
let cachedUrl: UrlFilterState = neutralUrlState;

function parseUrlState(search: string): UrlFilterState {
  const p = new URLSearchParams(search);
  const r = p.get("region");
  const m = p.get("model");
  const c = p.get("country");
  const q = p.get("q");
  return {
    region: r && ["west", "china", "global", "war"].includes(r) ? (r as RegionFilter) : null,
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

const REGION_GRADIENTS: Record<string, string> = {
  west: "from-blue-500/20 to-blue-700/10",
  china: "from-red-500/20 to-red-700/10",
  global: "from-teal-500/20 to-teal-700/10",
  war: "from-amber-500/20 to-amber-700/10",
};

export function WeekView() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const urlState = useSyncExternalStore(subscribeToLocation, readUrlState, () => neutralUrlState);
  const [regionOverride, setRegionOverride] = useState<RegionFilter | null>(null);
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const [countryOverride, setCountryOverride] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const region = regionOverride ?? urlState.region ?? "all";
  const model = modelOverride ?? urlState.model ?? "all";
  const country = countryOverride ?? urlState.country ?? "all";
  const queryFromUrl = urlState.query;
  const searchQuery = query || queryFromUrl;

  // Progressive loading
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
    return () => { alive = false; };
  }, []);

  // Sync filters to URL
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const p = new URLSearchParams();
    if (region !== "all") p.set("region", region);
    if (model !== "all") p.set("model", model);
    if (country !== "all") p.set("country", country);
    if (searchQuery.trim()) p.set("q", searchQuery.trim());
    const qs = p.toString();
    const next = qs ? `?${qs}` : window.location.pathname;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
      cachedSearch = null;
    }
  }, [region, model, country, searchQuery]);

  // "/" focuses search
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

  // Scroll-to-top button
  useEffect(() => {
    function onScroll() { setShowTop(window.scrollY > 600); }
    window.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: signals.length, west: 0, china: 0, global: 0, war: 0 };
    for (const s of signals) {
      counts[s.region] = (counts[s.region] ?? 0) + 1;
      if (isWarSignal(s)) counts.war++;
    }
    return counts;
  }, [signals]);

  const modelOptions = useMemo(() => {
    const inRegion = region === "all" || region === "war"
      ? presentModels
      : presentModels.filter((m) => m.region === region);
    const rank = new Map(TOP_MODELS.map((t, i) => [t.id, i]));
    return [...inRegion].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }, [presentModels, region]);

  const filtered = useMemo(() => {
    let base: Signal[];
    if (region === "war") {
      base = signals.filter(isWarSignal);
    } else {
      base = filterSignals(signals, region === "all" ? "all" : region, model, country);
    }
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

  function pickRegion(next: RegionFilter) {
    setRegionOverride(next === (urlState.region ?? "all") ? null : next);
    if (next !== "all" && next !== "war" && model !== "all") {
      const allowed = presentModels.filter((m) => m.region === next).map((m) => m.id);
      if (!allowed.includes(model)) setModelOverride(null);
    }
  }

  function clearFilters() {
    setRegionOverride(null);
    setModelOverride(null);
    setCountryOverride(null);
    setQuery("");
  }

  return (
    <div className="flex min-h-screen">
      {/* --- Dock --- */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-surface/80 backdrop-blur-xl md:sticky md:top-0 md:h-screen md:w-14 md:flex-col md:justify-start md:gap-2 md:border-r md:border-t-0 md:py-5">
        <div className="hidden md:block">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <span className="font-display text-lg">A</span>
          </div>
        </div>
        <DockButton icon={<Home className="size-5" />} label="Inicio" />
        <DockButton icon={<LayoutGrid className="size-5" />} label="Señales" active />
        <button
          type="button"
          onClick={() => { setSidebarOpen((v) => !v); }}
          className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/5 hover:text-fg md:hidden"
          aria-label="Filtros"
        >
          <Search className="size-5" />
        </button>
        <DockButton icon={<Globe2 className="size-5" />} label="Global" />
        <DockButton icon={<Swords className="size-5" />} label="Guerra" />
        <div className="hidden md:mt-auto">
          <DockButton icon={<Settings className="size-5" />} label="Ajustes" />
        </div>
      </nav>

      {/* --- Sidebar --- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 w-72 border-r border-border bg-surface/70 backdrop-blur-xl p-5 transition-transform duration-300 md:translate-x-0",
          "bottom-16 top-auto md:top-0 md:bottom-0 md:h-screen md:overflow-y-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Branding */}
        <div className="mb-5">
          <p className="text-[10px] font-medium tracking-[0.18em] text-subtle uppercase">AI Informe</p>
          <h2 className="font-display text-xl text-fg">Champions</h2>
        </div>

        {/* Stats */}
        <div className="mb-5 flex gap-4">
          <Stat value={signals.length} label="señales" />
          <Stat value={presentCountries.length} label="países" />
          <Stat value={presentModels.length} label="modelos" />
        </div>

        {generatedAt && (
          <p className="mb-4 flex items-center gap-1.5 text-[11px] text-subtle">
            <span className="inline-block size-1.5 rounded-full bg-emerald-400" aria-hidden />
            Actualizado {relativeDate(generatedAt)}
          </p>
        )}

        {/* Search */}
        <label className="relative mb-5 block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <span className="sr-only">Buscar</span>
          <input
            ref={searchRef}
            value={query || queryFromUrl}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar señales…"
            aria-controls="signal-results"
            className="h-10 w-full rounded-xl border border-border bg-elevated/60 pr-3 pl-10 text-sm text-fg placeholder:text-subtle outline-none transition-colors focus:border-accent"
          />
        </label>

        {/* Region filters */}
        <FilterSection title="Región">
          {REGION_FILTERS.map((f) => (
            <FilterRow
              key={f.id}
              active={region === f.id}
              onClick={() => pickRegion(f.id)}
              count={regionCounts[f.id] ?? 0}
              icon={f.icon}
            >
              {f.label}
            </FilterRow>
          ))}
        </FilterSection>

        {/* Model filters */}
        {modelOptions.length > 0 && (
          <FilterSection title="Modelos">
            <FilterRow active={model === "all"} onClick={() => setModelOverride(null)} count={0}>
              Todos
            </FilterRow>
            {modelOptions.slice(0, 12).map((m) => {
              const top = TOP_MODELS.find((t) => t.id === m.id);
              return (
                <FilterRow
                  key={m.id}
                  active={model === m.id}
                  onClick={() => setModelOverride(m.id)}
                  count={0}
                >
                  {m.label}
                  {top && <span className="ml-1 text-xs">{COUNTRY_META[top.countryId]?.flag}</span>}
                </FilterRow>
              );
            })}
          </FilterSection>
        )}

        {/* Country filters */}
        {presentCountries.length > 0 && (
          <FilterSection title="País">
            <FilterRow active={country === "all"} onClick={() => setCountryOverride(null)} count={0}>
              Todos
            </FilterRow>
            {presentCountries.map((c) => (
              <FilterRow key={c} active={country === c} onClick={() => setCountryOverride(c)} count={0}>
                {COUNTRY_META[c]?.flag ?? "🌐"} {COUNTRY_META[c]?.label ?? c}
              </FilterRow>
            ))}
          </FilterSection>
        )}

        {(region !== "all" || model !== "all" || country !== "all" || searchQuery) && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 w-full rounded-lg border border-border bg-elevated/40 py-2 text-xs text-muted transition-colors hover:border-accent hover:text-fg"
          >
            Limpiar filtros
          </button>
        )}
      </aside>

      {/* --- Main content --- */}
      <main className="flex-1 overflow-y-auto md:ml-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {/* Header */}
          <header className="mb-6">
            <h1 className="font-display text-2xl text-fg sm:text-3xl">Champions</h1>
            <p className="mt-1 text-sm text-muted">
              Descubre las últimas señales de IA, tecnología de China y guerra
            </p>
            {filtered.length !== signals.length && (
              <p className="mt-1 text-xs text-subtle">
                {filtered.length} de {signals.length} señales
              </p>
            )}
          </header>

          {/* Card grid */}
          <div id="signal-results" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
            <p className="sr-only" role="status">
              {filtered.length} {filtered.length === 1 ? "señal encontrada" : "señales encontradas"}.
            </p>
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-xl border border-border bg-surface/50 px-4 py-10 text-center backdrop-blur-sm">
                <p className="text-sm text-muted">Nada coincide con esos filtros.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 inline-flex min-h-9 items-center rounded-full border border-border bg-elevated px-4 text-sm text-fg transition-colors hover:border-accent"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              filtered.map((s) => (
                <SignalGridCard key={s.id} signal={s} />
              ))
            )}
          </div>

          <footer className="mt-10 border-t border-border pt-5 text-xs text-subtle">
            AI Informe · Champions Hub · {signals.length} señales ·
            {generatedAt ? ` ${new Date(generatedAt).toLocaleString("es-CL")}` : " sin fecha"}
          </footer>
        </div>
      </main>

      {/* Scroll to top */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          className="fixed right-5 bottom-20 z-30 inline-flex size-10 items-center justify-center rounded-full border border-border bg-elevated text-muted shadow-lg backdrop-blur-xl transition-colors hover:border-accent hover:text-fg md:bottom-6"
        >
          <ArrowUp className="size-5" />
        </button>
      )}
    </div>
  );
}

function DockButton({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-xl transition-colors",
        active
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-white/5 hover:text-fg",
      )}
    >
      {icon}
    </button>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <span className="font-display text-2xl tabular-nums text-fg">{value}</span>
      <span className="ml-1 text-xs text-subtle">{label}</span>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-medium tracking-[0.15em] text-subtle uppercase">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterRow({
  active,
  onClick,
  count,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-white/5 hover:text-fg",
      )}
    >
      {icon}
      <span className="flex-1 text-left">{children}</span>
      {count > 0 && (
        <span className={cn("text-xs tabular-nums", active ? "text-accent/70" : "text-subtle")}>
          {count}
        </span>
      )}
    </button>
  );
}

function SignalGridCard({ signal }: { signal: Signal }) {
  const when = relativeDate(signal.published);
  const gradient = REGION_GRADIENTS[signal.region] ?? REGION_GRADIENTS.global;
  const isWar = isWarSignal(signal);

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-surface/40 backdrop-blur-xl transition-all duration-200 hover:border-accent/30 hover:bg-surface/60">
      {/* Gradient header */}
      <div className={cn("relative h-16 bg-gradient-to-br", gradient)}>
        {isWar && (
          <span className="absolute top-2 left-2 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-400 uppercase">
            Guerra
          </span>
        )}
        {signal.models.length > 0 && (
          <div className="absolute right-2 bottom-2 flex flex-wrap justify-end gap-1">
            {signal.models.slice(0, 3).map((m) => {
              const meta = modelMeta(m);
              return (
                <span
                  key={m}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase",
                    meta?.region === "china"
                      ? "bg-red-500/15 text-china"
                      : meta?.region === "west"
                        ? "bg-blue-500/15 text-west"
                        : "bg-teal-500/15 text-accent",
                  )}
                >
                  {meta?.label ?? m}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-subtle">
          <span>{when || "sin fecha"}</span>
          <span aria-hidden>·</span>
          <span className="truncate">
            {signal.sourceLabel ?? SOURCE_LABEL[signal.source ?? ""] ?? "Noticias"}
          </span>
        </div>
        <h3 className="font-display text-base leading-snug text-fg">
          {signal.sourceUrl ? (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent"
            >
              {signal.title}
            </a>
          ) : (
            signal.title
          )}
        </h3>
        {signal.summary && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{signal.summary}</p>
        )}
        {signal.sourceUrl && (
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <ExternalLink className="size-3" />
            Leer fuente
          </a>
        )}
      </div>
    </article>
  );
}
