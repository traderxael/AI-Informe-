import { useNavigate, useSearch } from "@tanstack/react-router";
import { WeekView } from "@/components/informe/week-view";

export function Home() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  return <WeekView search={search} navigate={navigate} />;
}
