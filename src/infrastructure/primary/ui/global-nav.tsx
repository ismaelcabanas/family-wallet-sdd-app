import Link from "next/link";

import { currentMonth } from "./format";
import { ReportsNavMenu } from "./reports-nav-menu";

const LINK_CLASSES = "text-sm text-muted-foreground underline-offset-4 hover:underline";
const ACTIVE_LINK_CLASSES = "text-sm font-medium text-foreground";

export function GlobalNav({
  active,
  month,
}: {
  active: "panel" | "summary" | "annual" | "tags" | "reports" | "import";
  month?: string;
}) {
  const contextMonth = month ?? currentMonth();
  const year = contextMonth.slice(0, 4);

  return (
    <nav aria-label="Navegación principal" className="flex items-center gap-4">
      <Link
        href="/"
        aria-current={active === "panel" ? "page" : undefined}
        className={active === "panel" ? ACTIVE_LINK_CLASSES : LINK_CLASSES}
      >
        Panel
      </Link>
      <Link
        href={`/summary?month=${contextMonth}`}
        aria-current={active === "summary" ? "page" : undefined}
        className={active === "summary" ? ACTIVE_LINK_CLASSES : LINK_CLASSES}
      >
        Resumen global
      </Link>
      <Link
        href={`/annual?year=${year}`}
        aria-current={active === "annual" ? "page" : undefined}
        className={active === "annual" ? ACTIVE_LINK_CLASSES : LINK_CLASSES}
      >
        Cuenta de resultados
      </Link>
      <ReportsNavMenu active={active} />
      <Link
        href="/tags"
        aria-current={active === "tags" ? "page" : undefined}
        className={active === "tags" ? ACTIVE_LINK_CLASSES : LINK_CLASSES}
      >
        Etiquetas
      </Link>
      <Link
        href="/import"
        aria-current={active === "import" ? "page" : undefined}
        className={active === "import" ? ACTIVE_LINK_CLASSES : LINK_CLASSES}
      >
        Importar
      </Link>
    </nav>
  );
}
