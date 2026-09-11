import { describe, expect, it } from "vitest";

import type { ClosureMovementInput } from "./MonthlyClosure";
import { MonthlyClosure } from "./MonthlyClosure";

function movement(input: Partial<ClosureMovementInput> = {}): ClosureMovementInput {
  return {
    type: "expense",
    nature: "shared",
    amountCents: 1_000,
    tags: [{ id: 1, name: "Hogar" }],
    ...input,
  };
}

const mesCuentaComun: ClosureMovementInput[] = [
  movement({
    type: "income",
    nature: null,
    amountCents: 192_000,
    tags: [{ id: 9, name: "Alimentación" }],
  }),
  movement({ amountCents: 85_000, tags: [{ id: 1, name: "Vivienda" }, { id: 2, name: "Hipoteca" }] }),
  movement({ amountCents: 12_050, tags: [{ id: 3, name: "Hogar" }] }),
];

describe("MonthlyClosure", () => {
  it("agrega ingresos, gastos por naturaleza y saldo del mes (escenario 1 de la spec)", () => {
    const closure = MonthlyClosure.fromMovements(mesCuentaComun);

    expect(closure.incomeTotal.amountCents).toBe(192_000);
    expect(closure.expenseTotal.amountCents).toBe(97_050);
    expect(closure.sharedExpenseTotal.amountCents).toBe(97_050);
    expect(closure.personalExpenseTotal.amountCents).toBe(0);
    expect(closure.monthBalance.amountCents).toBe(94_950);
  });

  it("computa cada gasto en cada una de sus tags sin duplicar el total de gastos (invariante 2)", () => {
    const closure = MonthlyClosure.fromMovements(mesCuentaComun);

    expect(closure.tagBreakdown.map((entry) => [entry.tagName, entry.amount.amountCents])).toEqual([
      ["Hipoteca", 85_000],
      ["Vivienda", 85_000],
      ["Hogar", 12_050],
    ]);

    const breakdownSum = closure.tagBreakdown.reduce((sum, entry) => sum + entry.amount.amountCents, 0);
    expect(breakdownSum).toBe(182_050);
    expect(breakdownSum).toBeGreaterThan(closure.expenseTotal.amountCents);
    expect(closure.expenseTotal.amountCents).toBe(97_050);
  });

  it("clasifica los gastos por naturaleza y shared + personal es siempre el total (invariante 1)", () => {
    const closure = MonthlyClosure.fromMovements([
      movement({ nature: "personal", amountCents: 6_000, tags: [{ id: 4, name: "Coche" }] }),
      movement({ nature: "shared", amountCents: 12_050, tags: [{ id: 5, name: "Alimentación" }] }),
    ]);

    expect(closure.expenseTotal.amountCents).toBe(18_050);
    expect(closure.sharedExpenseTotal.amountCents).toBe(12_050);
    expect(closure.personalExpenseTotal.amountCents).toBe(6_000);
    expect(
      closure.sharedExpenseTotal.add(closure.personalExpenseTotal).equals(closure.expenseTotal),
    ).toBe(true);
  });

  it("ignora la naturaleza de los ingresos aunque llegue poblada", () => {
    const closure = MonthlyClosure.fromMovements([
      movement({ type: "income", nature: "shared", amountCents: 50_000 }),
    ]);

    expect(closure.incomeTotal.amountCents).toBe(50_000);
    expect(closure.sharedExpenseTotal.amountCents).toBe(0);
    expect(closure.personalExpenseTotal.amountCents).toBe(0);
  });

  it("devuelve todo a cero y desglose vacío para un mes sin movimientos", () => {
    const closure = MonthlyClosure.fromMovements([]);

    expect(closure.incomeTotal.amountCents).toBe(0);
    expect(closure.expenseTotal.amountCents).toBe(0);
    expect(closure.sharedExpenseTotal.amountCents).toBe(0);
    expect(closure.personalExpenseTotal.amountCents).toBe(0);
    expect(closure.monthBalance.amountCents).toBe(0);
    expect(closure.tagBreakdown).toEqual([]);
  });

  it("admite saldo del mes negativo", () => {
    const closure = MonthlyClosure.fromMovements([
      movement({ type: "income", nature: null, amountCents: 10_000 }),
      movement({ amountCents: 15_120 }),
    ]);

    expect(closure.monthBalance.amountCents).toBe(-5_120);
  });

  it("ordena el desglose por importe descendente y desempata por nombre con collation es", () => {
    const closure = MonthlyClosure.fromMovements([
      movement({ amountCents: 5_000, tags: [{ id: 6, name: "Ocio" }] }),
      movement({ amountCents: 5_000, tags: [{ id: 5, name: "Alimentación" }] }),
      movement({ amountCents: 9_000, tags: [{ id: 4, name: "Coche" }] }),
    ]);

    expect(closure.tagBreakdown.map((entry) => entry.tagName)).toEqual([
      "Coche",
      "Alimentación",
      "Ocio",
    ]);
  });

  it("es inmutable, incluido el desglose", () => {
    const closure = MonthlyClosure.fromMovements(mesCuentaComun);

    expect(Object.isFrozen(closure)).toBe(true);
    for (const entry of closure.tagBreakdown) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });
});
