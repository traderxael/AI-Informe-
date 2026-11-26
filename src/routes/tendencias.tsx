import { createFileRoute } from "@tanstack/react-router";
import { TendenciasPage } from "@/components/tendencias-page";

export const Route = createFileRoute("/tendencias")({
  head: () => ({
    meta: [
      { title: "Tendencias del ranking — AI Informe" },
      {
        name: "description",
        content: "Evolución del Elo LMArena de los principales modelos de IA, run a run.",
      },
    ],
  }),
  component: TendenciasPage,
});
