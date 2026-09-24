import { describe, expect, it } from "vitest";

import type { SummaryAccountRef } from "./GlobalMonthlySummary";
import { GlobalMonthlySummary } from "./GlobalMonthlySummary";
import type { AnnualStatementMovementInput, MemberRef } from "./AnnualIncomeStatement";
import { AnnualIncomeStatement } from "./AnnualIncomeStatement";

function movement(
  input: Partial<Omit<AnnualStatementMovementInput, "accountId" | "date">> & {
    accountId?: number;
    date?: string;
  } = {},
): AnnualStatementMovementInput {
  return {
    type: "expense",
    nature: "shared",
    amountCents: 1_000,
    tags: [{ id: 1, name: "Hogar" }],
    accountId: 3,
    date: "2026-01-15",
    ...input,
  };
}

function account(ref: Partial<SummaryAccountRef> = {}): SummaryAccountRef {
  return { id: 3, type: "shared", memberId: null, memberName: null, ...ref };
}

const accounts: SummaryAccountRef[] = [
  account({ id: 1, type: "personal", memberId: 10, memberName: "Miembro A" }),
  account({ id: 2, type: "personal", memberId: 20, memberName: "Miembro B" }),
  account({ id: 3, type: "shared" }),
];

const members: MemberRef[] = [
  { id: 10, name: "Miembro A" },
  { id: 20, name: "Miembro B" },
];

const yearTresCuentas: AnnualStatementMovementInput[] = [
  movement({
    accountId: 1,
    type: "income",
    nature: null,
    amountCents: 210_000,
    date: "2026-01-05",
    tags: [{ id: 9, name: "Nómina" }],
  }),
  movement({
    accountId: 2,
    type: "income",
    nature: null,
    amountCents: 160_000,
    date: "2026-01-05",
  }),
  movement({
    accountId: 3,
    type: "income",
    nature: null,
    amountCents: 192_000,
    date: "2026-01-03",
  }),
  movement({
    accountId: 3,
    amountCents: 85_000,
    date: "2026-01-05",
    tags: [{ id: 4, name: "Vivienda" }, { id: 5, name: "Hipoteca" }],
  }),
  movement({
    accountId: 1,
    nature: "personal",
    amountCents: 6_000,
    date: "2026-01-10",
    tags: [{ id: 6, name: "Coche" }],
  }),
  movement({
    accountId: 2,
    amountCents: 306_000,
    date: "2026-07-12",
    tags: [{ id: 9, name: "Alimentación" }],
  }),
  movement({
    accountId: 2,
    type: "income",
    nature: null,
    amountCents: 160_000,
    date: "2026-07-05",
  }),
];

function cellCents(monthCells: readonly { amountCents: number }[]): number[] {
  return monthCells.map((cell) => cell.amountCents);
}

