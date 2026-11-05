import type { AnnualCategoryExpenseReportDTO } from "@/application/movement/dto";

import { formatAmountCents, MONTH_SHORT_LABELS } from "./format";

const CELL_CLASS = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
const ROW_HEADER_CLASS = "py-1.5 pr-2 text-left font-normal whitespace-nowrap";
const COL_HEADER_CLASS = "px-2 py-1 text-right font-medium whitespace-nowrap";
const TOTAL_ROW_HEADER_CLASS = `${ROW_HEADER_CLASS} font-medium`;

export function AnnualCategoryExpenseReportTable({
  report,
}: {
  report: AnnualCategoryExpenseReportDTO;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-max text-sm"
        aria-label={`Informe de gastos por categoría de ${report.year}`}
      >
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1 pr-2 font-medium">
              Categoría
            </th>
            {MONTH_SHORT_LABELS.map((label) => (
              <th key={label} scope="col" className={COL_HEADER_CLASS}>
                {label}
              </th>
            ))}
            <th scope="col" className={COL_HEADER_CLASS}>
              Media anual
            </th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.categoryId} className="border-t border-border">
              <th scope="row" className={ROW_HEADER_CLASS}>
                {row.categoryName}
              </th>
              {row.monthlyAmountCents.map((cents, month) => (
                <td key={month} className={CELL_CLASS}>
                  {formatAmountCents(cents)}
                </td>
              ))}
              <td className={CELL_CLASS}>{formatAmountCents(row.annualAverageCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <th scope="row" className={TOTAL_ROW_HEADER_CLASS}>
              Gasto mensual
            </th>
            {report.monthlyTotalCents.map((cents, month) => (
              <td key={month} className={CELL_CLASS}>
                {formatAmountCents(cents)}
              </td>
            ))}
            <td className={CELL_CLASS}>{formatAmountCents(report.monthlyTotalAverageCents)}</td>
          </tr>
          <tr className="border-t border-border">
            <th scope="row" className={TOTAL_ROW_HEADER_CLASS}>
              Gastos personales
            </th>
            {report.monthlyPersonalTotalCents.map((cents, month) => (
              <td key={month} className={CELL_CLASS}>
                {formatAmountCents(cents)}
              </td>
            ))}
            <td className={CELL_CLASS}>{formatAmountCents(report.personalTotalAverageCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
