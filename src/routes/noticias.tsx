import { createFileRoute } from "@tanstack/react-router";
import { NoticiasPage, type NoticiasSearch } from "@/components/noticias-page";
import { CATEGORIAS, type Categoria } from "@/lib/noticias-data";

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
