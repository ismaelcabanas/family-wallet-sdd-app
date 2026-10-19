import { expect, test, type Page } from "@playwright/test";

const MONTH_LONG_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTH_LONG_NAMES[now.getMonth()]} de ${now.getFullYear()}`;
}

function currentYear(): string {
  return String(new Date().getFullYear());
}

const ACCOUNT_URL = "/accounts/2";
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro B";
const CONTRIBUTION_NOTE = "Aportación común de Miembro B";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function contributionItems(page: Page) {
  return movementList(page).getByRole("listitem").filter({ hasText: CONTRIBUTION_NOTE });
}

async function openAccount(page: Page): Promise<void> {
  await page.goto(ACCOUNT_URL);
  await expect(page.getByRole("heading", { name: "Cuenta de Miembro B", exact: true })).toBeVisible();
}

async function registerMovement(
  page: Page,
  fields: {
    note: string;
    amount: string;
    type?: "expense" | "income";
    nature?: "personal" | "shared";
    tag?: string;
  },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo movimiento" })).toBeVisible();

  await page.getByLabel("Nota", { exact: true }).fill(fields.note);
  await page.getByLabel("Importe (€)").fill(fields.amount);

  if (fields.type === "income") {
    await page.getByRole("radio", { name: "Ingreso" }).check();
  }

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
    movementList(page)
      .getByRole("listitem")
      .filter({ hasText: fields.note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function editMovementAmount(page: Page, note: string, amount: string): Promise<void> {
  await page.getByRole("button", { name: `Editar ${note}` }).click();

  const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Importe (€)").fill(amount);
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page.getByText("Movimiento actualizado").last()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible();
}

async function deleteMovement(page: Page, note: string): Promise<void> {
  await movementList(page).getByRole("button", { name: `Eliminar ${note}` }).first().click();

  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();

  await expect(page.getByText("Movimiento eliminado").last()).toBeVisible({ timeout: 10_000 });
  await expect(
    movementList(page).getByRole("listitem").filter({ hasText: note }),
  ).toHaveCount(0, { timeout: 10_000 });
}

async function openSettingsMenu(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
}

async function configureIncomeAndContribution(page: Page): Promise<void> {
  await openSettingsMenu(page);
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

test.describe("descuento de gastos comunes en la aportación (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("D1: barrido inicial y primera consulta → aportación −500,00 única", async ({ page }) => {
    await openAccount(page);

    const hipoteca = movementList(page).getByRole("listitem").filter({ hasText: "Hipoteca" });
    if ((await hipoteca.count()) > 0) {
      await deleteMovement(page, "Hipoteca");
    }
    await expect(contributionItems(page)).toHaveCount(0);

    await configureIncomeAndContribution(page);

    await page.goto(ACCOUNT_URL);
    const item = contributionItems(page).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText("−500,00");
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("D2: gasto común 120,55 → −379,45 (céntimos exactos)", async ({ page }) => {
    await openAccount(page);
    await registerMovement(page, {
      note: "Compra compartida",
      amount: "120,55",
      nature: "shared",
      tag: "Vivienda",
    });

    const item = contributionItems(page).first();
    await expect(item).toContainText("−379,45", { timeout: 10_000 });
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("D3: idempotencia — recargas, /summary y /annual no duplican ni alteran", async ({ page }) => {
    await page.goto(`/summary?month=${currentMonthIso()}`);
    await expect(
      page.getByRole("region", { name: `Resumen global de ${currentMonthLabel()}` }),
    ).toBeVisible();
    await page.goto(`/summary?month=${currentMonthIso()}`);
    await expect(
      page.getByRole("region", { name: `Resumen global de ${currentMonthLabel()}` }),
    ).toBeVisible();

    await page.goto(`/annual?year=${currentYear()}`);
    await expect(
      page.getByRole("region", { name: `Cuenta de resultados de ${currentYear()}` }),
    ).toBeVisible();

    await page.goto(ACCOUNT_URL);
    await expect(contributionItems(page)).toHaveCount(1);
    await page.reload();
    await expect(contributionItems(page)).toHaveCount(1);
    await expect(contributionItems(page).first()).toContainText("−379,45");
  });

  test("D4: segundo gasto común 80,00 → −299,45 (suma)", async ({ page }) => {
    await openAccount(page);
    await registerMovement(page, {
      note: "Transporte",
      amount: "80,00",
      nature: "shared",
      tag: "Vivienda",
    });

    await expect(contributionItems(page).first()).toContainText("−299,45", { timeout: 10_000 });
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("D5: editar 120,55 → 150,00 → −270,00", async ({ page }) => {
    await openAccount(page);
    await editMovementAmount(page, "Compra compartida", "150,00");

    await expect(contributionItems(page).first()).toContainText("−270,00", { timeout: 10_000 });
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("D6: eliminar el gasto de 80,00 → −350,00", async ({ page }) => {
    await openAccount(page);
    await deleteMovement(page, "Transporte");

    await expect(contributionItems(page).first()).toContainText("−350,00", { timeout: 10_000 });
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("D7: gastos ≥ bruto (150 + 400) → la aportación desaparece (suelo cero)", async ({ page }) => {
    await openAccount(page);
    await registerMovement(page, {
      note: "Reparación",
      amount: "400,00",
      nature: "shared",
      tag: "Vivienda",
    });

    await expect(contributionItems(page)).toHaveCount(0, { timeout: 10_000 });
  });

  test("D8: eliminar el gasto de 400,00 → la aportación reaparece a −350,00 (retirada → regeneración)", async ({
    page,
  }) => {
    await openAccount(page);
    await deleteMovement(page, "Reparación");

    const item = contributionItems(page).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText("−350,00");
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("D9: gasto personal e ingreso no cambian la aportación", async ({ page }) => {
    await openAccount(page);
    await registerMovement(page, {
      note: "Gasolina extra",
      amount: "30,00",
      nature: "personal",
      tag: "Coche",
    });
    await registerMovement(page, {
      note: "Ingreso extra",
      amount: "10,00",
      type: "income",
    });

    await expect(contributionItems(page).first()).toContainText("−350,00");
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("D10: eliminar la aportación es definitivo — no reaparece aunque cambie el neto", async ({
    page,
  }) => {
    await openAccount(page);
    await deleteMovement(page, CONTRIBUTION_NOTE);
    await expect(contributionItems(page)).toHaveCount(0);

    await registerMovement(page, {
      note: "Post borrado",
      amount: "30,00",
      nature: "shared",
      tag: "Vivienda",
    });

    await expect(contributionItems(page)).toHaveCount(0);
    await page.reload();
    await expect(contributionItems(page)).toHaveCount(0);
  });

  test("D11: limpieza — restaura Hipoteca y desactiva aportación e ingreso regular de B", async ({
    page,
  }) => {
    await openAccount(page);
    await deleteMovement(page, "Compra compartida");
    await deleteMovement(page, "Gasolina extra");
    await deleteMovement(page, "Ingreso extra");
    await deleteMovement(page, "Post borrado");

    await openSettingsMenu(page);
    await page.getByRole("menu").getByRole("menuitem", { name: /Aportación/ }).click();
    const contributionDialog = page.getByRole("dialog", { name: "Aportación a la cuenta común" });
    await contributionDialog.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Aportación desactivada")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular/ }).click();
    const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
    await incomeDialog.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Ingreso regular desactivado")).toBeVisible({ timeout: 10_000 });

    await openAccount(page);
    const regularIncomeNote = "Ingreso regular de Miembro B";
    const regularIncomeItems = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: regularIncomeNote });
    if ((await regularIncomeItems.count()) > 0) {
      await deleteMovement(page, regularIncomeNote);
    }
    await expect(contributionItems(page)).toHaveCount(0);

    await registerMovement(page, {
      note: "Hipoteca",
      amount: "850,00",
      nature: "shared",
      tag: "Hipoteca",
    });
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Hipoteca" }),
    ).toHaveCount(1);
  });
});
