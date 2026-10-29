import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";
import type { InformeSearch } from "@/lib/informe-data";

type AppRouter = ReturnType<typeof getRouter>;

// Registro global para que `useNavigate`/`useSearch` infieran tipos en toda la app.
declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
  });
}

/** Tipo de búsqueda de la ruta raíz, exportado para componentes hijos. */
export type RootSearch = InformeSearch;