describe("AnnualIncomeStatement", () => {
  it("compone 12 resúmenes y los KPIs de cada mes son los del resumen global de ese mes (FR-006)", () => {
    const statement = AnnualIncomeStatement.fromMovements(yearTresCuentas, accounts, members);

    expect(statement.monthlySummaries).toHaveLength(12);

    for (let month = 0; month < 12; month += 1) {
      const monthKey = `2026-${String(month + 1).padStart(2, "0")}`;
      const monthInputs = yearTresCuentas.filter((input) => input.date.startsWith(monthKey));
      const expected = GlobalMonthlySummary.fromMovements(monthInputs, accounts);
      const actual = statement.monthlySummaries[month];

      expect(actual.incomeTotal.amountCents).toBe(expected.incomeTotal.amountCents);
      expect(actual.expenseTotal.amountCents).toBe(expected.expenseTotal.amountCents);
      expect(actual.sharedExpenseTotal.amountCents).toBe(expected.sharedExpenseTotal.amountCents);
      expect(actual.personalExpenseTotal.amountCents).toBe(expected.personalExpenseTotal.amountCents);
      expect(actual.monthBalance.amountCents).toBe(expected.monthBalance.amountCents);
      expect([...actual.tagBreakdown]).toEqual([...expected.tagBreakdown]);
    }
  });

  it("construye un resumen a ceros para cada mes sin movimientos", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [movement({ date: "2026-03-10" })],
      accounts,
      members,
    );

    const february = statement.monthlySummaries[1];
    expect(february.incomeTotal.amountCents).toBe(0);
    expect(february.expenseTotal.amountCents).toBe(0);
    expect(february.monthBalance.amountCents).toBe(0);
    expect(february.tagBreakdown).toEqual([]);
  });

  it("atribuye los ingresos al dueño de la cuenta de registro y los comunes a la fila null", () => {
    const statement = AnnualIncomeStatement.fromMovements(yearTresCuentas, accounts, members);

    expect(statement.memberIncomeRows.map((row) => row.memberId)).toEqual([10, 20, null]);
    expect(statement.memberIncomeRows.map((row) => row.memberName)).toEqual([
      "Miembro A",
      "Miembro B",
      null,
    ]);

    const memberA = statement.memberIncomeRows[0];
    expect(cellCents(memberA.monthCells)[0]).toBe(210_000);
    expect(memberA.totalCents).toBe(210_000);
    expect(memberA.averageCents).toBe(Math.round(210_000 / 12));

    const memberB = statement.memberIncomeRows[1];
    expect(cellCents(memberB.monthCells)[0]).toBe(160_000);
    expect(cellCents(memberB.monthCells)[6]).toBe(160_000);
    expect(memberB.totalCents).toBe(320_000);

    const common = statement.memberIncomeRows[2];
    expect(cellCents(common.monthCells)[0]).toBe(192_000);
    expect(common.totalCents).toBe(192_000);
  });

  it("la suma de las filas de ingresos equivale al total de ingresos de cada mes (FR-002)", () => {
    const statement = AnnualIncomeStatement.fromMovements(yearTresCuentas, accounts, members);

    for (let month = 0; month < 12; month += 1) {
      const rowsTotal = statement.memberIncomeRows.reduce(
        (sum, row) => sum + cellCents(row.monthCells)[month],
        0,
      );
      expect(rowsTotal).toBe(statement.totalIncomeRow.monthCells[month].amountCents);
      expect(statement.totalIncomeRow.monthCells[month].amountCents).toBe(
        statement.monthlySummaries[month].incomeTotal.amountCents,
      );
    }
  });

  it("agrupa por identidad: homónimos en filas distintas y varias cuentas del mismo miembro en una", () => {
    const homonimos: SummaryAccountRef[] = [
      account({ id: 1, type: "personal", memberId: 10, memberName: "Alex" }),
      account({ id: 2, type: "personal", memberId: 20, memberName: "Alex" }),
      account({ id: 3, type: "shared" }),
    ];
    const catalogo: MemberRef[] = [
      { id: 10, name: "Alex" },
      { id: 20, name: "Alex" },
    ];

    const statement = AnnualIncomeStatement.fromMovements(
      [
        movement({ accountId: 1, type: "income", nature: null, amountCents: 1_000, date: "2026-02-01" }),
        movement({ accountId: 2, type: "income", nature: null, amountCents: 2_000, date: "2026-02-02" }),
        movement({ accountId: 3, type: "income", nature: null, amountCents: 8_000, date: "2026-02-03" }),
      ],
      homonimos,
      catalogo,
    );

    expect(statement.memberIncomeRows.map((row) => row.memberId)).toEqual([10, 20, null]);
    expect(cellCents(statement.memberIncomeRows[0].monthCells)[1]).toBe(1_000);
    expect(cellCents(statement.memberIncomeRows[1].monthCells)[1]).toBe(2_000);
    expect(cellCents(statement.memberIncomeRows[2].monthCells)[1]).toBe(8_000);
  });

  it("mantiene el catálogo completo con filas a cero aunque un miembro no tenga ingresos", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [movement({ accountId: 1, type: "income", nature: null, amountCents: 5_000 })],
      accounts,
      members,
    );

    expect(statement.memberIncomeRows).toHaveLength(3);
    const memberB = statement.memberIncomeRows[1];
    expect(memberB.memberId).toBe(20);
    expect(memberB.totalCents).toBe(0);
    expect(cellCents(memberB.monthCells)).toEqual(Array(12).fill(0));
    expect(memberB.averageCents).toBe(0);
  });

  it("las filas de totales replican incomeTotal, expenseTotal, sharedExpenseTotal y monthBalance por mes", () => {
    const statement = AnnualIncomeStatement.fromMovements(yearTresCuentas, accounts, members);

    for (let month = 0; month < 12; month += 1) {
      const summary = statement.monthlySummaries[month];
      expect(statement.totalIncomeRow.monthCells[month].amountCents).toBe(summary.incomeTotal.amountCents);
      expect(statement.expenseRealRow.monthCells[month].amountCents).toBe(summary.expenseTotal.amountCents);
      expect(statement.noPersonalExpenseRow.monthCells[month].amountCents).toBe(
        summary.sharedExpenseTotal.amountCents,
      );
      expect(statement.balanceRow.monthCells[month].amountCents).toBe(summary.monthBalance.amountCents);
    }

    expect(statement.totalIncomeRow.totalCents).toBe(722_000);
    expect(statement.expenseRealRow.totalCents).toBe(397_000);
    expect(statement.noPersonalExpenseRow.totalCents).toBe(391_000);
    expect(statement.balanceRow.totalCents).toBe(325_000);

    for (const row of [
      statement.totalIncomeRow,
      statement.expenseRealRow,
      statement.noPersonalExpenseRow,
      statement.balanceRow,
    ]) {
      expect(row.averageCents).toBe(Math.round(row.totalCents / 12));
    }
  });

  it("un gasto compartido pagado desde cuenta personal computa en Sin gastos personales", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [movement({ accountId: 1, nature: "shared", amountCents: 12_050 })],
      accounts,
      members,
    );

    expect(statement.noPersonalExpenseRow.monthCells[0].amountCents).toBe(12_050);
    expect(statement.expenseRealRow.monthCells[0].amountCents).toBe(12_050);
  });

  it("un gasto personal pagado desde la cuenta común computa en Gasto real y no en Sin gastos personales", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [movement({ accountId: 3, nature: "personal", amountCents: 2_500 })],
      accounts,
      members,
    );

    expect(statement.expenseRealRow.monthCells[0].amountCents).toBe(2_500);
    expect(statement.noPersonalExpenseRow.monthCells[0].amountCents).toBe(0);
  });

  it("acumula el saldo desde enero y el total del acumulado es el total anual de Saldo (FR-012)", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [
        movement({ accountId: 1, type: "income", nature: null, amountCents: 165_000, date: "2026-01-05" }),
        movement({ accountId: 3, amountCents: 100_000, date: "2026-02-10" }),
      ],
      accounts,
      members,
    );

    const balanceCells = cellCents(statement.balanceRow.monthCells);
    const accumulatedCells = cellCents(statement.accumulatedBalanceRow.monthCells);

    let running = 0;
    for (let month = 0; month < 12; month += 1) {
      running += balanceCells[month];
      expect(accumulatedCells[month]).toBe(running);
    }

    expect(statement.accumulatedBalanceRow.totalCents).toBe(statement.balanceRow.totalCents);
    expect(accumulatedCells[0]).toBe(165_000);
    expect(accumulatedCells[1]).toBe(65_000);
    expect(accumulatedCells[11]).toBe(65_000);
  });

  it("los meses a cero no alteran la acumulación del saldo", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [
        movement({ accountId: 1, type: "income", nature: null, amountCents: 50_000, date: "2026-01-05" }),
        movement({ accountId: 3, amountCents: 10_000, date: "2026-06-10" }),
      ],
      accounts,
      members,
    );

    const accumulatedCells = cellCents(statement.accumulatedBalanceRow.monthCells);
    expect(accumulatedCells[1]).toBe(50_000);
    expect(accumulatedCells[4]).toBe(50_000);
    expect(accumulatedCells[5]).toBe(40_000);
    expect(accumulatedCells[11]).toBe(40_000);
  });

  it("la media mensual es total/12 redondeada al céntimo más próximo", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [movement({ accountId: 3, amountCents: 10_000, date: "2026-04-01" })],
      accounts,
      members,
    );

    expect(statement.expenseRealRow.totalCents).toBe(10_000);
    expect(statement.expenseRealRow.averageCents).toBe(833);

    const incomeStatement = AnnualIncomeStatement.fromMovements(
      [movement({ accountId: 3, type: "income", nature: null, amountCents: 100_000, date: "2026-04-01" })],
      accounts,
      members,
    );
    expect(incomeStatement.totalIncomeRow.averageCents).toBe(Math.round(100_000 / 12));
    expect(incomeStatement.totalIncomeRow.averageCents).toBe(8_333);
  });

  it("un gasto multi-tag computa en cada tag sin duplicar el gasto real anual", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [
        movement({
          accountId: 3,
          amountCents: 85_000,
          date: "2026-01-05",
          tags: [{ id: 4, name: "Vivienda" }, { id: 5, name: "Hipoteca" }],
        }),
        movement({
          accountId: 3,
          amountCents: 85_000,
          date: "2026-03-05",
          tags: [{ id: 4, name: "Vivienda" }, { id: 5, name: "Hipoteca" }],
        }),
      ],
      accounts,
      members,
    );

    expect(statement.tagRows.map((row) => [row.tagName, row.totalCents])).toEqual([
      ["Hipoteca", 170_000],
      ["Vivienda", 170_000],
    ]);
    expect(statement.expenseRealRow.totalCents).toBe(170_000);

    const vivienda = statement.tagRows.find((row) => row.tagName === "Vivienda");
    expect(cellCents(vivienda?.monthCells ?? [])[0]).toBe(85_000);
    expect(cellCents(vivienda?.monthCells ?? [])[2]).toBe(85_000);
    expect(vivienda?.averageCents).toBe(Math.round(170_000 / 12));
  });

  it("los ingresos no aparecen en el desglose por tag", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [
        movement({
          accountId: 1,
          type: "income",
          nature: null,
          amountCents: 100_000,
          tags: [{ id: 9, name: "Nómina" }],
        }),
      ],
      accounts,
      members,
    );

    expect(statement.tagRows).toEqual([]);
    expect(statement.totalIncomeRow.totalCents).toBe(100_000);
  });

  it("tagRows es la fusión de los 12 tagBreakdown ordenada por total anual desc y nombre asc", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [
        movement({ accountId: 3, amountCents: 5_000, date: "2026-02-01", tags: [{ id: 6, name: "Ocio" }] }),
        movement({
          accountId: 3,
          amountCents: 5_000,
          date: "2026-03-01",
          tags: [{ id: 9, name: "Alimentación" }],
        }),
        movement({ accountId: 3, amountCents: 9_000, date: "2026-05-01", tags: [{ id: 4, name: "Coche" }] }),
        movement({ accountId: 3, amountCents: 2_000, date: "2026-08-01", tags: [{ id: 6, name: "Ocio" }] }),
      ],
      accounts,
      members,
    );

    expect(statement.tagRows.map((row) => [row.tagName, row.totalCents])).toEqual([
      ["Coche", 9_000],
      ["Ocio", 7_000],
      ["Alimentación", 5_000],
    ]);

    const ocio = statement.tagRows.find((row) => row.tagName === "Ocio");
    expect(cellCents(ocio?.monthCells ?? [])[1]).toBe(5_000);
    expect(cellCents(ocio?.monthCells ?? [])[7]).toBe(2_000);
    expect(ocio?.averageCents).toBe(Math.round(7_000 / 12));
  });

  it("las fechas de diciembre y enero de años contiguos parten en su mes sin mezclarse", () => {
    const statement = AnnualIncomeStatement.fromMovements(
      [
        movement({ accountId: 3, amountCents: 1_000, date: "2026-12-31" }),
        movement({ accountId: 3, amountCents: 2_000, date: "2026-01-01" }),
      ],
      accounts,
      members,
    );

    expect(statement.expenseRealRow.monthCells[11].amountCents).toBe(1_000);
    expect(statement.expenseRealRow.monthCells[0].amountCents).toBe(2_000);
    expect(statement.expenseRealRow.totalCents).toBe(3_000);
  });

  it("un año vacío devuelve 12 resúmenes a ceros, filas completas a cero y tagRows vacías (FR-007)", () => {
    const statement = AnnualIncomeStatement.fromMovements([], accounts, members);

    expect(statement.monthlySummaries).toHaveLength(12);
    for (const summary of statement.monthlySummaries) {
      expect(summary.incomeTotal.amountCents).toBe(0);
      expect(summary.expenseTotal.amountCents).toBe(0);
    }

    expect(statement.memberIncomeRows).toHaveLength(3);
    for (const row of statement.memberIncomeRows) {
      expect(row.totalCents).toBe(0);
      expect(row.averageCents).toBe(0);
    }

    expect(cellCents(statement.totalIncomeRow.monthCells)).toEqual(Array(12).fill(0));
    expect(cellCents(statement.expenseRealRow.monthCells)).toEqual(Array(12).fill(0));
    expect(cellCents(statement.noPersonalExpenseRow.monthCells)).toEqual(Array(12).fill(0));
    expect(cellCents(statement.balanceRow.monthCells)).toEqual(Array(12).fill(0));
    expect(cellCents(statement.accumulatedBalanceRow.monthCells)).toEqual(Array(12).fill(0));
    expect(statement.tagRows).toEqual([]);
  });

  it("ordena las filas de miembros por catálogo con la fila común al final", () => {
    const desordenado: MemberRef[] = [
      { id: 30, name: "Sam" },
      { id: 10, name: "Miembro A" },
      { id: 20, name: "Miembro B" },
    ];

    const statement = AnnualIncomeStatement.fromMovements([], accounts, desordenado);

    expect(statement.memberIncomeRows.map((row) => row.memberId)).toEqual([30, 10, 20, null]);
  });

  it("es inmutable, incluidas filas y celdas", () => {
    const statement = AnnualIncomeStatement.fromMovements(yearTresCuentas, accounts, members);

    expect(Object.isFrozen(statement)).toBe(true);
    expect(Object.isFrozen(statement.totalIncomeRow)).toBe(true);
    expect(Object.isFrozen(statement.accumulatedBalanceRow)).toBe(true);
    for (const row of statement.memberIncomeRows) {
      expect(Object.isFrozen(row)).toBe(true);
    }
    for (const row of statement.tagRows) {
      expect(Object.isFrozen(row)).toBe(true);
    }
  });
});
