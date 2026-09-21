import type { GlobalMonthlySummaryDTO } from "@/application/movement/dto";

import { formatAmountCents, formatSignedCents, monthLabel } from "./format";

const TAG_NOTE =
  "Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.";

export function GlobalSummaryPanel({
  summary,
  month,
}: {
  summary: GlobalMonthlySummaryDTO;
  month: string;
}) {
  return (
    <section
      aria-labelledby="global-summary-title"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 id="global-summary-title" className="text-sm font-medium text-muted-foreground">
        Resumen global de {monthLabel(month)}
      </h2>

      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Ingresos</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatAmountCents(summary.incomeTotalCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Gastos</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatAmountCents(summary.expenseTotalCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saldo del mes</dt>
          <dd
            className={`text-xl font-semibold tabular-nums ${summary.monthBalanceCents < 0 ? "text-red-600" : "text-foreground"}`}
          >
            {formatSignedCents(summary.monthBalanceCents)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground">Gastos compartidos: </span>
          {formatAmountCents(summary.sharedExpenseCents)}
        </p>
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground">Gastos personales: </span>
          {formatAmountCents(summary.personalExpenseCents)}
        </p>
      </div>

      <h3 className="mt-4 text-sm font-medium">Desglose por tag</h3>
      {summary.tagBreakdown.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Sin gastos este mes.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {summary.tagBreakdown.map((entry) => (
            <li key={entry.tagId} className="flex justify-between text-sm tabular-nums">
              <span>{entry.tagName}</span>
              <span>{formatAmountCents(entry.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{TAG_NOTE}</p>

      <h3 className="mt-4 text-sm font-medium">Desglose por miembro</h3>
      {summary.memberBreakdown.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Sin gastos este mes.</p>
      ) : (
        <table className="mt-1 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-2 font-medium">
                <span className="sr-only">Miembro</span>
              </th>
              <th scope="col" className="py-1 px-2 text-right font-medium">
                personales
              </th>
              <th scope="col" className="py-1 pl-2 text-right font-medium">
                compartidos
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.memberBreakdown.map((entry) => (
              <tr
                key={entry.memberId === null ? "common" : entry.memberId}
                className="border-t border-border"
              >
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  {entry.memberName ?? "Cuenta común"}
                </th>
                <td className="py-1.5 px-2 text-right">{formatAmountCents(entry.personalCents)}</td>
                <td className="py-1.5 pl-2 text-right">{formatAmountCents(entry.sharedCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
