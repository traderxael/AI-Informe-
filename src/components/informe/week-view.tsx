import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Globe2, Landmark, Search } from "lucide-react";
import {
  COUNTRY_META,
  REGION_LABEL,
  SOURCE_LABEL,
  TOP_MODELS,
  filterSignals,
  loadSignals,
  modelMeta,
  type Region,
  type Signal,
} from "@/lib/informe-data";
import { cn } from "@/lib/utils";

type RegionFilter = Region | "all";
type StrFilter = string | "all";

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

export function WeekView() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionFilter>("all");
  const [model, setModel] = useState<StrFilter>("all");
  const [country, setCountry] = useState<StrFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadSignals().then((bundle) => {
      if (!alive) return;
      setSignals(bundle.signals);
      setGeneratedAt(bundle.generatedAt ?? null);
    });
    return () => {
      alive = false;
    };
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
    const q = normalizeText(query.trim());
    if (!q) return base;
    return base.filter(
      (s) =>
        normalizeText(s.title).includes(q) ||
        normalizeText(s.summary || "").includes(q) ||
        s.models.some((m) => normalizeText(m).includes(q)) ||
        (s.country ? normalizeText(s.country).includes(q) : false),
    );
  }, [signals, region, model, country, query]);

  useEffect(() => {
    if (model !== "all" && !presentModels.some((m) => m.id === model)) setModel("all");
    if (country !== "all" && !presentCountries.includes(country)) setCountry("all");
  }, [presentModels, presentCountries, model, country]);

  function pickRegion(next: RegionFilter) {
    setRegion(next);
    if (next !== "all" && model !== "all") {
      const allowed = presentModels.filter((m) => m.region === next).map((m) => m.id);
      if (!allowed.includes(model)) setModel("all");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <p className="mb-3 text-xs font-medium tracking-[0.18em] text-subtle uppercase">
        Informe semanal
      </p>
      <h1 className="font-display text-[2rem] leading-tight tracking-tight text-fg sm:text-4xl">
        Inteligencia artificial, por país y por modelo
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
        Señales reales con fuente enlazable — Occidente, China y el resto del mundo.
        {generatedAt ? ` Actualizado: ${new Date(generatedAt).toLocaleString("es-CL")}.` : ""}
      </p>

      <div className="mt-8 grid grid-cols-3 gap-2">
        <Stat value={signals.length} label="Señales" />
        <Stat value={region === "all" ? "Todo" : REGION_LABEL[region]} label="Región" />
        <Stat value={presentCountries.length} label="Países" />
      </div>

      <section className="mt-8 space-y-4" aria-label="Filtros">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Región</p>
          <div className="flex flex-wrap gap-2">
            {REGION_CHIPS.map((c) => (
              <Chip
                key={c.id}
                active={region === c.id}
                onClick={() => pickRegion(c.id)}
                icon={c.id === "all" ? <Globe2 className="size-3.5" /> : c.id === "west" ? <Landmark className="size-3.5" /> : undefined}
                testId={`region-${c.id}`}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        {modelOptions.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Modelos</p>
                    <div className="flex flex-wrap gap-2">
                      <Chip active={model === "all"} onClick={() => setModel("all")} testId="model-all">
                        Todos
                      </Chip>
                      {modelOptions.map((m) => {
                        const top = TOP_MODELS.find((t) => t.id === m.id);
                        return (
                          <Chip
                            key={m.id}
                            active={model === m.id}
                            onClick={() => setModel(m.id)}
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
                      <Chip active={country === "all"} onClick={() => setCountry("all")} testId="country-all">
                        Todos
                      </Chip>
                      {presentCountries.map((c) => (
                        <Chip key={c} active={country === c} onClick={() => setCountry(c)} testId={`country-${c}`}>
                          {COUNTRY_META[c]?.flag ?? "🌐"} {COUNTRY_META[c]?.label ?? c}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <span className="sr-only">Buscar en el informe</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en títulos, notas, modelos o países"
            aria-controls="signal-results"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-accent"
          />
        </label>
      </section>

      <div id="signal-results" className="mt-8 space-y-3" aria-live="polite">
        <p className="sr-only" role="status">
          {filtered.length} {filtered.length === 1 ? "señal encontrada" : "señales encontradas"}.
        </p>
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            Nada coincide con esos filtros. Prueba otra región, modelo o país.
          </p>
        ) : (
          filtered.map((s) => (
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
        AI Informe · Datos reales con fuente · {signals.length} señales ·
        {generatedAt ? ` generado ${new Date(generatedAt).toLocaleString("es-CL")}` : " sin fecha"}
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
  const regionLabel = REGION_LABEL[signal.region] ?? signal.region;
  const country = signal.country ? COUNTRY_META[signal.country] : undefined;
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
                signal.region === "china" ? "bg-elevated text-china" : signal.region === "west" ? "bg-elevated text-west" : "bg-elevated text-subtle",
              )}
            >
              {regionLabel}
            </span>
            {country && country.label && (
              <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-subtle">
                {country.flag} {country.label}
              </span>
            )}
            {signal.source && (
              <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-subtle uppercase">
                {SOURCE_LABEL[signal.source] ?? signal.source}
              </span>
            )}
            {signal.models.map((m) => {
              const meta = modelMeta(m);
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
        <div className="border-t border-border px-4 pt-3 pb-4 text-sm leading-relaxed text-muted sm:px-5">
          <p>{signal.summary}</p>
          {signal.sourceUrl && (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-accent hover:underline"
            >
              Leer fuente original →
            </a>
          )}
        </div>
      ) : null}
    </article>
  );
}