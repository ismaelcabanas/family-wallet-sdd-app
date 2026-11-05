import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnnualCategoryExpenseReportDTO } from "@/application/movement/dto";

import { formatAmountCents, MONTH_SHORT_LABELS } from "./format";
import { AnnualCategoryExpenseReportTable } from "./annual-expense-report-table";

afterEach(cleanup);

const SPACE_CLASS = "[\\s\\u00A0\\u202F]";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function amountRe(cents: number): RegExp {
  const escaped = escapeRegExp(formatAmountCents(cents)).replace(/\s/g, SPACE_CLASS);
  return new RegExp(`^${escaped}$`);
}

function reportDTO(overrides: Partial<AnnualCategoryExpenseReportDTO> = {}): AnnualCategoryExpenseReportDTO {
  return {
    year: "2026",
    rows: [
      {
        categoryId: 1,
        categoryName: "General",
        monthlyAmountCents: [15_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        annualTotalCents: 15_000,
        annualAverageCents: 1_250,
      },
      {
        categoryId: 2,
        categoryName: "Suscripciones",
        monthlyAmountCents: [0, 0, 0, 0, 0, 0, 7_000, 0, 0, 0, 0, 0],
        annualTotalCents: 7_000,
        annualAverageCents: Math.round(7_000 / 12),
      },
    ],
    monthlyTotalCents: [15_000, 0, 0, 0, 0, 0, 7_000, 0, 0, 0, 0, 0],
    monthlyPersonalTotalCents: [9_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    monthlyTotalAverageCents: Math.round(22_000 / 12),
    personalTotalAverageCents: 750,
    ...overrides,
  };
}

describe("AnnualCategoryExpenseReportTable", () => {
  it("renderiza la tabla accesible con el año del informe", () => {
    render(<AnnualCategoryExpenseReportTable report={reportDTO()} />);

    expect(
      screen.getByRole("table", { name: "Informe de gastos por categoría de 2026" }),
    ).toBeInTheDocument();
  });

  it("muestra la cabecera con Categoría, los 12 meses cortos y Media anual", () => {
    render(<AnnualCategoryExpenseReportTable report={reportDTO()} />);

    const table = screen.getByRole("table", { name: "Informe de gastos por categoría de 2026" });
    const columnHeaders = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(columnHeaders).toEqual(["Categoría", ...MONTH_SHORT_LABELS, "Media anual"]);
  });

  it("renderiza una fila por categoría en el orden del DTO con sus importes formateados", () => {
    render(<AnnualCategoryExpenseReportTable report={reportDTO()} />);

    const table = screen.getByRole("table", { name: "Informe de gastos por categoría de 2026" });
    const bodyRows = within(table).getAllByRole("row").slice(1, 3);

    expect(bodyRows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      "General",
      "Suscripciones",
    ]);

    const general = bodyRows[0];
    const generalCells = within(general).getAllByRole("cell");
    expect(generalCells).toHaveLength(13);
    expect(generalCells[0]).toHaveTextContent(amountRe(15_000));
    expect(generalCells[1]).toHaveTextContent(amountRe(0));
    expect(generalCells[12]).toHaveTextContent(amountRe(1_250));

    const suscripciones = bodyRows[1];
    const suscripcionesCells = within(suscripciones).getAllByRole("cell");
    expect(suscripcionesCells[6]).toHaveTextContent(amountRe(7_000));
    expect(suscripcionesCells[12]).toHaveTextContent(amountRe(Math.round(7_000 / 12)));
  });

  it("renderiza las dos filas de totales en el pie de tabla con sus medias", () => {
    render(<AnnualCategoryExpenseReportTable report={reportDTO()} />);

    const table = screen.getByRole("table", { name: "Informe de gastos por categoría de 2026" });

    const monthlyTotal = within(table).getByRole("row", { name: /^Gasto mensual/ });
    expect(within(monthlyTotal).getAllByRole("cell")[0]).toHaveTextContent(amountRe(15_000));
    expect(within(monthlyTotal).getAllByRole("cell")[12]).toHaveTextContent(
      amountRe(Math.round(22_000 / 12)),
    );

    const personal = within(table).getByRole("row", { name: /^Gastos personales/ });
    expect(within(personal).getAllByRole("cell")[0]).toHaveTextContent(amountRe(9_000));
    expect(within(personal).getAllByRole("cell")[12]).toHaveTextContent(amountRe(750));
  });

  it("envuelve la tabla en un contenedor con scroll horizontal", () => {
    render(<AnnualCategoryExpenseReportTable report={reportDTO()} />);

    const table = screen.getByRole("table", { name: "Informe de gastos por categoría de 2026" });
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });
});
