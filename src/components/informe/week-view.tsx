import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Globe2, Landmark, Search } from "lucide-react";
import {
  ALL_MODELS,
  CHINA_MODELS,
  SOURCE_LABEL,
  WEST_MODELS,
  WEEK_LABEL,
  filterSignals,
  type ModelId,
  type Region,
  type Signal,
} from "@/lib/informe-data";
import { cn } from "@/lib/utils";

type RegionFilter = Region | "all";
type ModelFilter = ModelId | "all";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function initialFilters(): {
  region: RegionFilter;
  model: ModelFilter;
  query: string;
} {
  if (typeof window === "undefined") return { region: "all", model: "all", query: "" };
  const params = new URLSearchParams(window.location.search);
  const regionParam = params.get("region");
  const modelParam = params.get("model");
  const region: RegionFilter =
    regionParam === "west" || regionParam === "china" ? regionParam : "all";
  const model: ModelFilter = ALL_MODELS.some((item) => item.id === modelParam)
    ? (modelParam as ModelId)
    : "all";
  const regionModels =
    region === "west" ? WEST_MODELS : region === "china" ? CHINA_MODELS : ALL_MODELS;
  return {
    region,
    model: regionModels.some((item) => item.id === model) ? model : "all",
    query: params.get("q") ?? "",
  };
}

export function WeekView() {
  const initial = initialFilters();
  const [region, setRegion] = useState<RegionFilter>(initial.region);
  const [model, setModel] = useState<ModelFilter>(initial.model);
  const [query, setQuery] = useState(initial.query);
  const [openId, setOpenId] = useState<string | null>("west-compare");

  const modelOptions =
    region === "west" ? WEST_MODELS : region === "china" ? CHINA_MODELS : ALL_MODELS;

  const signals = useMemo(() => {
    const base = filterSignals(region, model);
    const q = normalizeText(query.trim());
    if (!q) return base;
    return base.filter(
      (s) =>
        normalizeText(s.title).includes(q) ||
        normalizeText(s.summary).includes(q) ||
        normalizeText(s.detail).includes(q) ||
        s.models.some((m) => normalizeText(m).includes(q)),
    );
  }, [region, model, query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (region === "all") params.delete("region");
    else params.set("region", region);
    if (model === "all") params.delete("model");
    else params.set("model", model);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [region, model, query]);

  function pickRegion(next: RegionFilter) {
    setRegion(next);
    if (next === "all") return;
    if (model === "all") return;
    const allowed = (next === "west" ? WEST_MODELS : CHINA_MODELS).map((m) => m.id);
    if (!allowed.includes(model)) setModel("all");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <p className="mb-3 text-xs font-medium tracking-[0.18em] text-subtle uppercase">
        Informe semanal
      </p>
      <h1 className="font-display text-[2rem] leading-tight tracking-tight text-fg sm:text-4xl">
        Inteligencia artificial, por región y por modelo
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
        Occidente: Claude, Grok, Gemini. China: GLM, Qwen, Kimi. Semana del {WEEK_LABEL}.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-2">
        <Stat value={signals.length} label="Señales" />
        <Stat
          value={region === "china" ? "China" : region === "west" ? "West" : "Global"}
          label="Región"
        />
        <Stat
          value={model === "all" ? "Todos" : (ALL_MODELS.find((m) => m.id === model)?.label ?? "—")}
          label="Modelo"
        />
      </div>

      <section className="mt-8 space-y-4" aria-label="Filtros">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Región</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={region === "all"}
              onClick={() => pickRegion("all")}
              icon={<Globe2 className="size-3.5" />}
              testId="region-all"
            >
              Todo
            </Chip>
            <Chip
              active={region === "west"}
              onClick={() => pickRegion("west")}
              icon={<Landmark className="size-3.5" />}
              testId="region-west"
            >
              Occidente
            </Chip>
            <Chip
              active={region === "china"}
              onClick={() => pickRegion("china")}
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
          <div className="flex flex-wrap gap-2">
            <Chip active={model === "all"} onClick={() => setModel("all")} testId="model-all">
              Todos
            </Chip>
            {modelOptions.map((m) => (
              <Chip
                key={m.id}
                active={model === m.id}
                onClick={() => setModel(m.id)}
                testId={`model-${m.id}`}
              >
                {m.label}
                <span className="text-subtle"> · {m.lab}</span>
              </Chip>
            ))}
          </div>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <span className="sr-only">Buscar en el informe</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en títulos y notas"
            aria-controls="signal-results"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-accent"
          />
        </label>
      </section>

      <div id="signal-results" className="mt-8 space-y-3" aria-live="polite">
        <p className="sr-only" role="status">
          {signals.length} {signals.length === 1 ? "señal encontrada" : "señales encontradas"}.
        </p>
        {signals.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            Nada coincide con esos filtros. Prueba otra región o modelo.
          </p>
        ) : (
          signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              open={openId === s.id}
              onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
            />
          ))
        )}
      </div>

      <footer className="mt-14 border-t border-border pt-6 text-xs text-subtle">
        AI Informe · Fuentes públicas de la semana · No es ranking único, es mapa de roles.
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center">
      <div className="font-display text-lg tabular-nums text-fg">{value}</div>
      <div className="text-[11px] tracking-wide text-subtle uppercase">{label}</div>
    </div>
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
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150",
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
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                signal.region === "china" ? "bg-elevated text-china" : "bg-elevated text-west",
              )}
            >
              {regionLabel}
            </span>
            <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-subtle uppercase">
              {SOURCE_LABEL[signal.source]}
            </span>
            {signal.models.map((m) => {
              const meta = ALL_MODELS.find((x) => x.id === m);
              return (
                <span
                  key={m}
                  className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-fg uppercase"
                >
                  {meta?.label ?? m}
                </span>
              );
            })}
          </div>
          <h2 className="font-display text-lg leading-snug text-fg">{signal.title}</h2>
          <p className="mt-1 text-sm text-muted">{signal.summary}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-subtle transition-transform duration-200 ease-[var(--ease-out-smooth)]",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <p className="border-t border-border px-4 pt-3 pb-4 text-sm leading-relaxed text-muted sm:px-5">
          {signal.detail}
        </p>
      ) : null}
    </article>
  );
}
