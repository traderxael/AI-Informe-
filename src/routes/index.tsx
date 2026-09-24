import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { WeekView } from "@/components/informe/week-view";
import type { InformeSearch, ModelId, Region } from "@/lib/informe-data";

const REGIONES: Region[] = ["west", "china"];
const TABS: InformeSearch["tab"][] = ["briefing", "precios"];

export const Route = createFileRoute("/")({
  // WeekView recibe { search, navigate }. Sin validateSearch la ruta "/" no
  // tenia search tipado y el build fallaba con
  // "Type '{}' is missing ... search, navigate" (TS2739).
  validateSearch: (raw: Record<string, unknown>): InformeSearch => {
    const region = raw.region;
    const model = raw.model;
    const tab = raw.tab;
    return {
      region: REGIONES.includes(region as Region) ? (region as Region) : "all",
      model: (typeof model === "string" ? model : "all") as ModelId | "all",
      tab: TABS.includes(tab as InformeSearch["tab"]) ? (tab as InformeSearch["tab"]) : "briefing",
    };
  },
  component: Home,
});

function Home() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  return <WeekView search={search} navigate={navigate} />;
}
