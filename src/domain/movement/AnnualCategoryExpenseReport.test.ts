import { describe, expect, it } from "vitest";

import type { ExpenseNature } from "./ExpenseNature";
import type { MovementType } from "./MovementType";
import { AnnualCategoryExpenseReport } from "./AnnualCategoryExpenseReport";

interface InputSpec {
  month: string;
  amountCents: number;
  type?: MovementType;
  nature?: ExpenseNature;
  tagSlug?: string | null;
  tagCategoryId?: number | null;
  accountKind?: "personal" | "common";
}

function input(spec: InputSpec) {
  return {
    month: spec.month,
    type: spec.type ?? "expense",
    nature: spec.nature ?? "personal",
    amountCents: spec.amountCents,
    tagSlug: spec.tagSlug === undefined ? "ocio" : spec.tagSlug,
    tagCategoryId: spec.tagCategoryId === undefined ? 1 : spec.tagCategoryId,
    accountKind: spec.accountKind ?? "personal",
  };
}

const categories = [
  { id: 3, name: "Suscripciones", slug: "suscripciones" },
  { id: 1, name: "General", slug: "general" },
  { id: 2, name: "Alimentación", slug: "alimentacion" },
];

describe("AnnualCategoryExpenseReport", () => {
  it("acumula por celda categoría×mes sumando gastos de varias etiquetas, cuentas y naturalezas", () => {
    const report = AnnualCategoryExpenseReport.fromMovements(
      "2026",
      [
        input({ month: "2026-01", amountCents: 10_000, tagCategoryId: 2, tagSlug: "alimentacion" }),
        input({
          month: "2026-01",
          amountCents: 5_000,
          tagCategoryId: 2,
          tagSlug: "supermercado",
          nature: "shared",
          accountKind: "common",
        }),
        input({ month: "2026-02", amountCents: 3_000, tagCategoryId: 2 }),
        input({ month: "2026-01", amountCents: 7_000, tagCategoryId: 3, tagSlug: "streaming" }),
      ],
      categories,
    );

    expect(report.year).toBe("2026");
    const alimentacion = report.rows.find((row) => row.categoryId === 2);
    const suscripciones = report.rows.find((row) => row.categoryId === 3);

    expect(alimentacion?.monthlyAmountCents[0]).toBe(15_000);
    expect(alimentacion?.monthlyAmountCents[1]).toBe(3_000);
    expect(suscripciones?.monthlyAmountCents[0]).toBe(7_000);
  });

  it("excluye la etiqueta protegida «Aportación Común» de celdas, fila mensual y fila personal", () => {
    const report = AnnualCategoryExpenseReport.fromMovements(
      "2026",
      [
        input({ month: "2026-03", amountCents: 50_000, tagSlug: "aportacion-comun", tagCategoryId: 1 }),
        input({ month: "2026-03", amountCents: 4_000, tagSlug: "ocio", tagCategoryId: 1 }),
      ],
      categories,
    );

    const general = report.rows.find((row) => row.categoryId === 1);
    expect(general?.monthlyAmountCents[2]).toBe(4_000);
    expect(report.monthlyTotalCents[2]).toBe(4_000);
    expect(report.monthlyPersonalTotalCents[2]).toBe(4_000);
  });

  it("los gastos con etiquetas desactivadas computan igualmente (histórico íntegro)", () => {
    const report = AnnualCategoryExpenseReport.fromMovements(
      "2026",
      [input({ month: "2026-04", amountCents: 12_000, tagSlug: "viaje-antiguo", tagCategoryId: 1 })],
      categories,
    );

    const general = report.rows.find((row) => row.categoryId === 1);
    expect(general?.monthlyAmountCents[3]).toBe(12_000);
    expect(report.monthlyTotalCents[3]).toBe(12_000);
  });

  it("calcula la media anual como total ÷ 12 con redondeo half-up al céntimo", () => {
    const report = AnnualCategoryExpenseReport.fromMovements(
      "2026",
      [input({ month: "2026-01", amountCents: 10_500, tagCategoryId: 1 })],
      categories,
    );

    const general = report.rows.find((row) => row.categoryId === 1);
    expect(general?.annualTotalCents).toBe(10_500);
    expect(general?.annualAverageCents).toBe(875);
    expect(report.monthlyTotalAverageCents).toBe(875);
    expect(report.personalTotalAverageCents).toBe(875);
  });

  it("con un año vacío devuelve la estructura completa a ceros (todas las categorías, 12 columnas)", () => {
    const report = AnnualCategoryExpenseReport.fromMovements("2026", [], categories);

    expect(report.rows).toHaveLength(3);
    for (const row of report.rows) {
      expect(row.monthlyAmountCents).toHaveLength(12);
      expect(row.monthlyAmountCents.every((cents) => cents === 0)).toBe(true);
      expect(row.annualTotalCents).toBe(0);
      expect(row.annualAverageCents).toBe(0);
    }
    expect(report.monthlyTotalCents).toEqual(Array<number>(12).fill(0));
    expect(report.monthlyPersonalTotalCents).toEqual(Array<number>(12).fill(0));
    expect(report.monthlyTotalAverageCents).toBe(0);
    expect(report.personalTotalAverageCents).toBe(0);
  });

  it("la fila «Gasto mensual» suma todos los gastos del mes con la misma exclusión", () => {
    const report = AnnualCategoryExpenseReport.fromMovements(
      "2026",
      [
        input({ month: "2026-05", amountCents: 20_000, tagCategoryId: 2, nature: "shared", accountKind: "common" }),
        input({ month: "2026-05", amountCents: 6_000, tagCategoryId: 3 }),
        input({ month: "2026-06", amountCents: 9_000, tagCategoryId: 1 }),
        input({ month: "2026-05", amountCents: 99_999, tagSlug: "aportacion-comun", tagCategoryId: 1 }),
      ],
      categories,
    );

    expect(report.monthlyTotalCents[4]).toBe(26_000);
    expect(report.monthlyTotalCents[5]).toBe(9_000);
    const totalYear = report.monthlyTotalCents.reduce((sum, cents) => sum + cents, 0);
    expect(report.monthlyTotalAverageCents).toBe(Math.round(totalYear / 12));
  });

  it("la fila de gastos personales solo computa naturaleza propia en cuentas personales", () => {
    const report = AnnualCategoryExpenseReport.fromMovements(
      "2026",
      [
        input({ month: "2026-07", amountCents: 11_000, nature: "personal", accountKind: "personal" }),
        input({ month: "2026-07", amountCents: 22_000, nature: "personal", accountKind: "common" }),
        input({ month: "2026-07", amountCents: 33_000, nature: "shared", accountKind: "personal" }),
        input({ month: "2026-08", amountCents: 44_000, nature: "shared", accountKind: "common" }),
        input({ month: "2026-07", amountCents: 55_000, nature: "personal", accountKind: "personal", tagSlug: "aportacion-comun" }),
      ],
      categories,
    );

    expect(report.monthlyPersonalTotalCents[6]).toBe(11_000);
    expect(report.monthlyPersonalTotalCents[7]).toBe(0);
    expect(report.personalTotalAverageCents).toBe(Math.round(11_000 / 12));
  });

  it("ordena las filas con la genérica primero y el resto alfabético es-ES", () => {
    const report = AnnualCategoryExpenseReport.fromMovements("2026", [], categories);

    expect(report.rows.map((row) => row.categoryName)).toEqual([
      "General",
      "Alimentación",
      "Suscripciones",
    ]);
    expect(report.rows[0].isDefaultCategory).toBe(true);
    expect(report.rows.slice(1).every((row) => !row.isDefaultCategory)).toBe(true);
  });

  it("ignora los ingresos y los gastos sin etiqueta atribuible", () => {
    const report = AnnualCategoryExpenseReport.fromMovements(
      "2026",
      [
        input({ month: "2026-09", amountCents: 100_000, type: "income", tagSlug: null, tagCategoryId: null }),
        input({ month: "2026-09", amountCents: 70_000, tagSlug: null, tagCategoryId: null }),
      ],
      categories,
    );

    expect(report.monthlyTotalCents[8]).toBe(0);
    for (const row of report.rows) {
      expect(row.annualTotalCents).toBe(0);
    }
  });
});
