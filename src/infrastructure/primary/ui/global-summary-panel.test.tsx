import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { GlobalMonthlySummaryDTO } from "@/application/movement/dto";

import { formatAmountCents } from "./format";
import { GlobalSummaryPanel } from "./global-summary-panel";

afterEach(cleanup);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SPACE_CLASS = "[\\s\\u00A0\\u202F]";

function toExactRe(text: string): RegExp {
  const escaped = escapeRegExp(text).replace(/\s/g, SPACE_CLASS);
  return new RegExp(`^${escaped}$`);
}

function amountRe(cents: number): RegExp {
  return toExactRe(formatAmountCents(cents));
}

function normalizedAmount(cents: number): string {
  return formatAmountCents(cents).replace(/\s/g, " ");
}

function summaryDTO(overrides: Partial<GlobalMonthlySummaryDTO> = {}): GlobalMonthlySummaryDTO {
  return {
    incomeTotalCents: 210_000,
    expenseTotalCents: 106_050,
    sharedExpenseCents: 100_050,
    personalExpenseCents: 6_000,
    monthBalanceCents: 103_950,
    tagBreakdown: [
      { tagId: 2, tagName: "Hipoteca", amountCents: 85_000 },
      { tagId: 1, tagName: "Vivienda", amountCents: 85_000 },
      { tagId: 4, tagName: "Alimentación", amountCents: 15_050 },
      { tagId: 3, tagName: "Coche", amountCents: 6_000 },
    ],
    memberBreakdown: [
      { memberId: null, memberName: null, personalCents: 0, sharedCents: 85_000 },
      { memberId: 20, memberName: "Miembro B", personalCents: 0, sharedCents: 15_050 },
      { memberId: 10, memberName: "Miembro A", personalCents: 6_000, sharedCents: 0 },
    ],
    ...overrides,
  };
}

function memberTable() {
  const heading = screen.getByText("Desglose por miembro");
  const table = heading.parentElement?.querySelector("table");
  expect(table).not.toBeNull();
  return within(table as HTMLElement);
}

describe("GlobalSummaryPanel", () => {
  it("muestra el título único del panel con el mes seleccionado y los KPIs en es-ES", () => {
    render(<GlobalSummaryPanel summary={summaryDTO()} month="2026-09" />);

    expect(
      screen.getByRole("heading", { name: "Resumen global de Septiembre de 2026" }),
    ).toBeVisible();

    const kpis = screen.getByText("Ingresos").closest("dl");
    expect(kpis).not.toBeNull();
    const kpiValues = within(kpis as HTMLElement);
    expect(kpiValues.getByText(amountRe(210_000))).toBeVisible();
    expect(kpiValues.getByText(amountRe(106_050))).toBeVisible();
    expect(kpiValues.getByText(toExactRe(formatSigned(103_950)))).toBeVisible();

    expect(
      screen.getByText(/^Gastos compartidos:/).closest("p"),
    ).toHaveTextContent(`Gastos compartidos: ${normalizedAmount(100_050)}`);
    expect(
      screen.getByText(/^Gastos personales:/).closest("p"),
    ).toHaveTextContent(`Gastos personales: ${normalizedAmount(6_000)}`);
  });

  it("muestra el desglose por tag en orden de importe con la nota multi-tag", () => {
    render(<GlobalSummaryPanel summary={summaryDTO()} month="2026-09" />);

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      `Hipoteca${formatAmountCents(85_000)}`,
      `Vivienda${formatAmountCents(85_000)}`,
      `Alimentación${formatAmountCents(15_050)}`,
      `Coche${formatAmountCents(6_000)}`,
    ]);

    expect(
      screen.getByText(
        "Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.",
      ),
    ).toBeVisible();
  });

  it("renderiza el desglose por miembro como tabla semántica con cabeceras de columna", () => {
    render(<GlobalSummaryPanel summary={summaryDTO()} month="2026-09" />);

    const table = memberTable();
    expect(table.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Miembro",
      "personales",
      "compartidos",
    ]);
  });

  it("muestra la fila 'Cuenta común' para memberId null y una fila por miembro", () => {
    render(<GlobalSummaryPanel summary={summaryDTO()} month="2026-09" />);

    const table = memberTable();
    expect(table.getAllByRole("row")).toHaveLength(4);

    const commonRow = table.getByRole("row", { name: /Cuenta común/ });
    expect(within(commonRow).getByText(amountRe(0))).toBeVisible();
    expect(within(commonRow).getByText(amountRe(85_000))).toBeVisible();

    const memberARow = table.getByRole("row", { name: /Miembro A/ });
    expect(within(memberARow).getAllByText(amountRe(6_000))).toHaveLength(1);
    expect(within(memberARow).getAllByText(amountRe(0))).toHaveLength(1);
  });

  it("muestra miembros homónimos como filas distintas y sin filas sin gastos", () => {
    render(
      <GlobalSummaryPanel
        summary={summaryDTO({
          memberBreakdown: [
            { memberId: 20, memberName: "Alex", personalCents: 0, sharedCents: 9_000 },
            { memberId: 10, memberName: "Alex", personalCents: 6_000, sharedCents: 0 },
          ],
        })}
        month="2026-09"
      />,
    );

    const table = memberTable();
    expect(table.getAllByRole("row", { name: /Alex/ })).toHaveLength(2);
    expect(table.queryByRole("row", { name: /Cuenta común/ })).toBeNull();
    expect(table.getAllByRole("row")).toHaveLength(3);
  });

  it("respeta el orden del desglose por miembro (total desc, nombre asc, común al final)", () => {
    render(<GlobalSummaryPanel summary={summaryDTO()} month="2026-09" />);

    const rows = memberTable()
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("th")?.textContent);
    expect(rows).toEqual(["Cuenta común", "Miembro B", "Miembro A"]);
  });

  it("en un mes sin movimientos muestra KPIs a cero, saldo sin signo y ambos desgloses vacíos", () => {
    render(
      <GlobalSummaryPanel
        summary={summaryDTO({
          incomeTotalCents: 0,
          expenseTotalCents: 0,
          sharedExpenseCents: 0,
          personalExpenseCents: 0,
          monthBalanceCents: 0,
          tagBreakdown: [],
          memberBreakdown: [],
        })}
        month="2026-08"
      />,
    );

    expect(screen.getByRole("heading", { name: "Resumen global de Agosto de 2026" })).toBeVisible();
    expect(screen.getAllByText(amountRe(0))).toHaveLength(5);
    expect(screen.getAllByText("Sin gastos este mes.")).toHaveLength(2);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("muestra saldo negativo con signo menos contable y cero sin signo", () => {
    const { rerender } = render(
      <GlobalSummaryPanel summary={summaryDTO({ monthBalanceCents: -51_200 })} month="2026-09" />,
    );
    expect(screen.getByText(toExactRe(`\u2212${formatAmountCents(51_200)}`))).toBeVisible();

    rerender(<GlobalSummaryPanel summary={summaryDTO({ monthBalanceCents: 0 })} month="2026-09" />);
    const kpis = screen.getByText("Ingresos").closest("dl");
    expect(kpis).not.toBeNull();
    expect(within(kpis as HTMLElement).getByText(amountRe(0))).toBeVisible();
  });
});

function formatSigned(cents: number): string {
  if (cents > 0) return `+${formatAmountCents(cents)}`;
  if (cents < 0) return `\u2212${formatAmountCents(Math.abs(cents))}`;
  return formatAmountCents(0);
}
