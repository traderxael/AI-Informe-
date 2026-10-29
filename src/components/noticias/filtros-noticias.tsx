import { memo, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { CATEGORIAS, CATEGORIA_META, type Categoria } from "@/lib/noticias-data";
import { cn } from "@/lib/utils";

export const CatChip = memo(function CatChip({
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
});

/** Barra de filtros: chips por categoría + búsqueda con debounce local
 *  (el input responde al instante; la navegación al URL —que re-renderiza
 *  toda la lista— se pospone ~250 ms). */
export const FiltrosNoticias = memo(function FiltrosNoticias({
  activeCat,
  query,
  counts,
  total,
  onCategoria,
  onQuery,
}: {
  activeCat: Categoria | "todas";
  query: string;
  counts: Partial<Record<Categoria, number>> & { todas: number };
  total: number;
  onCategoria: (c: Categoria | "todas") => void;
  onQuery: (q: string | undefined) => void;
}) {
  const [localQ, setLocalQ] = useState(query);
  const timer = useRef<number | undefined>(undefined);
  const skipSync = useRef(false);

  // Si el URL cambia desde fuera (back/forward, limpiar), sincronizar.
  useEffect(() => {
    if (!skipSync.current) setLocalQ(query);
    skipSync.current = false;
  }, [query]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  function handleChange(value: string) {
    setLocalQ(value);
    skipSync.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onQuery(value.trim() || undefined), 250);
  }

  return (
    <section
      className="mb-6 space-y-4 rounded-3xl border border-border/80 bg-surface/65 p-4 shadow-lg shadow-black/10 sm:p-5"
      aria-label="Filtros de noticias"
    >
      <div
        role="group"
        aria-label="Categorías de noticias"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <CatChip active={activeCat === "todas"} onClick={() => onCategoria("todas")}>
          Todas <Count value={total} />
        </CatChip>
        {CATEGORIAS.map((c) => (
          <CatChip key={c} active={activeCat === c} onClick={() => onCategoria(c)} meta={CATEGORIA_META[c]}>
            {CATEGORIA_META[c].label} <Count value={counts[c] ?? 0} />
          </CatChip>
        ))}
      </div>
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <span className="sr-only">Buscar noticias</span>
        <input
          type="search"
          value={localQ}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Buscar por título, resumen o fuente"
          className="h-12 w-full rounded-xl border border-border bg-bg/70 pr-10 pl-10 text-sm text-fg outline-none transition placeholder:text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
        />
        {localQ ? (
          <button
            type="button"
            onClick={() => {
              setLocalQ("");
              onQuery(undefined);
            }}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-subtle transition hover:bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label="Limpiar búsqueda"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </label>
    </section>
  );
});

function Count({ value }: { value: number }) {
  return <span className="text-xs opacity-60 tabular-nums">{value}</span>;
}
