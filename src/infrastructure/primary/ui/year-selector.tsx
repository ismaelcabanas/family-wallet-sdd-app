"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { buildYearWindow } from "./format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

const YEAR_RADIUS = 6;

export function YearSelector({ year }: { year: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const years = buildYearWindow(year, YEAR_RADIUS);

  const navigate = (nextYear: string) => {
    startTransition(() => {
      router.replace(`/annual?year=${nextYear}`);
    });
  };

  return (
    <section
      aria-label="Selección de año"
      className={`flex flex-wrap items-center gap-3 ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="year-selector" className="text-sm font-medium">
          Año
        </label>
        <Select value={year} onValueChange={navigate}>
          <SelectTrigger id="year-selector" className="w-48" aria-label="Año visible">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((option) => (
              <SelectItem key={option} value={option}>
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
