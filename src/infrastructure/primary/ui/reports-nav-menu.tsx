"use client";

import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";

const TRIGGER_CLASSES = "text-sm text-muted-foreground underline-offset-4 hover:underline";
const ACTIVE_TRIGGER_CLASSES = "text-sm font-medium text-foreground";

export function ReportsNavMenu({
  active,
}: {
  active: "panel" | "summary" | "annual" | "tags" | "reports" | "import";
}) {
  const isReportsActive = active === "reports";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={isReportsActive ? ACTIVE_TRIGGER_CLASSES : TRIGGER_CLASSES}
      >
        Informes
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label="Informes">
        <DropdownMenuItem asChild>
          <Link
            href="/reports/annual-expenses"
            aria-current={isReportsActive ? "page" : undefined}
          >
            Gastos por categoría
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
