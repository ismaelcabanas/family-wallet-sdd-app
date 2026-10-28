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

function nextMonthIso(): string {
  const now = new Date();
  const totalMonths = now.getFullYear() * 12 + now.getMonth() + 1;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function nextMonthLabel(): string {
  const now = new Date();
  const totalMonths = now.getFullYear() * 12 + now.getMonth() + 1;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${MONTH_LONG_NAMES[month - 1]} de ${year}`;
}

const EUR = "[\\s\\u00A0\\u202F]€";
const ACCOUNT_URL = "/accounts/2";
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro B";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function kpisRegion(page: Page) {
  return page.getByRole("region", { name: "KPIs del mes" });
}

function savingsCell(page: Page) {
  return kpisRegion(page).getByText("Ahorro del mes").locator("..");
}

function balanceCell(page: Page) {
  return kpisRegion(page).getByText("Saldo del mes").locator("..");
}

function savingsAmount(page: Page) {
  return savingsCell(page).getByText(new RegExp(`^\\d*[.,]\\d{2}${EUR}`));
}

function closureRegion(page: Page) {
  return page.getByRole("region", { name: `Cierre de ${currentMonthLabel()}` });
}

function parseEurCents(text: string): number {
  const normalized = text.replace("\u2212", "-").replace(/[+\s\u00A0\u202F€]/g, "");
  return Math.round(Number(normalized.replace(",", ".")) * 100);
}

function formatSignedEurPattern(cents: number): string {
  const sign = cents < 0 ? "\u2212" : cents > 0 ? "\\+" : "";
  const abs = Math.abs(cents);
  const integer = Math.floor(abs / 100);
  const decimals = String(abs % 100).padStart(2, "0");
  return `^${sign}${integer},${decimals}`;
}

async function openSavingsDialogFromCardMenu(page: Page) {
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: /Ahorro/ }).click();
  return page.getByRole("dialog", { name: "Ahorro mensual" });
}

async function deactivateContributionIfActive(page: Page): Promise<void> {
  await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
  await page.getByRole("menu").waitFor();
  const activeItem = page.getByRole("menu").getByRole("menuitem", {
    name: /Aportación\s*Activa/,
  });
  if ((await activeItem.count()) === 0) {
    await page.keyboard.press("Escape");
    return;
  }
  await activeItem.click();
  const dialog = page.getByRole("dialog", { name: "Aportación a la cuenta común" });
  await dialog.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("Aportación desactivada")).toBeVisible({ timeout: 10_000 });
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

let movementsBeforeSavings = -1;

test.describe("porcentaje de ahorro con apartado informativo (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("A1: barrido defensivo, dependencia del ingreso regular y línea base del listado", async ({
    page,
  }) => {
    await page.goto(ACCOUNT_URL);

    const hipoteca = movementList(page).getByRole("listitem").filter({ hasText: "Hipoteca" });
    if ((await hipoteca.count()) > 0) {
      await deleteMovementByNote(page, "Hipoteca");
    }

    await page.goto("/");
    await deactivateContributionIfActive(page);

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    const savingsItem = page.getByRole("menu").getByRole("menuitem", {
      name: /Ahorro\s*(Sin configurar|Desactivado|Requiere ingreso regular)/,
    });
    await expect(savingsItem).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular/ }).click();
    const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
    await incomeDialog.getByLabel("Importe (€)").fill("3000,00");
    await incomeDialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Ingreso regular guardado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Ahorro\s*Sin configurar/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(ACCOUNT_URL);
    movementsBeforeSavings = await movementList(page).getByRole("listitem").count();
  });

  test("A2: configurar 10 % → KPI «Ahorro del mes» 300,00, saldo neto = bruto − 300, sin movimiento nuevo", async ({
    page,
  }) => {
    await page.goto("/");

    const dialog = await openSavingsDialogFromCardMenu(page);
    await expect(dialog.getByLabel("Porcentaje (%)")).toHaveValue("");
    await dialog.getByLabel("Porcentaje (%)").fill("10");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Ahorro guardado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Ahorro\s*Activo/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(ACCOUNT_URL);

    await expect(savingsCell(page).getByText(new RegExp(`^300,00${EUR}`))).toBeVisible({
      timeout: 10_000,
    });
    await expect(savingsCell(page).getByText("Sin ahorro configurado")).toHaveCount(0);

    const closureBalance = await closureRegion(page)
      .getByText("Saldo del mes")
      .locator("..")
      .getByText(new RegExp(`^[+\u2212]?\\d+[.,]\\d{2}${EUR}`))
      .textContent();
    expect(closureBalance).toBeTruthy();
    const grossCents = parseEurCents(closureBalance!);
    const expectedNetCents = grossCents - 30_000;

    await expect(
      balanceCell(page).getByText(new RegExp(`${formatSignedEurPattern(expectedNetCents)}${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Ahorro" }),
    ).toHaveCount(0);
    expect(await movementList(page).getByRole("listitem").count()).toBe(movementsBeforeSavings);
  });

  test("A3: idempotencia — recargas y navegación ‹ › no duplican ni alteran la deducción", async ({
    page,
  }) => {
    await page.goto(ACCOUNT_URL);
    await expect(savingsAmount(page)).toHaveText(new RegExp(`^300,00${EUR}`));
    await page.reload();
    await expect(savingsAmount(page)).toHaveText(new RegExp(`^300,00${EUR}`));
    await page.reload();
    await expect(savingsAmount(page)).toHaveText(new RegExp(`^300,00${EUR}`));

    await page.getByRole("button", { name: "Mes anterior" }).click();
    await expect(
      savingsCell(page).getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/2\\?month=${currentMonthIso()}$`));
    await expect(savingsAmount(page)).toHaveText(new RegExp(`^300,00${EUR}`));
  });

  test("A4: «12,5» se rechaza con su mensaje exacto y no guarda nada", async ({ page }) => {
    await page.goto("/");

    const dialog = await openSavingsDialogFromCardMenu(page);
    await dialog.getByLabel("Porcentaje (%)").fill("12,5");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(
      dialog
        .getByRole("alert")
        .filter({ hasText: "Introduce un porcentaje entero entre 1 y 100 (ej. 10)." }),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();

    const reopen = await openSavingsDialogFromCardMenu(page);
    await expect(reopen.getByLabel("Porcentaje (%)")).toHaveValue("10");
    await reopen.getByRole("button", { name: "Cancelar" }).click();
  });

  test("A5: mes futuro sin deducción — 0,00 sin subtexto", async ({ page }) => {
    await page.goto(`${ACCOUNT_URL}?month=${nextMonthIso()}`);
    await expect(kpisRegion(page).getByText(nextMonthLabel())).toBeVisible({ timeout: 10_000 });

    await expect(
      savingsCell(page).getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(savingsCell(page).getByText("Sin ahorro configurado")).toHaveCount(0);
  });

  test("A6: limpieza — desactiva ahorro e ingreso, sin movimiento de ahorro y deducción congelada", async ({
    page,
  }) => {
    await page.goto("/");

    const savingsDialog = await openSavingsDialogFromCardMenu(page);
    await savingsDialog.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Ahorro desactivado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: /Ingreso regular\s*Activa/ }).click();
    const incomeDialog = page.getByRole("dialog", { name: "Ingreso regular" });
    await incomeDialog.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Ingreso regular desactivado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: SETTINGS_TRIGGER }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitem", { name: /Ahorro\s*Desactivado/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(ACCOUNT_URL);

    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Ahorro" }),
    ).toHaveCount(0);

    await expect(savingsCell(page).getByText(new RegExp(`^300,00${EUR}`))).toBeVisible({
      timeout: 10_000,
    });

    const incomeNote = "Ingreso regular de Miembro B";
    const incomeItems = movementList(page).getByRole("listitem").filter({ hasText: incomeNote });
    if ((await incomeItems.count()) > 0) {
      await movementList(page).getByRole("button", { name: `Eliminar ${incomeNote}` }).click();
      const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
      await expect(confirmDialog).toBeVisible();
      await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
      await expect(
        movementList(page).getByRole("listitem").filter({ hasText: incomeNote }),
      ).toHaveCount(0, { timeout: 10_000 });
    }
  });
});
