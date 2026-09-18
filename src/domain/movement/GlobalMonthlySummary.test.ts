import { describe, expect, it } from "vitest";

import { Money } from "./Money";
import { MonthlyClosure } from "./MonthlyClosure";
import type { GlobalSummaryMovementInput, SummaryAccountRef } from "./GlobalMonthlySummary";
import { GlobalMonthlySummary } from "./GlobalMonthlySummary";

function movement(
  input: Partial<Omit<GlobalSummaryMovementInput, "accountId">> & { accountId?: number } = {},
): GlobalSummaryMovementInput {
  return {
    type: "expense",
    nature: "shared",
    amountCents: 1_000,
    tags: [{ id: 1, name: "Hogar" }],
    accountId: 3,
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

const mesTresCuentas: GlobalSummaryMovementInput[] = [
  movement({
    accountId: 3,
    type: "income",
    nature: null,
    amountCents: 210_000,
    tags: [{ id: 9, name: "Alimentación" }],
  }),
  movement({
    accountId: 3,
    amountCents: 85_000,
    tags: [{ id: 4, name: "Vivienda" }, { id: 5, name: "Hipoteca" }],
  }),
  movement({
    accountId: 1,
    type: "income",
    nature: null,
    amountCents: 50_000,
  }),
  movement({
    accountId: 1,
    nature: "personal",
    amountCents: 6_000,
    tags: [{ id: 6, name: "Coche" }],
  }),
  movement({
    accountId: 2,
    amountCents: 15_050,
    tags: [{ id: 9, name: "Alimentación" }],
  }),
];

describe("GlobalMonthlySummary", () => {
  it("delega los KPIs agregados en MonthlyClosure sobre la unión del mes", () => {
    const summary = GlobalMonthlySummary.fromMovements(mesTresCuentas, accounts);

    expect(summary.incomeTotal.amountCents).toBe(260_000);
    expect(summary.expenseTotal.amountCents).toBe(106_050);
    expect(summary.sharedExpenseTotal.amountCents).toBe(100_050);
    expect(summary.personalExpenseTotal.amountCents).toBe(6_000);
    expect(summary.monthBalance.amountCents).toBe(153_950);
  });

  it("es coherente con la suma de los cierres por cuenta, KPI a KPI (invariante FR-002)", () => {
    const summary = GlobalMonthlySummary.fromMovements(mesTresCuentas, accounts);

    const closures = [1, 2, 3].map((accountId) =>
      MonthlyClosure.fromMovements(mesTresCuentas.filter((input) => input.accountId === accountId)),
    );

    expect(summary.incomeTotal.amountCents).toBe(
      closures.reduce((sum, closure) => sum + closure.incomeTotal.amountCents, 0),
    );
    expect(summary.expenseTotal.amountCents).toBe(
      closures.reduce((sum, closure) => sum + closure.expenseTotal.amountCents, 0),
    );
    expect(summary.sharedExpenseTotal.amountCents).toBe(
      closures.reduce((sum, closure) => sum + closure.sharedExpenseTotal.amountCents, 0),
    );
    expect(summary.personalExpenseTotal.amountCents).toBe(
      closures.reduce((sum, closure) => sum + closure.personalExpenseTotal.amountCents, 0),
    );
    expect(summary.monthBalance.amountCents).toBe(
      closures.reduce((sum, closure) => sum + closure.monthBalance.amountCents, 0),
    );
  });

  it("el desglose por tag global es la fusión de los desgloses por cuenta", () => {
    const summary = GlobalMonthlySummary.fromMovements(mesTresCuentas, accounts);

    expect(summary.tagBreakdown.map((entry) => [entry.tagName, entry.amount.amountCents])).toEqual([
      ["Hipoteca", 85_000],
      ["Vivienda", 85_000],
      ["Alimentación", 15_050],
      ["Coche", 6_000],
    ]);
  });

  it("atribuye cada gasto al dueño de la cuenta de pago con SU naturaleza", () => {
    const summary = GlobalMonthlySummary.fromMovements(mesTresCuentas, accounts);

    expect(summary.memberBreakdown.map((entry) => entry.memberId)).toEqual([null, 20, 10]);
    const common = summary.memberBreakdown[0];
    expect(common.memberName).toBeNull();
    expect(common.shared.amountCents).toBe(85_000);
    expect(common.personal.amountCents).toBe(0);

    const memberB = summary.memberBreakdown[1];
    expect(memberB.memberId).toBe(20);
    expect(memberB.memberName).toBe("Miembro B");
    expect(memberB.shared.amountCents).toBe(15_050);
    expect(memberB.personal.amountCents).toBe(0);

    const memberA = summary.memberBreakdown[2];
    expect(memberA.personal.amountCents).toBe(6_000);
    expect(memberA.shared.amountCents).toBe(0);
  });

  it("un gasto personal pagado desde la cuenta común queda en la fila sin atribución con su naturaleza", () => {
    const summary = GlobalMonthlySummary.fromMovements(
      [movement({ accountId: 3, nature: "personal", amountCents: 2_500 })],
      accounts,
    );

    expect(summary.memberBreakdown).toHaveLength(1);
    expect(summary.memberBreakdown[0].memberId).toBeNull();
    expect(summary.memberBreakdown[0].personal.amountCents).toBe(2_500);
    expect(summary.memberBreakdown[0].shared.amountCents).toBe(0);
  });

  it("agrupa por identidad: homónimos generan filas distintas y varias cuentas del mismo miembro una fila", () => {
    const homonimos: SummaryAccountRef[] = [
      account({ id: 1, type: "personal", memberId: 10, memberName: "Alex" }),
      account({ id: 2, type: "personal", memberId: 20, memberName: "Alex" }),
      account({ id: 4, type: "personal", memberId: 30, memberName: "Sam" }),
      account({ id: 3, type: "shared" }),
    ];

    const summary = GlobalMonthlySummary.fromMovements(
      [
        movement({ accountId: 1, nature: "personal", amountCents: 1_000 }),
        movement({ accountId: 2, nature: "personal", amountCents: 2_000 }),
        movement({ accountId: 4, nature: "personal", amountCents: 4_000 }),
        movement({ accountId: 3, amountCents: 8_000 }),
      ],
      homonimos,
    );

    expect(summary.memberBreakdown.map((entry) => [entry.memberId, entry.memberName])).toEqual([
      [null, null],
      [30, "Sam"],
      [20, "Alex"],
      [10, "Alex"],
    ]);
    expect(summary.memberBreakdown[2].personal.amountCents).toBe(2_000);
    expect(summary.memberBreakdown[3].personal.amountCents).toBe(1_000);
  });

  it("la suma del desglose por miembro (personal+shared) es el total de gastos", () => {
    const summary = GlobalMonthlySummary.fromMovements(mesTresCuentas, accounts);

    const breakdownTotal = summary.memberBreakdown.reduce(
      (sum, entry) => sum + entry.personal.amountCents + entry.shared.amountCents,
      0,
    );
    expect(breakdownTotal).toBe(summary.expenseTotal.amountCents);
  });

  it("los ingresos no aparecen en ningún desglose", () => {
    const summary = GlobalMonthlySummary.fromMovements(
      [
        movement({ accountId: 1, type: "income", nature: null, amountCents: 100_000, tags: [{ id: 9, name: "Ocio" }] }),
        movement({ accountId: 3, amountCents: 5_000, tags: [{ id: 9, name: "Ocio" }] }),
      ],
      accounts,
    );

    expect(summary.incomeTotal.amountCents).toBe(100_000);
    expect(summary.tagBreakdown).toHaveLength(1);
    expect(summary.memberBreakdown).toHaveLength(1);
    expect(summary.memberBreakdown[0].memberId).toBeNull();
    expect(summary.memberBreakdown[0].shared.amountCents).toBe(5_000);
  });

  it("un gasto multi-tag computa en cada tag sin duplicar el total de gastos", () => {
    const summary = GlobalMonthlySummary.fromMovements(
      [movement({ accountId: 3, amountCents: 85_000, tags: [{ id: 4, name: "Vivienda" }, { id: 5, name: "Hipoteca" }] })],
      accounts,
    );

    expect(summary.tagBreakdown.map((entry) => entry.amount.amountCents)).toEqual([85_000, 85_000]);
    expect(summary.expenseTotal.amountCents).toBe(85_000);
    expect(summary.memberBreakdown[0].shared.amountCents).toBe(85_000);
  });

  it("devuelve todo a cero y desgloses vacíos para un mes sin movimientos", () => {
    const summary = GlobalMonthlySummary.fromMovements([], accounts);

    expect(summary.incomeTotal.amountCents).toBe(0);
    expect(summary.expenseTotal.amountCents).toBe(0);
    expect(summary.sharedExpenseTotal.amountCents).toBe(0);
    expect(summary.personalExpenseTotal.amountCents).toBe(0);
    expect(summary.monthBalance.amountCents).toBe(0);
    expect(summary.tagBreakdown).toEqual([]);
    expect(summary.memberBreakdown).toEqual([]);
  });

  it("ordena el desglose por miembro por total descendente, nombre asc y la fila común al final en empates", () => {
    const summary = GlobalMonthlySummary.fromMovements(
      [
        movement({ accountId: 1, nature: "personal", amountCents: 3_000 }),
        movement({ accountId: 2, nature: "personal", amountCents: 3_000 }),
        movement({ accountId: 3, amountCents: 3_000 }),
        movement({ accountId: 3, amountCents: 9_000 }),
      ],
      accounts,
    );

    expect(summary.memberBreakdown.map((entry) => entry.memberId)).toEqual([null, 10, 20]);
    expect(summary.memberBreakdown[1].memberName).toBe("Miembro A");
    expect(summary.memberBreakdown[2].memberName).toBe("Miembro B");
  });

  it("ordena el desglose por tag por importe descendente y desempata alfabéticamente", () => {
    const summary = GlobalMonthlySummary.fromMovements(
      [
        movement({ accountId: 3, amountCents: 5_000, tags: [{ id: 6, name: "Ocio" }] }),
        movement({ accountId: 3, amountCents: 5_000, tags: [{ id: 9, name: "Alimentación" }] }),
        movement({ accountId: 3, amountCents: 9_000, tags: [{ id: 4, name: "Coche" }] }),
      ],
      accounts,
    );

    expect(summary.tagBreakdown.map((entry) => entry.tagName)).toEqual([
      "Coche",
      "Alimentación",
      "Ocio",
    ]);
  });

  it("los importes del desglose por miembro son Money exactos en céntimos", () => {
    const summary = GlobalMonthlySummary.fromMovements(mesTresCuentas, accounts);

    for (const entry of summary.memberBreakdown) {
      expect(entry.personal).toBeInstanceOf(Money);
      expect(entry.shared).toBeInstanceOf(Money);
      expect(Number.isInteger(entry.personal.amountCents)).toBe(true);
    }
  });

  it("es inmutable, incluidos ambos desgloses", () => {
    const summary = GlobalMonthlySummary.fromMovements(mesTresCuentas, accounts);

    expect(Object.isFrozen(summary)).toBe(true);
    for (const entry of summary.tagBreakdown) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
    for (const entry of summary.memberBreakdown) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });
});
