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

async function openContributionDialogFromCardMenu(page: Page) {
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Aportación/ }).click();
  return page.getByRole("dialog", { name: "Aportación a la cuenta común" });
}

test.describe("aportación a la cuenta común (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("A1: sin ingreso regular el ítem «Aportación» queda deshabilitado; tras configurarlo pasa a «Sin configurar»", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    const menu = page.getByRole("menu");
    const contributionItem = menu.getByRole("menuitem", {
      name: /Aportación\s*Requiere ingreso regular/,
    });
    await expect(contributionItem).toBeVisible();
    await expect(contributionItem).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular/ }).click();
    const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
    await incomeDialog.getByLabel("Importe (€)").fill("2000,00");
    await incomeDialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Ingreso regular guardado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Aportación\s*Sin configurar/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("A2: configurar 25 % materializa un único gasto propio −500,00 con etiqueta «Aportación Común» y sin tocar la cuenta común", async ({
    page,
  }) => {
    await page.goto("/");

    const dialog = await openContributionDialogFromCardMenu(page);
    await expect(dialog.getByLabel("Porcentaje (%)")).toHaveValue("");
    await dialog.getByLabel("Porcentaje (%)").fill("25");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Aportación guardada")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Aportación\s*Activa/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(ACCOUNT_URL);

    const item = contributionItems(page).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText("−500,00");
    await expect(item).toContainText("Aportación Común");
    await expect(contributionItems(page)).toHaveCount(1);

    await page.goto("/accounts/3");
    await expect(
      page
        .getByRole("region", { name: "Movimientos del mes" })
        .getByRole("listitem")
        .filter({ hasText: "Aportación" }),
    ).toHaveCount(0);
  });

  test("A3: consultas repetidas desde summary, annual y recarga no duplican", async ({ page }) => {
    await page.goto(`/summary?month=${currentMonthIso()}`);
    const summary = page.getByRole("region", { name: `Resumen global de ${currentMonthLabel()}` });
    await expect(summary).toBeVisible();
    await page.goto(`/summary?month=${currentMonthIso()}`);
    await expect(summary).toBeVisible();

    await page.goto(`/annual?year=${currentYear()}`);
    const annual = page.getByRole("region", { name: `Cuenta de resultados de ${currentYear()}` });
    await expect(annual).toBeVisible();
    await page.goto(`/annual?year=${currentYear()}`);
    await expect(annual).toBeVisible();

    await page.goto(ACCOUNT_URL);
    await expect(contributionItems(page)).toHaveCount(1);
    await page.reload();
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("A4: editar el porcentaje a 30 % re-sincroniza el mes en curso a 600,00 (021)", async ({ page }) => {
    await page.goto("/");

    const dialog = await openContributionDialogFromCardMenu(page);
    await expect(dialog.getByLabel("Porcentaje (%)")).toHaveValue("25");
    await dialog.getByLabel("Porcentaje (%)").fill("30");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Aportación guardada")).toBeVisible({ timeout: 10_000 });

    await page.goto(ACCOUNT_URL);

    const item = contributionItems(page).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText("−600,00");
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("A5: gastos comunes ≥ bruto retiran la aportación del mes y reaparece si bajan (021)", async ({
    page,
  }) => {
    await page.goto(ACCOUNT_URL);

    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nota", { exact: true }).fill("Gasto grande");
    await dialog.getByLabel("Importe (€)").fill("700,00");
    await dialog.getByRole("radio", { name: "Compartido", exact: true }).check();
    await dialog.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Vivienda", exact: true }).click();
    await dialog.getByRole("button", { name: "Guardar y cerrar" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    await expect(contributionItems(page)).toHaveCount(0, { timeout: 10_000 });

    await movementList(page)
      .getByRole("button", { name: "Eliminar Gasto grande" })
      .first()
      .click();
    const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Gasto grande" }),
    ).toHaveCount(0, { timeout: 10_000 });

    const item = contributionItems(page).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText("−600,00");
    await expect(contributionItems(page)).toHaveCount(1);
  });

  test("A6: limpieza — retira la aportación por regla, desactiva aportación e ingreso regular de B", async ({
    page,
  }) => {
    await page.goto(ACCOUNT_URL);

    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const sweepDialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(sweepDialog).toBeVisible();
    await sweepDialog.getByLabel("Nota", { exact: true }).fill("Limpieza");
    await sweepDialog.getByLabel("Importe (€)").fill("700,00");
    await sweepDialog.getByRole("radio", { name: "Compartido", exact: true }).check();
    await sweepDialog.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Vivienda", exact: true }).click();
    await sweepDialog.getByRole("button", { name: "Guardar y cerrar" }).click();
    await expect(sweepDialog).not.toBeVisible({ timeout: 10_000 });

    await expect(contributionItems(page)).toHaveCount(0, { timeout: 10_000 });

    await page.goto("/");

    const dialog = await openContributionDialogFromCardMenu(page);
    await dialog.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Aportación desactivada")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular\s*Activa/ }).click();
    const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
    await incomeDialog.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Ingreso regular desactivado")).toBeVisible({ timeout: 10_000 });

    await page.goto(ACCOUNT_URL);
    await movementList(page).getByRole("button", { name: "Eliminar Limpieza" }).first().click();
    const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Limpieza" }),
    ).toHaveCount(0, { timeout: 10_000 });

    const incomeNote = "Ingreso regular de Miembro B";
    const incomeItem = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: incomeNote })
      .first();
    await expect(incomeItem).toBeVisible({ timeout: 10_000 });
    await movementList(page).getByRole("button", { name: `Eliminar ${incomeNote}` }).click();
    const incomeConfirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await expect(incomeConfirmDialog).toBeVisible();
    await incomeConfirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: incomeNote }),
    ).toHaveCount(0, { timeout: 10_000 });

    await expect(contributionItems(page)).toHaveCount(0);
  });
});
