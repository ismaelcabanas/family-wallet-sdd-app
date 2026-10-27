import type { MonthNetContributionDTO } from "@/application/common-contribution/GetMonthNetContribution";
import type { MonthSavingsDTO } from "@/application/savings/GetMonthSavings";

import { formatAmountCents, formatSignedCents, monthLabel } from "./format";

export function AccountMonthKpis({
  netContribution,
  savings,
  netMonthBalanceCents,
  month,
}: {
  netContribution: MonthNetContributionDTO;
  savings: MonthSavingsDTO;
  netMonthBalanceCents: number;
  month: string;
}) {
  return (
    <section
      aria-labelledby="account-month-kpis-title"
      className="sticky top-0 z-20 -mx-4 bg-background px-4 sm:-mx-6 sm:px-6"
    >
      <div className="rounded-lg border bg-card p-4 text-card-foreground">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="account-month-kpis-title" className="text-sm font-medium text-muted-foreground">
            KPIs del mes
          </h2>
          <p className="text-xs text-muted-foreground">{monthLabel(month)}</p>
        </div>

        <dl className="mt-2 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Aportación común</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {formatAmountCents(netContribution.amountCents)}
            </dd>
            {netContribution.configured ? null : (
              <p className="text-xs text-muted-foreground">Sin aportación configurada</p>
            )}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ahorro del mes</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {formatAmountCents(savings.amountCents)}
            </dd>
            {savings.configured ? null : (
              <p className="text-xs text-muted-foreground">Sin ahorro configurado</p>
            )}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Saldo del mes</dt>
            <dd
              className={`text-xl font-semibold tabular-nums ${netMonthBalanceCents < 0 ? "text-red-600" : "text-foreground"}`}
            >
              {formatSignedCents(netMonthBalanceCents)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
