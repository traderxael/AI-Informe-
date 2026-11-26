import { createFileRoute } from "@tanstack/react-router";
import { AnaliticaPage } from "@/components/analitica-page";

export const Route = createFileRoute("/analitica")({
  head: () => ({
    meta: [
      { title: "Analítica — AI Informe" },
      {
        name: "description",
        content:
          "Analítica first-party de AI Informe: visitas, páginas y referentes. Sin cookies y sin terceros.",
      },
    ],
  }),
  component: AnaliticaPage,
});
