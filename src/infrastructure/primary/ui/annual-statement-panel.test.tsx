import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnnualIncomeStatementDTO } from "@/application/movement/dto";

import { formatAmountCents } from "./format";
import { AnnualStatementPanel } from "./annual-statement-panel";

afterEach(cleanup);

const SPACE_CLASS = "[\\s\\u00A0\\u202F]";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toExactRe(text: string): RegExp {
  const escaped = escapeRegExp(text).replace(/\s/g, SPACE_CLASS);
  return new RegExp(`^${escaped}$`);
}

function amountRe(cents: number): RegExp {
  return toExactRe(formatAmountCents(cents));
}

function signedText(cents: number): string {
  if (cents > 0) return `+${formatAmountCents(cents)}`;
  if (cents < 0) return `\u2212${formatAmountCents(Math.abs(cents))}`;
  return formatAmountCents(0);
}

function signedRe(cents: number): RegExp {
  return toExactRe(signedText(cents));
}

function monthlyRow(monthlyCents: number, totalCents: number, averageCents: number) {
  return { monthlyCents: Array<number>(12).fill(monthlyCents), totalCents, averageCents };
}

function statementDTO(overrides: Partial<AnnualIncomeStatementDTO> = {}): AnnualIncomeStatementDTO {
  const emptySummary = {
    incomeTotalCents: 0,
    expenseTotalCents: 0,
    sharedExpenseCents: 0,
    personalExpenseCents: 0,
    monthBalanceCents: 0,
    tagBreakdown: [],
    memberBreakdown: [],
  };

  return {
    monthlySummaries: Array.from({ length: 12 }, () => ({ ...emptySummary })),
    memberIncomeRows: [
      {
        memberId: 10,
        memberName: "Miembro A",
        monthlyIncomeCents: [210_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        totalCents: 210_000,
        averageCents: 17_500,
      },
      {
        memberId: 20,
        memberName: "Miembro B",
        monthlyIncomeCents: [160_000, 0, 0, 0, 0, 0, 160_000, 0, 0, 0, 0, 0],
        totalCents: 320_000,
        averageCents: Math.round(320_000 / 12),
      },
      {
        memberId: null,
        memberName: null,
        monthlyIncomeCents: [192_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        totalCents: 192_000,
        averageCents: 16_000,
      },
    ],
    totalIncomeRow: {
      monthlyCents: [562_000, 0, 0, 0, 0, 0, 160_000, 0, 0, 0, 0, 0],
      totalCents: 722_000,
      averageCents: Math.round(722_000 / 12),
    },
    expenseRealRow: {
      monthlyCents: [91_000, 0, 0, 0, 0, 0, 306_000, 0, 0, 0, 0, 0],
      totalCents: 397_000,
      averageCents: Math.round(397_000 / 12),
    },
    noPersonalExpenseRow: {
      monthlyCents: [85_000, 0, 0, 0, 0, 0, 306_000, 0, 0, 0, 0, 0],
      totalCents: 391_000,
      averageCents: Math.round(391_000 / 12),
    },
    balanceRow: {
      monthlyCents: [471_000, 0, 0, 0, 0, 0, -146_000, 0, 0, 0, 0, 0],
      totalCents: 325_000,
      averageCents: Math.round(325_000 / 12),
    },
    accumulatedBalanceRow: {
      monthlyCents: [471_000, 471_000, 471_000, 471_000, 471_000, 471_000, 325_000, 325_000, 325_000, 325_000, 325_000, 325_000],
      totalCents: 325_000,
    },
    tagRows: [
      {
        tagId: 4,
        tagName: "Alimentación",
        monthlyCents: [0, 0, 0, 0, 0, 0, 306_000, 0, 0, 0, 0, 0],
        totalCents: 306_000,
        averageCents: Math.round(306_000 / 12),
      },
      {
        tagId: 1,
        tagName: "Vivienda",
        monthlyCents: [85_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        totalCents: 85_000,
        averageCents: Math.round(85_000 / 12),
      },
      {
        tagId: 2,
        tagName: "Hipoteca",
        monthlyCents: [85_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        totalCents: 85_000,
        averageCents: Math.round(85_000 / 12),
      },
    ],
    ...overrides,
  };
}

function monthlyTable() {
  const heading = screen.getByRole("heading", { name: "Cuenta de resultados de 2026" });
  const section = heading.closest("section");
  expect(section).not.toBeNull();
  return within(section as HTMLElement);
}

function tagTable() {
  const heading = screen.getByRole("heading", { name: "Desglose de gastos por tag" });
  const section = heading.closest("section");
  expect(section).not.toBeNull();
  return within(section as HTMLElement);
}

describe("AnnualStatementPanel", () => {
  it("muestra el título único con el año y las cabeceras Ene–Dic + Total año + Media mensual", () => {
    render(<AnnualStatementPanel statement={statementDTO()} year="2026" />);

    expect(
      screen.getByRole("heading", { name: "Cuenta de resultados de 2026" })
    ).toBeVisible();

    const table = monthlyTable();
    const headers = table.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual([
      "Concepto",
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
      "Total año", "Media mensual",
    ]);
  });

  it("renderiza las filas de miembros, Cuenta común y totales en orden fijo", () => {
    render(<AnnualStatementPanel statement={statementDTO()} year="2026" />);

    const table = monthlyTable();
    const rowLabels = table
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("th")?.textContent);

    expect(rowLabels).toEqual([
      "Miembro A",
      "Miembro B",
      "Cuenta común",
      "Total ingresos",
      "Gasto real",
      "Sin gastos personales",
      "Saldo",
      "Saldo acumulado",
    ]);
  });

  it("formatea los importes por miembro en es-ES con ceros explícitos en meses vacíos", () => {
    render(<AnnualStatementPanel statement={statementDTO()} year="2026" />);

    const table = monthlyTable();
    const memberARow = table.getByRole("row", { name: /Miembro A/ });
    expect(within(memberARow).getAllByText(amountRe(210_000))).toHaveLength(2);
    expect(within(memberARow).getAllByText(amountRe(0))).toHaveLength(11);
    expect(within(memberARow).getAllByText(amountRe(17_500))).toHaveLength(1);

    const commonRow = table.getByRole("row", { name: /Cuenta común/ });
    expect(within(commonRow).getAllByText(amountRe(192_000))).toHaveLength(2);
  });

  it("muestra los saldos con signo +/− y el cero sin signo", () => {
    render(<AnnualStatementPanel statement={statementDTO()} year="2026" />);

    const table = monthlyTable();
    const balanceRow = table.getByRole("row", { name: /^Saldo\s+\+/ });
    expect(within(balanceRow).getByText(signedRe(471_000))).toBeVisible();
    expect(within(balanceRow).getByText(signedRe(-146_000))).toBeVisible();
    expect(within(balanceRow).getAllByText(signedRe(0))).toHaveLength(10);
  });

  it("la fila Saldo acumulado no muestra media y su total es el total anual de Saldo", () => {
    render(<AnnualStatementPanel statement={statementDTO()} year="2026" />);

    const table = monthlyTable();
    const accumulatedRow = table.getByRole("row", { name: /Saldo acumulado/ });
    const cells = within(accumulatedRow).getAllByRole("cell");
    expect(cells[cells.length - 1]).toHaveTextContent("—");
    expect(cells[cells.length - 2]).toHaveTextContent(signedRe(325_000));
  });

  it("la media mensual es total/12 redondeada al céntimo", () => {
    const statement = statementDTO({
      totalIncomeRow: { ...statementDTO().totalIncomeRow, ...monthlyRow(0, 2_100_000, 175_000) },
    });

    render(<AnnualStatementPanel statement={statement} year="2026" />);

    const table = monthlyTable();
    const totalRow = table.getByRole("row", { name: /Total ingresos/ });
    expect(within(totalRow).getAllByText(amountRe(175_000))).toHaveLength(1);
  });

  it("muestra el desglose por tag con sus filas de totales Gasto real y Sin gastos personales", () => {
    render(<AnnualStatementPanel statement={statementDTO()} year="2026" />);

    const table = tagTable();
    const rowLabels = table
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("th")?.textContent);

    expect(rowLabels).toEqual([
      "Alimentación",
      "Vivienda",
      "Hipoteca",
      "Gasto real",
      "Sin gastos personales",
    ]);

    const viviendaRow = table.getByRole("row", { name: /Vivienda/ });
    expect(within(viviendaRow).getAllByText(amountRe(85_000))).toHaveLength(2);
    expect(within(viviendaRow).getAllByText(amountRe(0))).toHaveLength(11);

    expect(screen.getByText(toExactRe(TAG_NOTE))).toBeVisible();
  });

  it("en un año sin gastos muestra 'Sin gastos este año.' sin ocultar la tabla mensual", () => {
    render(<AnnualStatementPanel statement={statementDTO({ tagRows: [] })} year="2026" />);

    expect(screen.getByText("Sin gastos este año.")).toBeVisible();
    expect(screen.queryByText(toExactRe(TAG_NOTE))).toBeNull();

    const table = monthlyTable();
    expect(table.getByRole("row", { name: /Total ingresos/ })).toBeVisible();
  });
});

const TAG_NOTE =
  "Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.";
