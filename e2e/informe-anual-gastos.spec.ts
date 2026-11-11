import { expect, test, type Page } from "@playwright/test";

const YEAR = "2024";

const EUR = "[\\s\\u00A0\\u202F]€";
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro B";

async function openAccount(page: Page, accountName: string, month: string): Promise<void> {
  await page.goto(`/accounts/${accountName === "Cuenta común" ? 3 : accountName === "Cuenta de Miembro B" ? 2 : 1}?month=${month}`);
  await expect(page.getByRole("heading", { name: accountName, exact: true })).toBeVisible();
}

async function registerMovement(
  page: Page,
  fields: {
    note: string;
    amount: string;
    date: string;
    nature?: "personal" | "shared";
    tag?: string;
  },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo movimiento" })).toBeVisible();

  await page.getByLabel("Fecha", { exact: true }).fill(fields.date);
  await page.getByLabel("Nota", { exact: true }).fill(fields.note);
  await page.getByLabel("Importe (€)").fill(fields.amount);

  if (fields.nature === "personal") {
    await page.getByRole("radio", { name: "Personal", exact: true }).check();
  } else if (fields.nature === "shared") {
    await page.getByRole("radio", { name: "Compartido", exact: true }).check();
  }

  if (fields.tag !== undefined) {
    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: fields.tag, exact: true }).click();
  }

  await page.getByRole("button", { name: "Guardar y cerrar" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo movimiento" })).not.toBeVisible({
    timeout: 10_000,
  });

  await expect(
    page
      .getByRole("region", { name: "Movimientos del mes" })
      .getByRole("listitem")
      .filter({ hasText: fields.note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function registerManualContribution(
  page: Page,
  fields: { note: string; amount: string; date: string },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("radio", { name: "Aportación común" }).check();
  await dialog.getByLabel("Fecha", { exact: true }).fill(fields.date);
  await dialog.getByLabel("Nota", { exact: true }).fill(fields.note);
  await dialog.getByLabel("Importe (€)").fill(fields.amount);
  await dialog.getByRole("button", { name: "Guardar y cerrar" }).click();
  await expect(page.getByText("Aportación registrada").last()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await expect(
    page
      .getByRole("region", { name: "Movimientos del mes" })
      .getByRole("listitem")
      .filter({ hasText: fields.note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function configureIncomeAndContribution(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular/ }).click();
  const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
  await incomeDialog.getByLabel("Importe (€)").fill("2000,00");
  await incomeDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ingreso regular guardado")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Aportación/ }).click();
  const contributionDialog = page.getByRole("dialog", { name: "Aportación a la cuenta común" });
  await contributionDialog.getByLabel("Porcentaje (%)").fill("25");
  await contributionDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Aportación guardada")).toBeVisible({ timeout: 10_000 });
}

async function deactivateIncomeAndContribution(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Aportación/ }).click();
  const contributionDialog = page.getByRole("dialog", { name: "Aportación a la cuenta común" });
  await contributionDialog.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("Aportación desactivada")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular/ }).click();
  const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
  await incomeDialog.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("Ingreso regular desactivado")).toBeVisible({ timeout: 10_000 });
}

async function deleteMovement(page: Page, note: string): Promise<void> {
  await page
    .getByRole("region", { name: "Movimientos del mes" })
    .getByRole("button", { name: `Eliminar ${note}` })
    .first()
    .click();
  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
  await expect(page.getByText("Movimiento eliminado").last()).toBeVisible({ timeout: 10_000 });
  await expect(
    page
      .getByRole("region", { name: "Movimientos del mes" })
      .getByRole("listitem")
      .filter({ hasText: note }),
  ).toHaveCount(0, { timeout: 10_000 });
}

async function createCategoryAndTag(page: Page, category: string, tag: string): Promise<void> {
  await page.goto("/tags");
  await expect(page.getByRole("heading", { name: "Etiquetas", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  const categoryDialog = page.getByRole("dialog", { name: "Nueva etiqueta" });
  await expect(categoryDialog).toBeVisible();
  await categoryDialog.getByLabel("Nombre").fill(category);
  await categoryDialog.getByRole("button", { name: "Crear" }).click();
  await expect(page.getByText("Categoría creada")).toBeVisible({ timeout: 10_000 });
  await expect(categoryDialog).not.toBeVisible();

  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  const tagDialog = page.getByRole("dialog", { name: "Nueva etiqueta" });
  await expect(tagDialog).toBeVisible();
  await tagDialog.getByLabel("Nombre").fill(tag);
  await tagDialog.getByRole("combobox", { name: "Categoría" }).click();
  await page.getByRole("option", { name: category, exact: true }).click();
  await tagDialog.getByRole("button", { name: "Crear" }).click();
  await expect(page.getByText("Etiqueta creada")).toBeVisible({ timeout: 10_000 });
  await expect(tagDialog).not.toBeVisible();
}

function reportTable(page: Page, year: string = YEAR) {
  return page.getByRole("table", { name: `Informe de gastos por categoría de ${year}` });
}

function categoryRow(page: Page, name: string) {
  return reportTable(page).getByRole("row", { name: new RegExp(`^${name}`) });
}

test.describe("informe anual de gastos por categorías", () => {
  test.describe.configure({ mode: "serial" });

  test("I1: estructura fija, celdas por categoría×mes, medias ÷ 12 y exclusión de la aportación común", async ({
    page,
  }) => {
    await createCategoryAndTag(page, "Transportes", "Gasolina");

    await openAccount(page, "Cuenta de Miembro A", `${YEAR}-01`);
    await registerMovement(page, {
      note: "Compra enero A",
      amount: "40,00",
      date: `${YEAR}-01-12`,
      nature: "shared",
      tag: "Alimentación",
    });

    await openAccount(page, "Cuenta común", `${YEAR}-01`);
    await registerMovement(page, {
      note: "Compra enero común",
      amount: "15,00",
      date: `${YEAR}-01-20`,
      tag: "Alimentación",
    });

    await openAccount(page, "Cuenta de Miembro B", `${YEAR}-03`);
    await registerMovement(page, {
      note: "Gasolina B marzo",
      amount: "30,00",
      date: `${YEAR}-03-08`,
      nature: "personal",
      tag: "Gasolina",
    });

    await configureIncomeAndContribution(page);
    await openAccount(page, "Cuenta de Miembro B", `${YEAR}-03`);
    await registerManualContribution(page, {
      note: "Aportación manual excluida",
      amount: "20,00",
      date: `${YEAR}-03-10`,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Informes" }).click();
    await page.getByRole("menuitem", { name: "Gastos por categoría" }).click();
    await expect(page).toHaveURL(/\/reports\/annual-expenses$/);

    await page.getByRole("combobox", { name: "Año visible" }).click();
    await page.getByRole("option", { name: YEAR, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/reports/annual-expenses\\?year=${YEAR}$`));

    const table = reportTable(page);
    await expect(table).toBeVisible();
    await expect(page.getByRole("heading", { name: `Informe anual de gastos de ${YEAR}` })).toBeVisible();

    const columnHeaders = table.getByRole("columnheader");
    await expect(columnHeaders).toHaveCount(14);
    await expect(columnHeaders.nth(1)).toHaveText("Ene");
    await expect(columnHeaders.nth(12)).toHaveText("Dic");
    await expect(columnHeaders.nth(13)).toHaveText("Media anual");

    const bodyRows = table.getByRole("rowgroup").nth(1).getByRole("row");
    await expect(bodyRows).toHaveCount(2);

    const general = categoryRow(page, "General");
    const generalCells = general.getByRole("cell");
    await expect(generalCells).toHaveCount(13);
    await expect(generalCells.nth(0)).toContainText(new RegExp(`55,00${EUR}`));
    await expect(generalCells.nth(2)).toContainText(new RegExp(`0,00${EUR}`));
    await expect(generalCells.nth(12)).toContainText(new RegExp(`4,58${EUR}`));

    const transportes = categoryRow(page, "Transportes");
    const transportesCells = transportes.getByRole("cell");
    await expect(transportesCells.nth(2)).toContainText(new RegExp(`30,00${EUR}`));
    await expect(transportesCells.nth(0)).toContainText(new RegExp(`0,00${EUR}`));
    await expect(transportesCells.nth(12)).toContainText(new RegExp(`2,50${EUR}`));

    const monthlyTotal = table.getByRole("row", { name: /^Gasto mensual/ });
    const monthlyTotalCells = monthlyTotal.getByRole("cell");
    await expect(monthlyTotalCells.nth(0)).toContainText(new RegExp(`55,00${EUR}`));
    await expect(monthlyTotalCells.nth(2)).toContainText(new RegExp(`30,00${EUR}`));
    await expect(monthlyTotalCells.nth(12)).toContainText(new RegExp(`7,08${EUR}`));

    const personal = table.getByRole("row", { name: /^Gastos personales/ });
    const personalCells = personal.getByRole("cell");
    await expect(personalCells.nth(0)).toContainText(new RegExp(`0,00${EUR}`));
    await expect(personalCells.nth(2)).toContainText(new RegExp(`30,00${EUR}`));
    await expect(personalCells.nth(12)).toContainText(new RegExp(`2,50${EUR}`));

    await openAccount(page, "Cuenta de Miembro B", `${YEAR}-03`);
    await deleteMovement(page, "Aportación manual excluida");
    await deactivateIncomeAndContribution(page);
  });

  test("I2: año sin movimientos muestra la estructura completa a 0,00 €", async ({ page }) => {
    await page.goto(`/reports/annual-expenses?year=2023`);

    const table = reportTable(page, "2023");
    await expect(table).toBeVisible();

    const general = table.getByRole("row", { name: /^General/ }).getByRole("cell");
    await expect(general).toHaveCount(13);
    for (let month = 0; month < 13; month += 1) {
      await expect(general.nth(month)).toContainText(new RegExp(`0,00${EUR}`));
    }

    const monthlyTotal = table.getByRole("row", { name: /^Gasto mensual/ }).getByRole("cell");
    await expect(monthlyTotal.nth(0)).toContainText(new RegExp(`0,00${EUR}`));
    await expect(monthlyTotal.nth(12)).toContainText(new RegExp(`0,00${EUR}`));

    const personal = table.getByRole("row", { name: /^Gastos personales/ }).getByRole("cell");
    await expect(personal.nth(12)).toContainText(new RegExp(`0,00${EUR}`));
  });

  test("I3: «Resumen global» y «Cuenta de resultados» siguen siendo enlaces directos", async ({
    page,
  }) => {
    await page.goto(`/reports/annual-expenses?year=${YEAR}`);

    const summary = page.getByRole("link", { name: "Resumen global" });
    await expect(summary).toHaveAttribute("href", `/summary?month=${YEAR}-01`);

    const annual = page.getByRole("link", { name: "Cuenta de resultados" });
    await expect(annual).toHaveAttribute("href", `/annual?year=${YEAR}`);
  });
});
