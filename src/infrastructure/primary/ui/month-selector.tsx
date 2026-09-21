"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { buildMonthWindow, monthLabel } from "./format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

const MONTH_RADIUS = 24;

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const months = buildMonthWindow(month, MONTH_RADIUS);

  const navigate = (nextMonth: string) => {
    startTransition(() => {
      router.replace(`/summary?month=${nextMonth}`);
    });
  };

  return (
    <section
      aria-label="Selección de mes"
      className={`flex flex-wrap items-center gap-3 ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="month-selector" className="text-sm font-medium">
          Mes
        </label>
        <Select value={month} onValueChange={navigate}>
          <SelectTrigger id="month-selector" className="w-48" aria-label="Mes visible">
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
      </div>
    </section>
  );
}
