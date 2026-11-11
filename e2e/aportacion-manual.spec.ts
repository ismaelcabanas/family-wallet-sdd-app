import { expect, test, type Page } from "@playwright/test";

const MONTH = "2026-05";
const MONTH_LABEL = "Mayo de 2026";
const ACCOUNT_URL = `/accounts/2?month=${MONTH}`;
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro B";
const EUR = "[\\s\\u00A0\\u202F]€";
const CONTRIBUTION_CHIP = "Aportación Común";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function contributionRows(page: Page) {
  return movementList(page).getByRole("listitem").filter({ hasText: CONTRIBUTION_CHIP });
}

function kpisRegion(page: Page) {
  return page.getByRole("region", { name: "KPIs del mes" });
}

function kpiCell(page: Page, label: string) {
  return kpisRegion(page).getByText(label).locator("..");
}

async function openAccountMonth(page: Page): Promise<void> {
  await page.goto(ACCOUNT_URL);
  await expect(page.getByRole("heading", { name: "Cuenta de Miembro B", exact: true })).toBeVisible();
  await expect(kpisRegion(page).getByText(MONTH_LABEL)).toBeVisible();
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

async function registerContribution(
  page: Page,
  fields: { amount: string; note?: string },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("radio", { name: "Aportación común" }).check();
  await dialog.getByLabel("Fecha").fill(fields.note === undefined ? "2026-05-10" : "2026-05-12");
  await dialog.getByLabel("Importe (€)").fill(fields.amount);
  if (fields.note !== undefined) {
    await dialog.getByLabel("Nota", { exact: true }).fill(fields.note);
  }
  await dialog.getByRole("button", { name: "Guardar y cerrar" }).click();
}

async function deleteMovementByLabel(page: Page, ariaLabel: string): Promise<void> {
  await movementList(page).getByRole("button", { name: ariaLabel }).first().click();
  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
  await expect(page.getByText("Movimiento eliminado").last()).toBeVisible({ timeout: 10_000 });
}

test.describe("registro manual de la aportación común en meses pasados (032)", () => {
  test.describe.configure({ mode: "serial" });

  test("M1: configura ingreso regular y aportación del Miembro B", async ({ page }) => {
    await configureIncomeAndContribution(page);
  });

  test("M2: registra a mano la aportación de un mes pasado → listado + KPIs coherentes por construcción", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await expect(
      kpiCell(page, "Aportación común").getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible();

    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const expenseDialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expenseDialog.getByLabel("Nota", { exact: true }).fill("Gasto variado mayo");
    await expenseDialog.getByLabel("Fecha").fill("2026-05-08");
    await expenseDialog.getByLabel("Importe (€)").fill("100,00");
    await expenseDialog.getByRole("radio", { name: "Personal", exact: true }).check();
    await expenseDialog.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Ocio", exact: true }).click();
    await expenseDialog.getByRole("button", { name: "Guardar y cerrar" }).click();
    await expect(expenseDialog).not.toBeVisible({ timeout: 10_000 });

    await registerContribution(page, { amount: "300,00" });
    await expect(page.getByText("Aportación registrada")).toBeVisible({ timeout: 10_000 });

    const row = contributionRows(page).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("−300,00");
    await expect(row).toContainText("Aportación común");

    await expect(
      kpiCell(page, "Aportación común").getByText(new RegExp(`^300,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      kpiCell(page, "Gasto personal").getByText(new RegExp(`^100,00${EUR}`)),
    ).toBeVisible();
    await expect(
      kpiCell(page, "Saldo del mes").getByText(new RegExp(`^\u2212400,00${EUR}`)),
    ).toBeVisible();
  });

  test("M3: segundo movimiento de aportación en el mismo mes → error de unicidad y nada se guarda", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await registerContribution(page, { amount: "50,00", note: "Extra" });
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("alert").filter({ hasText: "Ya existe una aportación registrada para este mes." }),
    ).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();

    await page.reload();
    await expect(contributionRows(page)).toHaveCount(1);
    await expect(
      kpiCell(page, "Aportación común").getByText(new RegExp(`^300,00${EUR}`)),
    ).toBeVisible();
  });

  test("M4: el resumen global del mes cuenta la aportación como gasto", async ({ page }) => {
    await page.goto(`/summary?month=${MONTH}`);
    const panel = page.getByRole("region", { name: "Resumen global de Mayo de 2026" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/Gastos personales: 400,00/)).toBeVisible();
  });

  test("M5: borrar la aportación elimina movimiento y registro (regla «0 o 1» reversible)", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await deleteMovementByLabel(page, "Eliminar Aportación común");

    await expect(contributionRows(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(
      kpiCell(page, "Aportación común").getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    await registerContribution(page, { amount: "250,00", note: "Aportación corregida" });
    await expect(page.getByText("Aportación registrada")).toBeVisible({ timeout: 10_000 });
    await expect(
      kpiCell(page, "Aportación común").getByText(new RegExp(`^250,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("M6: editar la aportación solo permite importe/fecha/nota con identidad bloqueada", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await movementList(page).getByRole("button", { name: "Editar Aportación corregida" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();

    await expect(dialog.getByRole("radio", { name: "Aportación común" })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: "Gasto" })).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: "Ingreso" })).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: "Aportación común" })).toBeDisabled();
    await expect(dialog.getByRole("combobox", { name: "Etiqueta" })).toHaveCount(0);

    await dialog.getByLabel("Importe (€)").fill("275,00");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Movimiento actualizado")).toBeVisible({ timeout: 10_000 });

    await expect(
      kpiCell(page, "Aportación común").getByText(new RegExp(`^275,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("M7: limpieza total UI-driven — movimientos borrados y configs desactivadas", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await deleteMovementByLabel(page, "Eliminar Aportación corregida");
    await expect(contributionRows(page)).toHaveCount(0, { timeout: 10_000 });

    await deleteMovementByLabel(page, "Eliminar Gasto variado mayo");
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Gasto variado mayo" }),
    ).toHaveCount(0, { timeout: 10_000 });

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

    await openAccountMonth(page);
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible();
    await expect(
      kpiCell(page, "Aportación común").getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible();
  });
});
