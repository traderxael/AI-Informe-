import { createFileRoute } from "@tanstack/react-router";
import { WeekView } from "@/components/informe/week-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <WeekView />;
}
