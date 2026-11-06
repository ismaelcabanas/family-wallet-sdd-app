import type { SheetImportPreviewDTO } from "@/application/import/dto";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import { describe, expect, it, vi, type Mock } from "vitest";

const { previewExecuteMock, confirmExecuteMock } = vi.hoisted(() => ({
  previewExecuteMock: vi.fn(),
  confirmExecuteMock: vi.fn(),
}));

vi.mock("@/application/import/BuildSheetImportPreview", () => ({
  BuildSheetImportPreview: vi.fn().mockImplementation(function () {
    return { execute: previewExecuteMock };
  }),
}));

vi.mock("@/application/import/ConfirmSheetImport", () => ({
  ConfirmSheetImport: vi.fn().mockImplementation(function () {
    return { execute: confirmExecuteMock };
  }),
}));

vi.mock("@/infrastructure/db/DrizzleAccountRepository", () => ({
  DrizzleAccountRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));
vi.mock("@/infrastructure/db/DrizzleTagRepository", () => ({
  DrizzleTagRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));
vi.mock("@/infrastructure/db/DrizzleTagCategoryRepository", () => ({
  DrizzleTagCategoryRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));
vi.mock("@/infrastructure/db/DrizzleSheetImportRepository", () => ({
  DrizzleSheetImportRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import { importSheetAction } from "@/infrastructure/primary/actions/import-sheet.action";
import { SHEET_COLUMNS } from "@/infrastructure/primary/actions/sheet-csv";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

const HEADER = SHEET_COLUMNS.join(",");
const VALID_ROW = ',"Carrera",,"Gasto","7.85","Ocio",,,,,,,';

function csvFile(content: string, name = "hoja.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

const PREVIEW_DTO: SheetImportPreviewDTO = {
  accountName: "Cuenta común",
  month: "2026-01",
  rows: [
    {
      line: 2,
      status: "ok",
      movement: {
        date: "2026-01-01",
        note: "Carrera",
        amountCents: 785,
        type: "expense",
        nature: "personal",
        tagName: "Ocio",
        createsTag: false,
      },
    },
  ],
  totals: {
    movements: 1,
    personalExpenseCents: 785,
    sharedExpenseCents: 0,
    incomeCents: 0,
    ignored: 0,
    errors: 0,
  },
  tagsToCreate: [],
};

function baseInput(overrides: Partial<{ accountId: string; month: string; intent: "preview" | "confirm"; file: File }> = {}) {
  return {
    accountId: "3",
    month: "2026-01",
    intent: "preview" as const,
    file: csvFile(`${HEADER}\r\n${VALID_ROW}\r\n`),
    ...overrides,
  };
}

describe("importSheetAction (Server Action)", () => {
  it.each([
    [{ accountId: "" }, "Selecciona una cuenta."],
    [{ month: "" }, "Selecciona un mes."],
    [{ month: "2026-1" }, "Selecciona un mes."],
    [{ file: undefined as unknown as File }, "Adjunta el fichero CSV de la hoja mensual."],
  ])("args inválidos %o → error congelado sin tocar los casos de uso", async (overrides, message) => {
    const result = await importSheetAction(baseInput(overrides));

    expect(result).toEqual({ status: "error", message });
    expect(previewExecuteMock).not.toHaveBeenCalled();
    expect(confirmExecuteMock).not.toHaveBeenCalled();
  });

  it("intent inválido → mensaje genérico", async () => {
    const result = await importSheetAction(
      baseInput({ intent: "otro" as unknown as "preview" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "No se ha podido procesar la importación. Inténtalo de nuevo.",
    });
  });

  it("fichero mayor de 512 KB → error de tamaño", async () => {
    const big = new File([new ArrayBuffer(512 * 1024 + 1)], "hoja.csv");
    const result = await importSheetAction(baseInput({ file: big }));

    expect(result).toEqual({
      status: "error",
      message: "El fichero es demasiado grande (máximo 512 KB).",
    });
  });

  it("fichero sin extensión .csv → error de formato", async () => {
    const result = await importSheetAction(baseInput({ file: csvFile(HEADER, "hoja.txt") }));

    expect(result).toEqual({
      status: "error",
      message: "El fichero debe ser un CSV exportado de Google Sheets.",
    });
  });

  it("CSV ilegible (comilla sin cerrar) → «El fichero no es un CSV válido.»", async () => {
    const result = await importSheetAction(baseInput({ file: csvFile(`${HEADER}\r\n,"Carrera`) }));

    expect(result).toEqual({ status: "error", message: "El fichero no es un CSV válido." });
  });

  it("cabecera que no coincide → error de estructura sin previsualización", async () => {
    const renamed = [...SHEET_COLUMNS];
    renamed[0] = "Fecha";
    const result = await importSheetAction(baseInput({ file: csvFile(`${renamed.join(",")}\r\n${VALID_ROW}\r\n`) }));

    expect(result).toEqual({
      status: "error",
      message:
        "La estructura del fichero no coincide con la esperada (cabecera de 13 columnas de la hoja mensual).",
    });
  });

  it("sin filas de datos → «El fichero no contiene movimientos.»", async () => {
    const result = await importSheetAction(baseInput({ file: csvFile(`${HEADER}\r\n`) }));

    expect(result).toEqual({ status: "error", message: "El fichero no contiene movimientos." });
  });

  it("intent=preview → {status:\"preview\"} con el DTO y sin revalidar", async () => {
    previewExecuteMock.mockResolvedValueOnce(PREVIEW_DTO);

    const result = await importSheetAction(baseInput({ intent: "preview" }));

    expect(result).toEqual({ status: "preview", preview: PREVIEW_DTO });
    expect(previewExecuteMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 3,
      month: "2026-01",
      rows: [{ line: 2, cells: ["", "Carrera", "", "Gasto", "7.85", "Ocio", "", "", "", "", "", "", ""] }],
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("intent=confirm en éxito → {status:\"imported\"} y revalidatePath del layout", async () => {
    confirmExecuteMock.mockResolvedValueOnce({
      status: "imported",
      movementsCreated: 13,
      tagsCreated: 1,
    });

    const result = await importSheetAction(baseInput({ intent: "confirm" }));

    expect(result).toEqual({
      status: "imported",
      movementsCreated: 13,
      tagsCreated: 1,
      accountId: 3,
      month: "2026-01",
    });
    expect(confirmExecuteMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 3,
      month: "2026-01",
      rows: [{ line: 2, cells: ["", "Carrera", "", "Gasto", "7.85", "Ocio", "", "", "", "", "", "", ""] }],
    });
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/", "layout");
  });

  it("AccountNotFoundError → «Selecciona una cuenta.»", async () => {
    previewExecuteMock.mockRejectedValueOnce(new AccountNotFoundError());

    const result = await importSheetAction(baseInput());

    expect(result).toEqual({ status: "error", message: "Selecciona una cuenta." });
  });

  it("CategoryNotFoundError → mensaje de categoría General", async () => {
    previewExecuteMock.mockRejectedValueOnce(new CategoryNotFoundError());

    const result = await importSheetAction(baseInput());

    expect(result).toEqual({
      status: "error",
      message: "No se ha podido preparar la importación (falta la categoría General). Inténtalo de nuevo.",
    });
  });

  it("confirm con plan inválido → «La previsualización ya no es válida…» sin revalidar", async () => {
    confirmExecuteMock.mockResolvedValueOnce({ status: "invalid" });

    const result = await importSheetAction(baseInput({ intent: "confirm" }));

    expect(result).toEqual({
      status: "error",
      message:
        "La previsualización ya no es válida (p. ej. una etiqueta ha cambiado). Revisa el fichero y vuelve a previsualizarlo.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("error inesperado de persistencia → mensaje de rollback sin lanzar al cliente", async () => {
    confirmExecuteMock.mockRejectedValueOnce(new Error("boom"));

    const result = await importSheetAction(baseInput({ intent: "confirm" }));

    expect(result).toEqual({
      status: "error",
      message: "No se ha podido importar. No se ha creado ningún movimiento; inténtalo de nuevo.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
