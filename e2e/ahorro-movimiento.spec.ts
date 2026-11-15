import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@libsql/client";

const MONTH = "2026-05";
const MONTH_LABEL = "Mayo de 2026";
const ACCOUNT_URL = `/accounts/1?month=${MONTH}`;
const CURRENT_ACCOUNT_URL = "/accounts/1";
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro A";
const EUR = "[\\s\\u00A0\\u202F]€";
const SAVINGS_CHIP = "Ahorro";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function savingsRows(page: Page) {
  return movementList(page).getByRole("listitem").filter({ hasText: SAVINGS_CHIP });
}

function kpisRegion(page: Page) {
  return page.getByRole("region", { name: "KPIs del mes" });
}

function kpiCell(page: Page, label: string) {
  return kpisRegion(page).getByText(label).locator("..");
}

async function openAccountMonth(page: Page): Promise<void> {
  await page.goto(ACCOUNT_URL);
  await expect(page.getByRole("heading", { name: "Cuenta de Miembro A", exact: true })).toBeVisible();
  await expect(kpisRegion(page).getByText(MONTH_LABEL)).toBeVisible();
}

async function configureIncomeAndSavings(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular/ }).click();
  const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
  await incomeDialog.getByLabel("Importe (€)").fill("3000,00");
  await incomeDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ingreso regular guardado")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Ahorro/ }).click();
  const savingsDialog = page.getByRole("dialog", { name: "Ahorro mensual" });
  await savingsDialog.getByLabel("Porcentaje (%)").fill("10");
  await savingsDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ahorro guardado")).toBeVisible({ timeout: 10_000 });
}

async function registerSavings(
  page: Page,
  fields: { amount: string; note?: string },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("radio", { name: "Ahorro" }).check();
  await dialog.getByLabel("Fecha").fill("2026-05-10");
  await dialog.getByLabel("Importe (€)").fill(fields.amount);
  if (fields.note !== undefined) {
    await dialog.getByLabel("Nota", { exact: true }).fill(fields.note);
  }
  await dialog.getByRole("button", { name: "Guardar y cerrar" }).click();
}

async function deleteMovementByNote(page: Page, note: string): Promise<void> {
  await movementList(page).getByRole("button", { name: `Eliminar ${note}` }).first().click();
  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
  await expect(
    movementList(page).getByRole("listitem").filter({ hasText: note }),
  ).toHaveCount(0, { timeout: 10_000 });
}

async function wipeAccount1State(): Promise<void> {
  const client = createClient({ url: "file:./e2e.sqlite" });
  try {
    await client.execute(
      "DELETE FROM savings_allocation_months WHERE savings_allocation_id IN (SELECT id FROM savings_allocations WHERE account_id = 1)",
    );
    await client.execute("DELETE FROM savings_allocations WHERE account_id = 1");
    await client.execute(
      "DELETE FROM regular_income_months WHERE regular_income_id IN (SELECT id FROM regular_incomes WHERE account_id = 1)",
    );
    await client.execute("DELETE FROM regular_incomes WHERE account_id = 1");
    await client.execute("DELETE FROM movements WHERE account_id = 1");
  } finally {
    client.close();
  }
}

test.describe("el ahorro como movimiento: alta manual, unicidad, edición, borrado y materializador (033)", () => {
  test.describe.configure({ mode: "serial" });

  test("H1: configura ingreso regular 3.000 y ahorro 10 % del Miembro A", async ({ page }) => {
    await configureIncomeAndSavings(page);
  });

  test("H2: registra a mano el ahorro de un mes pasado → listado + KPIs coherentes por construcción", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^0,00${EUR}`)),
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

    await registerSavings(page, { amount: "250,00" });
    await expect(page.getByText("Ahorro registrado")).toBeVisible({ timeout: 10_000 });

    const row = savingsRows(page).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("−250,00");
    await expect(row).toContainText("Ahorro");

    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^250,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      kpiCell(page, "Gasto personal").getByText(new RegExp(`^100,00${EUR}`)),
    ).toBeVisible();
    await expect(
      kpiCell(page, "Saldo del mes").getByText(new RegExp(`^\u2212350,00${EUR}`)),
    ).toBeVisible();
  });

  test("H3: el resumen global del mes cuenta el ahorro como gasto", async ({ page }) => {
    await page.goto(`/summary?month=${MONTH}`);
    const panel = page.getByRole("region", { name: "Resumen global de Mayo de 2026" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/Gastos personales: 350,00/)).toBeVisible();
  });

  test("H4: segundo ahorro en el mismo mes → error de unicidad y nada se guarda", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await registerSavings(page, { amount: "50,00", note: "Extra" });
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog
        .getByRole("alert")
        .filter({ hasText: "Ya existe un ahorro registrado para este mes." }),
    ).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();

    await page.reload();
    await expect(savingsRows(page)).toHaveCount(1);
    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^250,00${EUR}`)),
    ).toBeVisible();
  });

  test("H5: editar el ahorro solo permite importe/fecha/nota con identidad bloqueada", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await movementList(page).getByRole("button", { name: "Eliminar Ahorro" }).first().waitFor();
    await movementList(page).getByRole("button", { name: "Editar Ahorro" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();

    await expect(dialog.getByRole("radio", { name: "Ahorro" })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: "Gasto" })).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: "Ingreso" })).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: "Ahorro" })).toBeDisabled();
    await expect(dialog.getByRole("combobox", { name: "Etiqueta" })).toHaveCount(0);

    await dialog.getByLabel("Importe (€)").fill("275,00");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Movimiento actualizado")).toBeVisible({ timeout: 10_000 });

    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^275,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("H6: borrar el ahorro es uniforme y reversible (mes a 0 y admite otro registro)", async ({
    page,
  }) => {
    await openAccountMonth(page);

    await deleteMovementByNote(page, "Ahorro");

    await expect(savingsRows(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    await registerSavings(page, { amount: "300,00" });
    await expect(page.getByText("Ahorro registrado")).toBeVisible({ timeout: 10_000 });
    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^300,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("H7: el materializador crea el ahorro del mes en curso como movimiento idempotente", async ({
    page,
  }) => {
    await page.goto(CURRENT_ACCOUNT_URL);

    const row = savingsRows(page).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("−300,00");
    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^300,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(savingsRows(page)).toHaveCount(1);
    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^300,00${EUR}`)),
    ).toBeVisible();

    await deleteMovementByNote(page, "Ahorro");
    await expect(savingsRows(page)).toHaveCount(0, { timeout: 10_000 });

    await page.reload();
    await expect(savingsRows(page)).toHaveCount(1, { timeout: 10_000 });
    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^300,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("H8: limpieza total — movimientos retirados por UI y configs restauradas al estado de seed", async ({
    page,
  }) => {
    await page.goto(CURRENT_ACCOUNT_URL);
    await deleteMovementByNote(page, "Ingreso regular de Miembro A");

    await openAccountMonth(page);
    await deleteMovementByNote(page, "Ahorro");
    await deleteMovementByNote(page, "Gasto variado mayo");
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible();

    await wipeAccount1State();

    await page.goto("/");
    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular\s*Sin configurar/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await openAccountMonth(page);
    await expect(
      kpiCell(page, "Ahorro del mes").getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible();
    await expect(kpiCell(page, "Ahorro del mes").getByText("Sin ahorro configurado")).toBeVisible();
  });
});
