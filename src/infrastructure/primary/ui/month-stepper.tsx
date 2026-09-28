"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { buildMonthWindow, currentMonth, monthLabel, shiftMonth } from "./format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

const MONTH_RADIUS = 24;

export function MonthStepper({
  accountId,
  month,
}: {
  accountId: number;
  month: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const months = buildMonthWindow(month, MONTH_RADIUS).filter((option) => option <= currentMonth());
  const nextDisabled = month >= currentMonth();

  const navigate = (nextMonth: string) => {
    startTransition(() => {
      router.replace(`/accounts/${accountId}?month=${nextMonth}`);
    });
  };

  return (
    <section
      aria-label="Selección de mes"
      className={`flex flex-wrap items-center gap-3 ${isPending ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => navigate(shiftMonth(month, -1))}
        className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        ‹
      </button>
      <Select value={month} onValueChange={navigate}>
        <SelectTrigger className="w-48" aria-label="Mes visible">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((option) => (
            <SelectItem key={option} value={option}>
              {monthLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={() => navigate(shiftMonth(month, 1))}
        disabled={nextDisabled}
        className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        ›
      </button>
    </section>
  );
}
