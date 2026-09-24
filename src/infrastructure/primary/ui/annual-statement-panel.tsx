import type { AnnualIncomeStatementDTO } from "@/application/movement/dto";

import { formatAmountCents, formatSignedCents, MONTH_SHORT_LABELS } from "./format";

const TAG_NOTE =
  "Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.";

const CELL_CLASS = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
const ROW_HEADER_CLASS = "py-1.5 pr-2 text-left font-normal whitespace-nowrap";
const COL_HEADER_CLASS = "px-2 py-1 text-right font-medium whitespace-nowrap";

function HeaderColumns() {
  return (
    <>
      {MONTH_SHORT_LABELS.map((label) => (
        <th key={label} scope="col" className={COL_HEADER_CLASS}>
          {label}
        </th>
      ))}
      <th scope="col" className={COL_HEADER_CLASS}>
        Total año
      </th>
      <th scope="col" className={COL_HEADER_CLASS}>
        Media mensual
      </th>
    </>
  );
}

function AmountCells({ monthlyCents, totalCents, averageCents }: {
  monthlyCents: number[];
  totalCents: number;
  averageCents: number | null;
}) {
  return (
    <>
      {monthlyCents.map((cents, month) => (
        <td key={month} className={CELL_CLASS}>
          {formatAmountCents(cents)}
        </td>
      ))}
      <td className={CELL_CLASS}>{formatAmountCents(totalCents)}</td>
      <td className={CELL_CLASS}>
        {averageCents === null ? "—" : formatAmountCents(averageCents)}
      </td>
    </>
  );
}

function SignedCells({ monthlyCents, totalCents, averageCents }: {
  monthlyCents: number[];
  totalCents: number;
  averageCents: number | null;
}) {
  return (
    <>
      {monthlyCents.map((cents, month) => (
        <td key={month} className={CELL_CLASS}>
          {formatSignedCents(cents)}
        </td>
      ))}
      <td className={CELL_CLASS}>{formatSignedCents(totalCents)}</td>
      <td className={CELL_CLASS}>
        {averageCents === null ? "—" : formatSignedCents(averageCents)}
      </td>
    </>
  );
}

export function AnnualStatementPanel({
  statement,
  year,
}: {
  statement: AnnualIncomeStatementDTO;
  year: string;
}) {
  const hasExpenses = statement.tagRows.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="annual-statement-title"
        className="rounded-lg border bg-card p-4 text-card-foreground"
      >
        <h2 id="annual-statement-title" className="text-sm font-medium text-muted-foreground">
          Cuenta de resultados de {year}
        </h2>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">Cuenta de resultados anual por mes</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-medium">
                  <span className="sr-only">Concepto</span>
                </th>
                <HeaderColumns />
              </tr>
            </thead>
            <tbody>
              {statement.memberIncomeRows.map((row) => (
                <tr
                  key={row.memberId === null ? "common" : row.memberId}
                  className="border-t border-border"
                >
                  <th scope="row" className={ROW_HEADER_CLASS}>
                    {row.memberName ?? "Cuenta común"}
                  </th>
                  <AmountCells
                    monthlyCents={row.monthlyIncomeCents}
                    totalCents={row.totalCents}
                    averageCents={row.averageCents}
                  />
                </tr>
              ))}
              <tr className="border-t border-border">
                <th scope="row" className={`${ROW_HEADER_CLASS} font-medium`}>
                  Total ingresos
                </th>
                <AmountCells {...statement.totalIncomeRow} />
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className={ROW_HEADER_CLASS}>
                  Gasto real
                </th>
                <AmountCells {...statement.expenseRealRow} />
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className={ROW_HEADER_CLASS}>
                  Sin gastos personales
                </th>
                <AmountCells {...statement.noPersonalExpenseRow} />
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className={ROW_HEADER_CLASS}>
                  Saldo
                </th>
                <SignedCells {...statement.balanceRow} />
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className={ROW_HEADER_CLASS}>
                  Saldo acumulado
                </th>
                <SignedCells
                  monthlyCents={statement.accumulatedBalanceRow.monthlyCents}
                  totalCents={statement.accumulatedBalanceRow.totalCents}
                  averageCents={null}
                />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="annual-tag-breakdown-title"
        className="rounded-lg border bg-card p-4 text-card-foreground"
      >
        <h2 id="annual-tag-breakdown-title" className="text-sm font-medium text-muted-foreground">
          Desglose de gastos por tag
        </h2>

        {hasExpenses ? (
          <>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">Desglose de gastos por tag y mes</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1 pr-2 font-medium">
                      <span className="sr-only">Tag</span>
                    </th>
                    <HeaderColumns />
                  </tr>
                </thead>
                <tbody>
                  {statement.tagRows.map((row) => (
                    <tr key={row.tagId} className="border-t border-border">
                      <th scope="row" className={ROW_HEADER_CLASS}>
                        {row.tagName}
                      </th>
                      <AmountCells
                        monthlyCents={row.monthlyCents}
                        totalCents={row.totalCents}
                        averageCents={row.averageCents}
                      />
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <th scope="row" className={ROW_HEADER_CLASS}>
                      Gasto real
                    </th>
                    <AmountCells {...statement.expenseRealRow} />
                  </tr>
                  <tr className="border-t border-border">
                    <th scope="row" className={ROW_HEADER_CLASS}>
                      Sin gastos personales
                    </th>
                    <AmountCells {...statement.noPersonalExpenseRow} />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{TAG_NOTE}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Sin gastos este año.</p>
        )}
      </section>
    </div>
  );
}
