import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Newspaper, RefreshCw, Search, X } from "lucide-react";
import { loadLiveSignals, invalidateLiveSignals } from "@/lib/live-feed";
import { SIGNALS, type Signal } from "@/lib/informe-data";
import {
  CATEGORIAS,
  CATEGORIA_META,
  enrichSignals,
  filterByCategory,
  groupByCategory,
  sortNoticias,
  type Categoria,
  type NoticiaDelDia,
} from "@/lib/noticias-data";
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

function NoticiasPage() {
  const search = useSearch({ from: "/noticias" });
  const navigate = useNavigate({ from: "/noticias" });
  const [seed, setSeed] = useState<Signal[]>(SIGNALS);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  function applyLive() {
    setLoading(true);
    invalidateLiveSignals(); // el usuario pidió datos frescos: salta la caché
    void loadLiveSignals().then((res) => {
      setSeed(res.signals);
      setGeneratedAt(res.generatedAt ?? null);
      setLoading(false);
    });
  }

  // Carga inicial única; el estado de `loading` se resuelve en el callback.
  useEffect(() => {
    applyLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function patch(next: Partial<NoticiasSearch>) {
    void navigate({
      search: (prev) => ({
        categoria: next.categoria ?? prev.categoria,
        q: next.q !== undefined ? next.q : prev.q,
      }),
      replace: true,
    });
  }

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
              {generatedAt ? `Actualizado ${new Date(generatedAt).toLocaleString("es-CL")}` : "Edición de referencia"}
            </span>
            <button
              type="button"
              onClick={applyLive}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/30 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refrescar
            </button>
          </div>
        </div>
      </header>

      <section className="mb-6 space-y-4 rounded-3xl border border-border/80 bg-surface/65 p-4 shadow-lg shadow-black/10 sm:p-5" aria-label="Filtros de noticias">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <CatChip active={activeCat === "todas"} onClick={() => patch({ categoria: "todas" })}>
            Todas
          </CatChip>
          {CATEGORIAS.map((c) => (
            <CatChip key={c} active={activeCat === c} onClick={() => patch({ categoria: c })} meta={CATEGORIA_META[c]}>
              {CATEGORIA_META[c].label}
            </CatChip>
          ))}
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <span className="sr-only">Buscar noticias</span>
          <input
            value={search.q ?? ""}
            onChange={(e) => patch({ q: e.target.value || undefined })}
            placeholder="Buscar por título, resumen o fuente"
            className="h-12 w-full rounded-xl border border-border bg-bg/70 pr-10 pl-10 text-sm text-fg placeholder:text-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
          />
          {search.q ? (
            <button
              type="button"
              onClick={() => patch({ q: undefined })}
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-subtle transition hover:bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </label>
      </section>

      {loading ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          Cargando noticias…
        </p>
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
                {items.slice(0, activeCat === categoria ? undefined : 4).map((n) => (
                  <NoticiaCard key={`${categoria}-${n.id}`} n={n} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-14 border-t border-border pt-6 text-xs text-subtle">
        <a href="/" className="hover:text-accent">← Volver al informe</a> · AI Informe · Noticias del día
      </footer>
    </main>
  );
}

function CatChip({
  active,
  onClick,
  children,
  meta,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  meta?: { color: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        active
          ? meta
            ? cn("border-current bg-current/10", meta.color)
            : "border-accent/40 bg-accent/10 text-accent"
          : "border-border/70 bg-surface/55 text-muted hover:border-accent/30 hover:bg-elevated hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function NoticiaCard({ n }: { n: NoticiaDelDia }) {
  const meta = CATEGORIA_META[n.categoria];
  return (
    <li>
      <article className="group h-full overflow-hidden rounded-2xl border border-border/80 bg-surface/80 shadow-lg shadow-black/10 transition duration-200 hover:border-accent/20 hover:bg-surface">
        <div className="px-4 py-4 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase", meta.color)}>
              {meta.label}
            </span>
            {n.lang === "es" ? (
              <span className="rounded-md border border-border bg-elevated/70 px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] text-muted uppercase">
                ES
              </span>
            ) : null}
            {n.published ? (
              <span className="text-[10px] text-subtle">{n.published.slice(0, 10)}</span>
            ) : null}
          </div>
          <h3 className="font-display text-base leading-snug text-fg transition-colors group-hover:text-white sm:text-lg">
            {n.title}
          </h3>
          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">{n.summary}</p>
          {n.sourceUrl ? (
            <a
              href={n.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 text-xs font-medium text-accent transition hover:border-accent/50 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Leer fuente
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </article>
    </li>
  );
}
