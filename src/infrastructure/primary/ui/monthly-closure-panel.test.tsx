import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MonthlyClosureDTO } from "@/application/movement/dto";

import { formatAmountCents } from "./format";
import { MonthlyClosurePanel } from "./monthly-closure-panel";

afterEach(cleanup);

const EUR = "[\\s\\u00A0\\u202F]€$";

function closureDTO(overrides: Partial<MonthlyClosureDTO> = {}): MonthlyClosureDTO {
  return {
    incomeTotalCents: 192_000,
    expenseTotalCents: 97_050,
    sharedExpenseCents: 97_050,
    personalExpenseCents: 0,
    monthBalanceCents: 94_950,
    tagBreakdown: [
      { tagId: 2, tagName: "Hipoteca", amountCents: 85_000 },
      { tagId: 1, tagName: "Vivienda", amountCents: 85_000 },
      { tagId: 3, tagName: "Hogar", amountCents: 12_050 },
    ],
    ...overrides,
  };
}

describe("MonthlyClosurePanel", () => {
  it("muestra el título con el mes seleccionado y los KPIs formateados en es-ES", () => {
    render(<MonthlyClosurePanel closure={closureDTO()} month="2026-09" />);

    expect(screen.getByRole("heading", { name: "Cierre de Septiembre de 2026" })).toBeVisible();

    const kpis = screen.getByText("Ingresos").closest("dl");
    expect(kpis).not.toBeNull();
    const kpiValues = within(kpis as HTMLElement);
    expect(kpiValues.getByText(new RegExp(`^1920,00${EUR}`))).toBeVisible();
    expect(kpiValues.getByText(new RegExp(`^970,50${EUR}`))).toBeVisible();
    expect(kpiValues.getByText(new RegExp(`^\\+949,50${EUR}`))).toBeVisible();
  });

  it("muestra el desglose por naturaleza y por tag en orden de importe descendente", () => {
    render(<MonthlyClosurePanel closure={closureDTO()} month="2026-09" />);

    expect(screen.getByText(/^Gastos compartidos:/)).toBeVisible();
    expect(screen.getByText(/^Gastos personales:/)).toBeVisible();

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      `Hipoteca${formatAmountCents(85_000)}`,
      `Vivienda${formatAmountCents(85_000)}`,
      `Hogar${formatAmountCents(12_050)}`,
    ]);
  });

  it("incluye la nota informativa del desglose multi-tag", () => {
    render(<MonthlyClosurePanel closure={closureDTO()} month="2026-09" />);

    expect(
      screen.getByText(
        "Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.",
      ),
    ).toBeVisible();
  });

  it("muestra saldo negativo con signo menos contable", () => {
    render(
      <MonthlyClosurePanel closure={closureDTO({ monthBalanceCents: -5_120 })} month="2026-09" />,
    );

    expect(screen.getByText(new RegExp(`^\u221251,20${EUR}`))).toBeVisible();
  });

  it("en un mes con ingresos pero sin gastos muestra gastos a cero y desglose vacío", () => {
    render(
      <MonthlyClosurePanel
        closure={closureDTO({
          expenseTotalCents: 0,
          sharedExpenseCents: 0,
          personalExpenseCents: 0,
          monthBalanceCents: 192_000,
          tagBreakdown: [],
        })}
        month="2026-09"
      />,
    );

    expect(screen.getByText(new RegExp(`^1920,00${EUR}`))).toBeVisible();
    expect(screen.getAllByText(new RegExp(`^0,00${EUR}`))).toHaveLength(3);
    expect(screen.getByText("Sin gastos este mes.")).toBeVisible();
  });

  it("en un mes sin movimientos muestra todos los KPIs a cero sin signo en el saldo", () => {
    render(
      <MonthlyClosurePanel
        closure={closureDTO({
          incomeTotalCents: 0,
          expenseTotalCents: 0,
          sharedExpenseCents: 0,
          personalExpenseCents: 0,
          monthBalanceCents: 0,
          tagBreakdown: [],
        })}
        month="2026-08"
      />,
    );

    expect(screen.getByRole("heading", { name: "Cierre de Agosto de 2026" })).toBeVisible();
    expect(screen.getAllByText(new RegExp(`^0,00${EUR}`))).toHaveLength(5);
    expect(screen.getByText("Sin gastos este mes.")).toBeVisible();
  });
});
