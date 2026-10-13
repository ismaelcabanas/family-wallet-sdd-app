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

const ACCOUNT_URL = "/accounts/1";
const INCOME_NOTE = "Ingreso regular de Miembro A";
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro A";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function regularIncomeItems(page: Page) {
  return movementList(page).getByRole("listitem").filter({ hasText: INCOME_NOTE });
}

async function openRegularIncomeDialogFromCardMenu(page: Page) {
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular/ }).click();
  return page.getByRole("dialog", { name: "Ingreso regular" });
}

test.describe("ingresos regulares (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("R1: configurar 2.000 € el día 1 y ver el ingreso del mes sin alta manual (SC-001)", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    const menu = page.getByRole("menu");
    await expect(
      menu.getByRole("menuitem", { name: /Ingreso regular\s*Sin configurar/ }),
    ).toBeVisible();
    await menu.getByRole("menuitem", { name: /Ingreso regular/ }).click();

    const dialog = page.getByRole("dialog", { name: "Ingreso regular" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Importe (€)").fill("2000,00");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Ingreso regular guardado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular\s*Activa/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(ACCOUNT_URL);

    const item = regularIncomeItems(page).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText("+2000,00");
    await expect(regularIncomeItems(page)).toHaveCount(1);
  });

  test("R2: consultas repetidas desde summary, annual y recarga no duplican (SC-002)", async ({
    page,
  }) => {
    const EUR = "[\\s\\u00A0\\u202F]€";

    await page.goto(ACCOUNT_URL);
    const balanceRegion = page.getByRole("region", { name: "Balance de Cuenta de Miembro A" });
    const balanceBefore = await balanceRegion.getByText(new RegExp(`^2000,00${EUR}`)).textContent();

    await page.goto(`/summary?month=${currentMonthIso()}`);
    const summary = page.getByRole("region", { name: `Resumen global de ${currentMonthLabel()}` });
    await expect(summary).toBeVisible();
    await page.goto(`/summary?month=${currentMonthIso()}`);
    await expect(summary).toBeVisible();

    await page.goto(`/annual?year=${currentYear()}`);
    const annual = page.getByRole("region", { name: `Cuenta de resultados de ${currentYear()}` });
    await expect(annual).toBeVisible();
    const incomeRow = annual.getByRole("row", { name: /^Miembro A/ });
    await expect(incomeRow).toContainText(new RegExp(`2000,00${EUR}`));

    await page.goto(`/annual?year=${currentYear()}`);
    await expect(annual).toBeVisible();
    await expect(incomeRow).toContainText(new RegExp(`2000,00${EUR}`));

    await page.goto(ACCOUNT_URL);
    await expect(
      balanceRegion.getByText(new RegExp(`^${balanceBefore ?? ""}`)),
    ).toBeVisible();
    await page.reload();
    await expect(regularIncomeItems(page)).toHaveCount(1);
  });

  test("R3: editar el importe a 2.100 € desde el menú conserva el mes ya generado a 2.000 €", async ({ page }) => {
    await page.goto("/");

    const dialog = await openRegularIncomeDialogFromCardMenu(page);
    await expect(dialog.getByLabel("Importe (€)")).toHaveValue("2000,00");
    await dialog.getByLabel("Importe (€)").fill("2100,00");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Ingreso regular guardado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular\s*Activa/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(ACCOUNT_URL);

    const item = regularIncomeItems(page).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText("+2000,00");
    await expect(regularIncomeItems(page)).toHaveCount(1);
  });

  test("R4: borrar el movimiento generado es definitivo — no reaparece al reconsultar", async ({
    page,
  }) => {
    await page.goto(ACCOUNT_URL);

    await movementList(page)
      .getByRole("button", { name: `Eliminar ${INCOME_NOTE}` })
      .click();

    const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();

    await expect(regularIncomeItems(page)).toHaveCount(0, { timeout: 10_000 });

    await page.goto(`/summary?month=${currentMonthIso()}`);
    const summary = page.getByRole("region", { name: `Resumen global de ${currentMonthLabel()}` });
    await expect(summary).toBeVisible();

    await page.goto(ACCOUNT_URL);
    await expect(regularIncomeItems(page)).toHaveCount(0);
  });

  test("R5: desactivar desde el diálogo deja el ítem «Desactivada» y no genera en consultas posteriores", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await page
      .getByRole("menu")
      .getByRole("menuitem", { name: /Ingreso regular\s*Activa/ })
      .click();

    const dialog = page.getByRole("dialog", { name: "Ingreso regular" });
    await dialog.getByRole("button", { name: "Desactivar" }).click();

    await expect(page.getByText("Ingreso regular desactivado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular\s*Desactivada/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(ACCOUNT_URL);
    await expect(page.getByTestId("regular-income-panel")).toHaveCount(0);
    await expect(regularIncomeItems(page)).toHaveCount(0);

    await page.goto(`/summary?month=${currentMonthIso()}`);
    const summary = page.getByRole("region", { name: `Resumen global de ${currentMonthLabel()}` });
    await expect(summary).toBeVisible();

    await page.goto(ACCOUNT_URL);
    await expect(page.getByTestId("regular-income-panel")).toHaveCount(0);
    await expect(regularIncomeItems(page)).toHaveCount(0);
  });
});
