import type { MonthlyClosureDTO } from "@/application/movement/dto";

import { formatAmountCents, formatSignedCents, monthLabel } from "./format";

const TAG_NOTE =
  "Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.";

export function MonthlyClosurePanel({
  closure,
  month,
}: {
  closure: MonthlyClosureDTO;
  month: string;
}) {
  return (
    <section
      aria-labelledby="monthly-closure-title"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 id="monthly-closure-title" className="text-sm font-medium text-muted-foreground">
        Cierre de {monthLabel(month)}
      </h2>

      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Ingresos</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatAmountCents(closure.incomeTotalCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Gastos</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatAmountCents(closure.expenseTotalCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saldo del mes</dt>
          <dd
            className={`text-xl font-semibold tabular-nums ${closure.monthBalanceCents < 0 ? "text-red-600" : "text-foreground"}`}
          >
            {formatSignedCents(closure.monthBalanceCents)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground">Gastos compartidos: </span>
          {formatAmountCents(closure.sharedExpenseCents)}
        </p>
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground">Gastos personales: </span>
          {formatAmountCents(closure.personalExpenseCents)}
        </p>
      </div>

      <h3 className="mt-4 text-sm font-medium">Desglose por tag</h3>
      {closure.tagBreakdown.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Sin gastos este mes.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {closure.tagBreakdown.map((entry) => (
            <li key={entry.tagId} className="flex justify-between text-sm tabular-nums">
              <span>{entry.tagName}</span>
              <span>{formatAmountCents(entry.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{TAG_NOTE}</p>
    </section>
  );
}
