import { createFileRoute } from "@tanstack/react-router";
import { EstadisticasPage } from "@/components/estadisticas-page";

export const Route = createFileRoute("/estadisticas")({
  head: () => ({
    meta: [
      { title: "Estadísticas — AI Informe" },
      {
        name: "description",
        content:
          "Totales y tendencias del informe: señales por categoría, modelos por organización, salud de fuentes.",
      },
    ],
  }),
  component: EstadisticasPage,
});
