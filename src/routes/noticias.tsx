import { useCallback, useEffect, useMemo, useReducer } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Newspaper, RefreshCw } from "lucide-react";
import { loadLiveSignals, invalidateLiveSignals, type LiveSignalsResult } from "@/lib/live-feed";
import { SIGNALS, type Signal } from "@/lib/informe-data";
import {
  CATEGORIAS,
  CATEGORIA_META,
  enrichSignals,
  filterByCategory,
  groupByCategory,
  sortNoticias,
  type Categoria,
} from "@/lib/noticias-data";
import { FiltrosNoticias } from "@/components/noticias/filtros-noticias";
import { NoticiaCard } from "@/components/noticias/noticia-card";
import { cn } from "@/lib/utils";

type NoticiasSearch = { categoria?: Categoria | "todas"; q?: string };

export const Route = createFileRoute("/noticias")({
  validateSearch: (raw: Record<string, unknown>): NoticiasSearch => {
    const cat = raw.categoria;
    const q = raw.q;
    return {
      categoria:
        typeof cat === "string" && (cat === "todas" || (CATEGORIAS as readonly string[]).includes(cat))
          ? (cat as Categoria | "todas")
          : undefined,
      q: typeof q === "string" ? q.replace(/\s+/g, " ").trim().slice(0, 140) || undefined : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Noticias del día · AI Informe" },
      {
        name: "description",
        content:
          "Noticias del día por categoría: IA, ciencia, política, China, economía y seguridad.",
      },
    ],
  }),
  component: NoticiasPage,
});

const MAX_POR_GRUPO = 8;

/** Estado derivado del feed en una única transición (un solo setState por update). */
type FeedState = {
  seed: Signal[];
  generatedAt: string | null;
  error: boolean;
  loading: boolean;
};

const initialState: FeedState = {
  seed: SIGNALS,
  generatedAt: null,
  error: false,
  loading: true,
};

type FeedAction =
  | { type: "refresh-start" }
  | { type: "loaded"; res: LiveSignalsResult };

function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "refresh-start":
      return { ...state, loading: true, error: false };
    case "loaded":
      return {
        seed: action.res.signals,
        generatedAt: action.res.generatedAt ?? null,
        error: !action.res.live, // sin red/datos: avisamos que es edición de referencia
        loading: false,
      };
  }
}

function NoticiasPage() {
  const search = useSearch({ from: "/noticias" });
  const navigate = useNavigate({ from: "/noticias" });
  const [feed, dispatch] = useReducer(feedReducer, initialState);
  const { seed, generatedAt, error, loading } = feed;

  // El botón «Refrescar» sí invalida la caché (datos frescos a petición).
  const applyLive = useCallback(() => {
    dispatch({ type: "refresh-start" });
    invalidateLiveSignals();
    void loadLiveSignals().then((res) => dispatch({ type: "loaded", res }));
  }, []);

  // Carga inicial: usa la caché/dedupe de live-feed. No hay setState sincrónico
  // en el effect: el dispatch ocurre en el microtask del fetch ya resuelto.
  useEffect(() => {
    let cancelled = false;
    void loadLiveSignals().then((res) => {
      if (!cancelled) dispatch({ type: "loaded", res });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const noticias = useMemo(() => sortNoticias(enrichSignals(seed)), [seed]);

  const activeCat: Categoria | "todas" = search.categoria ?? "todas";
  const q = (search.q ?? "").trim().toLowerCase();

  const visibles = useMemo(() => {
    const byCat = filterByCategory(noticias, activeCat);
    if (!q) return byCat;
    return byCat.filter((n) =>
      `${n.title} ${n.summary} ${n.detail} ${n.sourceLabel}`.toLowerCase().includes(q),
    );
  }, [noticias, activeCat, q]);

  const grupos = useMemo(() => groupByCategory(visibles), [visibles]);

  // Conteos por categoría para los chips: sobre la búsqueda activa, pero
  // independientemente del filtro de categoría elegido.
  const counts = useMemo(() => {
    const base = q
      ? noticias.filter((n) =>
          `${n.title} ${n.summary} ${n.detail} ${n.sourceLabel}`.toLowerCase().includes(q),
        )
      : noticias;
    const c: Partial<Record<Categoria, number>> & { todas: number } = { todas: base.length };
    for (const n of base) c[n.categoria] = (c[n.categoria] ?? 0) + 1;
    return c;
  }, [noticias, q]);

  const patch = useCallback(
    (next: Partial<NoticiasSearch>) => {
      void navigate({
        search: (prev) => ({
          categoria: next.categoria !== undefined ? next.categoria : prev.categoria,
          q: next.q !== undefined ? next.q : prev.q,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const onCategoria = useCallback(
    (c: Categoria | "todas") => patch({ categoria: c === "todas" ? undefined : c }),
    [patch],
  );
  const onQuery = useCallback((value: string | undefined) => patch({ q: value }), [patch]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
      <header className="relative mb-7 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-elevated via-surface to-bg px-5 py-7 shadow-2xl shadow-black/20 sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -top-28 right-8 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-subtle uppercase">
            <Newspaper className="size-4 text-accent" />
            Noticias del día
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-fg sm:text-5xl">
            Lo que pasó hoy, por tema
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Señales clasificadas en seis categorías: IA, ciencia, política, China, economía y
            seguridad. Priorizamos contenido en español cuando existe.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span className="text-xs text-subtle">
              {generatedAt
                ? `Actualizado ${new Date(generatedAt).toLocaleString("es-CL")}`
                : "Edición de referencia"}
            </span>
            <button
              type="button"
              onClick={applyLive}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/30 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refrescar
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-200"
        >
          No pudimos cargar el feed en vivo; mostrando la edición de referencia.
        </p>
      ) : null}

      <FiltrosNoticias
        activeCat={activeCat}
        query={search.q ?? ""}
        counts={counts}
        total={noticias.length}
        onCategoria={onCategoria}
        onQuery={onQuery}
      />

      {loading ? (
        // Skeletons con altura estable: evita saltos de layout (CLS) al llegar los datos.
        <ul className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Cargando noticias">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-40 animate-pulse rounded-2xl border border-border/60 bg-surface/60" />
          ))}
        </ul>
      ) : visibles.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          No hay noticias que coincidan. Prueba otra categoría o quita la búsqueda.
        </p>
      ) : (
        <div className="space-y-8">
          {grupos.map(({ categoria, items }) => (
            <section key={categoria} aria-labelledby={`cat-${categoria}`}>
              <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border/80 pb-2">
                <h2 id={`cat-${categoria}`} className={cn("font-display text-xl", CATEGORIA_META[categoria].color.split(" ")[0])}>
                  {CATEGORIA_META[categoria].label}
                </h2>
                <span className="text-xs text-subtle">{items.length}</span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.slice(0, MAX_POR_GRUPO).map((n) => (
                  <NoticiaCard key={`${categoria}-${n.id}`} n={n} />
                ))}
              </ul>
              {items.length > MAX_POR_GRUPO ? (
                <button
                  type="button"
                  onClick={() => onCategoria(categoria)}
                  className="mt-3 inline-flex min-h-9 items-center rounded-full border border-border/70 px-3.5 text-xs font-medium text-muted transition hover:border-accent/30 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Ver las {items.length} de {CATEGORIA_META[categoria].label} →
                </button>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <footer className="mt-14 border-t border-border pt-6 text-xs text-subtle">
        <Link to="/" search={{ region: "all", model: "all", tab: "briefing" }} className="hover:text-accent">← Volver al informe</Link> · AI Informe · Noticias del día
      </footer>
    </main>
  );
}
