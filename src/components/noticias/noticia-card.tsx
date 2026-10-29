import { memo } from "react";
import { ExternalLink } from "lucide-react";
import { CATEGORIA_META, type NoticiaDelDia } from "@/lib/noticias-data";
import { cn } from "@/lib/utils";

/** Tiempo relativo compacto («hace 3 h»), con fallback a fecha ISO. */
function tiempoRelativo(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  const diffMin = Math.round((Date.now() - t) / 60_000);
  if (diffMin < 1) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const horas = Math.round(diffMin / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return iso.slice(0, 10);
}

/** Tarjeta de noticia memorizada: evita re-render cuando cambian filtros
 *  no relacionados (búsqueda, otras categorías). */
export const NoticiaCard = memo(function NoticiaCard({ n }: { n: NoticiaDelDia }) {
  const meta = CATEGORIA_META[n.categoria];
  const cuando = tiempoRelativo(n.published);
  return (
    <li>
      <article className="group h-full overflow-hidden rounded-2xl border border-border/80 bg-surface/80 shadow-lg shadow-black/10 transition duration-200 hover:border-accent/20 hover:bg-surface">
        <div className="px-4 py-4 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase",
                meta.color,
              )}
            >
              {meta.label}
            </span>
            {n.lang === "es" ? (
              <span className="rounded-md border border-border bg-elevated/70 px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] text-muted uppercase">
                ES
              </span>
            ) : null}
            {cuando ? <span className="text-[10px] text-subtle">{cuando}</span> : null}
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
});
