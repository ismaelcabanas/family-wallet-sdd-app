import { describe, expect, it } from "vitest";

import { parseSheetCsv, SHEET_COLUMNS } from "./sheet-csv";

const HEADER = SHEET_COLUMNS.join(",");

function csvRow(cells: string[]): string {
  return cells
    .map((cell) =>
      cell.includes(",") || cell.includes('"') || cell.includes("\n")
        ? `"${cell.replace(/"/g, '""')}"`
        : cell,
    )
    .join(",");
}

function sheetRow(overrides: Partial<Record<0 | 1 | 2 | 3 | 4 | 5, string>> = {}): string {
  const cells = ["", "", "", "", "", "", "", "", "", "", "", "", ""];
  for (const [index, value] of Object.entries(overrides)) {
    cells[Number(index)] = value;
  }
  return csvRow(cells);
}

describe("parseSheetCsv", () => {
  it("acepta la cabecera exacta de 13 columnas y numera las filas desde la cabecera (línea 1)", () => {
    const text = [HEADER, sheetRow({ 1: "Fisio", 3: "Gasto", 4: "50", 5: "Salud" }), sheetRow({ 1: "Nomina", 3: "Ingreso", 4: "1366.54" })].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result).toEqual({
      ok: true,
      rows: [
        { line: 2, cells: ["", "Fisio", "", "Gasto", "50", "Salud", "", "", "", "", "", "", ""] },
        { line: 3, cells: ["", "Nomina", "", "Ingreso", "1366.54", "", "", "", "", "", "", "", ""] },
      ],
    });
  });

  it("tolera finales de línea LF y BOM UTF-8", () => {
    const text = `\uFEFF${HEADER}\n${sheetRow({ 1: "Fisio", 3: "Gasto", 4: "50", 5: "Salud" })}\n`;

    const result = parseSheetCsv(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].line).toBe(2);
    }
  });

  it("las comas embebidas entre comillas («Maria, Zoe, Aisha») llegan como una sola celda", () => {
    const text = [HEADER, csvRow(["", "Maria, Zoe, Aisha", "", "Gasto Común", "16", "Hogar", "", "", "", "", "", "", ""])].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result).toEqual({
      ok: true,
      rows: [
        { line: 2, cells: ["", "Maria, Zoe, Aisha", "", "Gasto Común", "16", "Hogar", "", "", "", "", "", "", ""] },
      ],
    });
  });

  it("las comillas dobles escapadas («\"\"») dentro de un campo entrecomillado se reducen a una", () => {
    const text = [HEADER, csvRow(['', 'Cena "de" gala', "", "Gasto", "10", "Ocio", "", "", "", "", "", "", ""])].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].cells[1]).toBe('Cena "de" gala');
    }
  });

  it("un salto de línea dentro de un campo entrecomillado mantiene una única fila", () => {
    const multiline = "línea 1\nlínea 2";
    const text = [HEADER, csvRow(["", multiline, "", "Gasto", "10", "Ocio", "", "", "", "", "", "", ""])].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].cells[1]).toBe("línea 1\nlínea 2");
    }
  });

  it("descarta las filas totalmente vacías conservando la numeración de líneas", () => {
    const text = [
      HEADER,
      sheetRow({ 1: "Fisio", 3: "Gasto", 4: "50", 5: "Salud" }),
      "",
      ",,,,,,,,,,,,",
      sheetRow({ 1: "Otro", 3: "Gasto", 4: "10", 5: "Ocio" }),
    ].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows.map((row) => row.line)).toEqual([2, 5]);
    }
  });

  it("cabecera renombrada → error de estructura congelado", () => {
    const renamed = [...SHEET_COLUMNS];
    renamed[1] = "Nombre";
    const text = [renamed.join(","), sheetRow({ 1: "Fisio" })].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result).toEqual({
      ok: false,
      message:
        "La estructura del fichero no coincide con la esperada (cabecera de 13 columnas de la hoja mensual).",
    });
  });

  it("cabecera con número de columnas distinto de 13 → error de estructura", () => {
    const short = SHEET_COLUMNS.slice(0, 12).join(",");
    const result = parseSheetCsv([short, sheetRow()].join("\r\n"));

    expect(result).toEqual({
      ok: false,
      message:
        "La estructura del fichero no coincide con la esperada (cabecera de 13 columnas de la hoja mensual).",
    });
  });

  it("comilla sin cerrar → «El fichero no es un CSV válido.»", () => {
    const text = [HEADER, ',"Fisio,Gasto,50'].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result).toEqual({ ok: false, message: "El fichero no es un CSV válido." });
  });

  it("sin filas de datos tras descartar vacías → «El fichero no contiene movimientos.»", () => {
    const result = parseSheetCsv(`${HEADER}\r\n\r\n`);

    expect(result).toEqual({ ok: false, message: "El fichero no contiene movimientos." });
  });

  it("una fila de datos con número de celdas distinto de 13 pasa al resultado tal cual (el núcleo reporta el error)", () => {
    const text = [HEADER, csvRow(["", "Fisio", "Gasto"])].join("\r\n");

    const result = parseSheetCsv(text);

    expect(result).toEqual({
      ok: true,
      rows: [{ line: 2, cells: ["", "Fisio", "Gasto"] }],
    });
  });
});
