import type { SheetCellsRow } from "@/application/import/sheet-import-plan";

export const SHEET_COLUMNS: readonly string[] = Object.freeze([
  "Fecha de Operación",
  "Concepto",
  "Descripción",
  "Tipo de Transacción",
  "Importe",
  "Categoría",
  "Balance",
  "Aportación Común",
  "Gastos Comunes",
  "Gastos Personales",
  "Ahorro",
  "Gastos Alimentación",
  "Ahorro Total",
]);

const STRUCTURE_ERROR =
  "La estructura del fichero no coincide con la esperada (cabecera de 13 columnas de la hoja mensual).";
const INVALID_CSV_ERROR = "El fichero no es un CSV válido.";
const NO_MOVEMENTS_ERROR = "El fichero no contiene movimientos.";

export type SheetParseResult =
  | { ok: true; rows: SheetCellsRow[] }
  | { ok: false; message: string };

interface ParsedRecord {
  cells: string[];
}

function parseRecords(text: string): ParsedRecord[] | null {
  const records: ParsedRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const pushField = () => {
    cells.push(field);
    field = "";
    fieldStarted = false;
  };
  const pushRecord = () => {
    pushField();
    records.push({ cells });
    cells = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (char === ",") {
      pushField();
      continue;
    }
    if (char === "\r" && text[index + 1] === "\n") {
      pushRecord();
      index += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      pushRecord();
      continue;
    }
    field += char;
    fieldStarted = true;
  }

  if (inQuotes) {
    return null;
  }

  if (fieldStarted || field !== "" || cells.length > 0) {
    pushRecord();
  }

  return records;
}

function isRecordEmpty(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

export function parseSheetCsv(text: string): SheetParseResult {
  const withoutBom = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const parsed = parseRecords(withoutBom);

  if (parsed === null || parsed.length === 0) {
    return { ok: false, message: INVALID_CSV_ERROR };
  }

  const [header, ...dataRecords] = parsed;
  const headerMatches =
    header.cells.length === SHEET_COLUMNS.length &&
    header.cells.every((cell, index) => cell.trim() === SHEET_COLUMNS[index]);

  if (!headerMatches) {
    return { ok: false, message: STRUCTURE_ERROR };
  }

  const rows: SheetCellsRow[] = [];
  for (let index = 0; index < dataRecords.length; index += 1) {
    const record = dataRecords[index];
    if (isRecordEmpty(record.cells)) continue;
    rows.push({ line: index + 2, cells: record.cells });
  }

  if (rows.length === 0) {
    return { ok: false, message: NO_MOVEMENTS_ERROR };
  }

  return { ok: true, rows };
}
