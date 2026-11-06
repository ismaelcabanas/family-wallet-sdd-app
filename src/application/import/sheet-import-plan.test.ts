import { describe, expect, it } from "vitest";

import { buildSheetImportPlan, type PlanInput, type SheetCellsRow } from "./sheet-import-plan";

type Column = 0 | 1 | 2 | 3 | 4 | 5;

function sheetRow(line: number, overrides: Partial<Record<Column, string>> = {}): SheetCellsRow {
  const cells = ["", "", "", "", "", "", "", "", "", "", "", "", ""];
  for (const [index, value] of Object.entries(overrides)) {
    cells[Number(index)] = value;
  }
  return { line, cells };
}

const DEFAULT_INPUT: Omit<PlanInput, "rows"> = {
  month: "2026-01",
  activeTags: [
    { id: 7, name: "Ocio", slug: "ocio" },
    { id: 8, name: "Hogar", slug: "hogar" },
  ],
  inactiveTagNames: ["Salud"],
  defaultCategoryId: 1,
};

function plan(rows: SheetCellsRow[], overrides: Partial<Omit<PlanInput, "rows">> = {}) {
  return buildSheetImportPlan({ ...DEFAULT_INPUT, ...overrides, rows });
}

describe("buildSheetImportPlan — tabla de mapeo (FR-003)", () => {
  it("Gasto → gasto de naturaleza personal con etiqueta de la categoría", () => {
    const result = plan([
      sheetRow(2, { 0: "", 1: "Carrera", 2: "OPie Randobike", 3: "Gasto", 4: "7.85", 5: "Ocio" }),
    ]);

    expect(result.rows).toEqual([
      {
        line: 2,
        status: "ok",
        movement: {
          date: "2026-01-01",
          note: "Carrera — OPie Randobike",
          amountCents: 785,
          type: "expense",
          nature: "personal",
          tagName: "Ocio",
          tagId: 7,
          createsTag: false,
        },
      },
    ]);
  });

  it("Gasto Común → gasto de naturaleza compartida", () => {
    const result = plan([sheetRow(2, { 1: "Luz", 3: "Gasto Común", 4: "16", 5: "Hogar" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ok",
      movement: expect.objectContaining({ type: "expense", nature: "shared", amountCents: 1600 }),
    });
  });

  it("Gasto Fijo → gasto personal (decisión del propietario)", () => {
    const result = plan([sheetRow(2, { 1: "Alquiler", 3: "Gasto Fijo", 4: "42", 5: "Hogar" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ok",
      movement: expect.objectContaining({ type: "expense", nature: "personal", amountCents: 4200 }),
    });
  });

  it("Ingreso → ingreso sin naturaleza y sin etiqueta cuando la categoría va vacía", () => {
    const result = plan([sheetRow(2, { 1: "Nomina", 3: "Ingreso", 4: "1366.54", 5: "" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ok",
      movement: expect.objectContaining({
        type: "income",
        nature: null,
        amountCents: 136654,
        tagName: null,
        tagId: null,
        createsTag: false,
      }),
    });
  });

  it("Ingreso con categoría → ingreso con la etiqueta resuelta", () => {
    const result = plan([sheetRow(2, { 1: "Cumpleaños Isma", 3: "Ingreso", 4: "50", 5: "Regalos" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ok",
      movement: expect.objectContaining({
        type: "income",
        nature: null,
        tagName: "Regalos",
        createsTag: true,
      }),
    });
    expect(result.tagsToCreate).toEqual([{ name: "Regalos", categoryId: 1 }]);
  });

  it("tipo Ahorro → fila ignorada como configuración de la hoja", () => {
    const result = plan([sheetRow(2, { 1: "Ahorros", 3: "Ahorro", 4: "600", 5: "Ahorros" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ignored",
      reason: "fila de configuración de la hoja",
    });
    expect(result.totals.ignored).toBe(1);
    expect(result.totals.movements).toBe(0);
  });

  it("concepto «Aportación Común» exacto tras trim → fila ignorada aunque el tipo sea Gasto Fijo", () => {
    const result = plan([
      sheetRow(2, { 1: "  Aportación Común  ", 3: "Gasto Fijo", 4: "1920", 5: "Hogar" }),
    ]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ignored",
      reason: "fila de configuración de la hoja",
    });
  });

  it("concepto «Aportación Cuenta Común» NO coincide con el excluido → se importa (Gasto Común)", () => {
    const result = plan([
      sheetRow(2, { 1: "Aportación Cuenta Común", 3: "Gasto Común", 4: "1000", 5: "Hogar" }),
    ]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ok",
      movement: expect.objectContaining({ type: "expense", nature: "shared" }),
    });
  });

  it("tipo desconocido → error de fila con el tipo entre comillas", () => {
    const result = plan([sheetRow(2, { 1: "Rareza", 3: "Reintegro", 4: "10", 5: "Ocio" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "error",
      reason: 'El tipo de transacción "Reintegro" no se reconoce.',
    });
    expect(result.hasErrors).toBe(true);
  });
});

describe("buildSheetImportPlan — fechas (Edge Cases)", () => {
  it("fecha vacía → día 1 del mes declarado", () => {
    const result = plan([sheetRow(2, { 1: "Fisio", 3: "Gasto", 4: "50", 5: "Ocio" })]);

    expect(result.rows[0]).toMatchObject({ status: "ok" });
    if (result.rows[0].status === "ok") {
      expect(result.rows[0].movement.date).toBe("2026-01-01");
    }
  });

  it("fecha del mes declarado se conserva", () => {
    const result = plan([sheetRow(2, { 0: "2026-01-15", 1: "Fisio", 3: "Gasto", 4: "50", 5: "Ocio" })]);

    if (result.rows[0].status === "ok") {
      expect(result.rows[0].movement.date).toBe("2026-01-15");
    } else {
      throw new Error("esperaba fila ok");
    }
  });

  it("fecha de otro mes → error de fila", () => {
    const result = plan([sheetRow(2, { 0: "2026-02-15", 1: "Fisio", 3: "Gasto", 4: "50", 5: "Ocio" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "error",
      reason: 'La fecha "2026-02-15" no pertenece al mes seleccionado.',
    });
  });

  it("fecha de calendario imposible del mes → error de dominio vía Movement.create", () => {
    const result = plan([sheetRow(2, { 0: "2026-01-32", 1: "Fisio", 3: "Gasto", 4: "50", 5: "Ocio" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "error",
      reason: "Indica una fecha válida.",
    });
  });
});

describe("buildSheetImportPlan — nota fusionada (research §3)", () => {
  it("solo concepto → nota = concepto", () => {
    const result = plan([sheetRow(2, { 1: "Fisio", 3: "Gasto", 4: "50", 5: "Ocio" })]);

    if (result.rows[0].status === "ok") {
      expect(result.rows[0].movement.note).toBe("Fisio");
    }
  });

  it("solo descripción → nota = descripción", () => {
    const result = plan([sheetRow(2, { 2: "Fisio de enero", 3: "Gasto", 4: "50", 5: "Ocio" })]);

    if (result.rows[0].status === "ok") {
      expect(result.rows[0].movement.note).toBe("Fisio de enero");
    }
  });

  it("concepto y descripción → «Concepto — Descripción» con raya", () => {
    const result = plan([
      sheetRow(2, { 1: "Regalo", 2: "Cumple David", 3: "Gasto", 4: "50", 5: "Regalos" }),
    ]);

    if (result.rows[0].status === "ok") {
      expect(result.rows[0].movement.note).toBe("Regalo — Cumple David");
    }
  });

  it("concepto y descripción vacíos → error con el mensaje de dominio «La nota es obligatoria.»", () => {
    const result = plan([sheetRow(2, { 3: "Gasto", 4: "50", 5: "Ocio" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "error",
      reason: "La nota es obligatoria.",
    });
  });
});

describe("buildSheetImportPlan — dialecto del importe (research §1)", () => {
  it.each(["0", "0.00"])("importe %s → error «El importe debe ser mayor que cero.»", (amount) => {
    const result = plan([sheetRow(2, { 1: "Fisio", 3: "Gasto", 4: amount, 5: "Ocio" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "error",
      reason: "El importe debe ser mayor que cero.",
    });
  });

  it.each(["-5", "7,85", "abc", "", "1.234"])(
    "importe %s → error de formato de fila con el valor entre comillas",
    (amount) => {
      const result = plan([sheetRow(2, { 1: "Fisio", 3: "Gasto", 4: amount, 5: "Ocio" })]);

      expect(result.rows[0]).toEqual({
        line: 2,
        status: "error",
        reason: `El importe "${amount}" no tiene un formato válido (usa punto decimal y hasta dos decimales).`,
      });
    },
  );

  it("importe de un dígito decimal se completa a céntimos («7.8» → 780)", () => {
    const result = plan([sheetRow(2, { 1: "Fisio", 3: "Gasto", 4: "7.8", 5: "Ocio" })]);

    if (result.rows[0].status === "ok") {
      expect(result.rows[0].movement.amountCents).toBe(780);
    }
  });
});

describe("buildSheetImportPlan — etiquetas (research §7)", () => {
  it("gasto sin categoría → error de dominio «Selecciona una etiqueta para el gasto.»", () => {
    const result = plan([sheetRow(2, { 1: "Fisio", 3: "Gasto", 4: "50", 5: "" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "error",
      reason: "Selecciona una etiqueta para el gasto.",
    });
  });

  it("match case-insensitive contra etiqueta activa → tagId resuelto", () => {
    const result = plan([sheetRow(2, { 1: "Cine", 3: "Gasto", 4: "50", 5: "OCIO" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "ok",
      movement: expect.objectContaining({ tagId: 7, tagName: "Ocio", createsTag: false }),
    });
    expect(result.tagsToCreate).toEqual([]);
  });

  it("colisión con etiqueta desactivada → error de fila", () => {
    const result = plan([sheetRow(2, { 1: "Fisio", 3: "Gasto", 4: "50", 5: "salud" })]);

    expect(result.rows[0]).toEqual({
      line: 2,
      status: "error",
      reason: 'La etiqueta "salud" está desactivada.',
    });
  });

  it("sin equivalente → createsTag en la categoría genérica, con dedupe por lower(name)", () => {
    const result = plan([
      sheetRow(2, { 1: "Pienso", 3: "Gasto", 4: "18.65", 5: "Mascotas" }),
      sheetRow(3, { 1: "Juguete", 3: "Gasto", 4: "9.99", 5: "MASCOTAS" }),
    ]);

    expect(result.tagsToCreate).toEqual([{ name: "Mascotas", categoryId: 1 }]);
    expect(result.rows).toEqual([
      {
        line: 2,
        status: "ok",
        movement: expect.objectContaining({ tagName: "Mascotas", tagId: null, createsTag: true }),
      },
      {
        line: 3,
        status: "ok",
        movement: expect.objectContaining({ tagName: "MASCOTAS", tagId: null, createsTag: true }),
      },
    ]);
  });

  it("una etiqueta nueva pasa la validación de dominio con el TagId centinela (gasto válido)", () => {
    const result = plan([sheetRow(2, { 1: "Pienso", 3: "Gasto", 4: "18.65", 5: "Mascotas" })]);

    expect(result.rows[0].status).toBe("ok");
    expect(result.hasErrors).toBe(false);
  });
});

describe("buildSheetImportPlan — estructura y totales (SC-002)", () => {
  it("fila con número de celdas distinto de 13 → error de fila", () => {
    const result = plan([{ line: 4, cells: ["", "Fisio", "Gasto"] }]);

    expect(result.rows[0]).toEqual({
      line: 4,
      status: "error",
      reason: "La fila no tiene las 13 columnas de la hoja mensual.",
    });
  });

  it("totales verificados contra la muestra de Enero (186,75 / 73,52 / 3.300,00)", () => {
    const gasto = (line: number, concepto: string, importe: string) =>
      sheetRow(line, { 1: concepto, 3: "Gasto", 4: importe, 5: "Ocio" });
    const comun = (line: number, concepto: string, importe: string) =>
      sheetRow(line, { 1: concepto, 3: "Gasto Común", 4: importe, 5: "Hogar" });

    const result = plan([
      gasto(2, "Regalo — Cumple David", "50"),
      gasto(3, "Carrera", "7.85"),
      gasto(4, "Fisio", "25.9"),
      gasto(5, "Cena", "44"),
      gasto(6, "Café", "12"),
      gasto(7, "Bocata", "2"),
      gasto(8, "Taxi", "40"),
      gasto(9, "Prensa", "5"),
      comun(10, "Luz", "16"),
      comun(11, "Agua", "42.21"),
      comun(12, "Gas", "11.41"),
      comun(13, "Internet", "3.9"),
      sheetRow(14, { 1: "Nomina", 3: "Ingreso", 4: "3300" }),
      sheetRow(15, { 1: "Aportación Común", 3: "Gasto Fijo", 4: "1920", 5: "Hogar" }),
      sheetRow(16, { 1: "Ahorros", 3: "Ahorro", 4: "600", 5: "Ahorros" }),
      sheetRow(17, { 1: "Roto", 3: "Gasto", 4: "abc", 5: "Ocio" }),
    ]);

    expect(result.totals).toEqual({
      movements: 13,
      personalExpenseCents: 18675,
      sharedExpenseCents: 7352,
      incomeCents: 330000,
      ignored: 2,
      errors: 1,
    });
    expect(result.hasErrors).toBe(true);
    expect(result.rows.map((row) => row.line)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it("todas las filas ignoradas → 0 movimientos y sin errores", () => {
    const result = plan([
      sheetRow(2, { 1: "Aportación Común", 3: "Gasto Fijo", 4: "1920", 5: "Hogar" }),
      sheetRow(3, { 1: "Ahorros", 3: "Ahorro", 4: "600", 5: "Ahorros" }),
    ]);

    expect(result.totals).toEqual({
      movements: 0,
      personalExpenseCents: 0,
      sharedExpenseCents: 0,
      incomeCents: 0,
      ignored: 2,
      errors: 0,
    });
    expect(result.hasErrors).toBe(false);
  });
});
