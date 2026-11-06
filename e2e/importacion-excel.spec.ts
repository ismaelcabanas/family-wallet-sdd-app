import { expect, test, type Page } from "@playwright/test";

const SHEET_COLUMNS = [
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
];

function csvRow(cells: string[]): string {
  return cells
    .map((cell) =>
      cell.includes(",") || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell,
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

function sheetCsv(rows: string[]): Buffer {
  return Buffer.from([SHEET_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n", "utf-8");
}

const HAPPY_ROWS = [
  sheetRow({ 1: "Luz marzo", 3: "Gasto Común", 4: "42.21", 5: "Hogar" }),
  sheetRow({ 1: "Regalo", 2: "Cumple David", 3: "Gasto", 4: "50", 5: "Regalos" }),
  sheetRow({ 1: "Nomina", 3: "Ingreso", 4: "2000" }),
  sheetRow({ 1: "Aportación Común", 3: "Gasto Fijo", 4: "1920", 5: "Hogar" }),
];

async function selectAccountAndMonth(page: Page): Promise<void> {
  await page.goto("/import");
  await page.getByRole("combobox", { name: "Cuenta" }).click();
  await page.getByRole("option", { name: "Cuenta común" }).click();
  await page.getByRole("combobox", { name: "Mes" }).click();
  await page.getByRole("option", { name: "Marzo de 2027" }).click();
}

async function attachCsv(page: Page, csv: Buffer): Promise<void> {
  await page.setInputFiles("#import-sheet-file", {
    name: "marzo-2027.csv",
    mimeType: "text/csv",
    buffer: csv,
  });
}

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

test.describe("importación de la hoja mensual desde CSV (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("I1: subida → previsualización → confirmación → listado en Cuenta común · marzo 2027", async ({
    page,
  }) => {
    await selectAccountAndMonth(page);
    await attachCsv(page, sheetCsv(HAPPY_ROWS));

    await page.getByRole("button", { name: "Previsualizar importación" }).click();

    const summary = page.getByRole("region", { name: "Resumen de la importación" });
    await expect(summary).toBeVisible({ timeout: 10_000 });
    await expect(summary.getByText("3 movimientos para Cuenta común · Marzo de 2027")).toBeVisible();
    await expect(summary.getByText(/Gastos compartidos:.*42,21/)).toBeVisible();
    await expect(summary.getByText(/Gastos personales:.*50,00/)).toBeVisible();
    await expect(summary.getByText(/Ingresos:.*2000,00/)).toBeVisible();
    await expect(
      summary.getByRole("region", { name: "Filas ignoradas" }).getByText(/Fila 5: fila de configuración/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Confirmar importación (3 movimientos)" }).click();

    await expect(page.getByText("Importación completada: 3 movimientos")).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("link", { name: "Ver los movimientos en Cuenta común · Marzo de 2027" })
      .click();

    await expect(page).toHaveURL(/\/accounts\/3\?month=2027-03/);
    await expect(movementList(page).getByRole("heading", { name: "1 de marzo de 2027" })).toBeVisible();
    const luz = movementList(page).getByRole("listitem").filter({ hasText: "Luz marzo" });
    await expect(luz).toBeVisible({ timeout: 10_000 });
    await expect(luz).toContainText("−42,21");
    await expect(luz).toContainText("Común");
    await expect(luz).toContainText("Hogar");

    const regalo = movementList(page).getByRole("listitem").filter({ hasText: "Regalo — Cumple David" });
    await expect(regalo).toBeVisible();
    await expect(regalo).toContainText("−50,00");
    await expect(regalo).toContainText("Personal");
    await expect(regalo).toContainText("Regalos");

    const nomina = movementList(page).getByRole("listitem").filter({ hasText: "Nomina" });
    await expect(nomina).toBeVisible();
    await expect(nomina).toContainText("+2000,00");
  });

  test("I2: fila inválida → error por fila, confirmar deshabilitado y nada creado (SC-003)", async ({
    page,
  }) => {
    await selectAccountAndMonth(page);
    await attachCsv(
      page,
      sheetCsv([
        sheetRow({ 1: "Válido", 3: "Gasto Común", 4: "10", 5: "Ocio" }),
        sheetRow({ 1: "Roto", 3: "Gasto Común", 4: "abc", 5: "Ocio" }),
      ]),
    );

    await page.getByRole("button", { name: "Previsualizar importación" }).click();

    const summary = page.getByRole("region", { name: "Resumen de la importación" });
    await expect(summary).toBeVisible({ timeout: 10_000 });
    await expect(
      summary.getByRole("alert", { name: "Filas con error" }).getByText(/Fila 3: .*importe/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirmar importación (1 movimiento)" }),
    ).toBeDisabled();

    await page.goto("/accounts/3?month=2027-03");
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Válido" }),
    ).toHaveCount(0);
  });

  test("I3: estructura no reconocida → error de formato sin previsualización ni altas", async ({
    page,
  }) => {
    await selectAccountAndMonth(page);
    const renamed = [...SHEET_COLUMNS];
    renamed[1] = "Nombre";
    const badCsv = Buffer.from(
      [renamed.join(","), sheetRow({ 1: "Nada", 3: "Gasto", 4: "10", 5: "Ocio" })].join("\r\n"),
      "utf-8",
    );
    await page.setInputFiles("#import-sheet-file", {
      name: "malo.csv",
      mimeType: "text/csv",
      buffer: badCsv,
    });

    await page.getByRole("button", { name: "Previsualizar importación" }).click();

    await expect(
      page.getByRole("alert").filter({
        hasText: /La estructura del fichero no coincide con la esperada/,
      }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("region", { name: "Resumen de la importación" })).toHaveCount(0);

    await page.goto("/accounts/3?month=2027-03");
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Nada" }),
    ).toHaveCount(0);
  });
});
