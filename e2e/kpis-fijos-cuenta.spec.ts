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

function previousMonthIso(): string {
  const now = new Date();
  const totalMonths = now.getFullYear() * 12 + now.getMonth() - 1;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function previousMonthLabel(): string {
  const now = new Date();
  const totalMonths = now.getFullYear() * 12 + now.getMonth() - 1;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${MONTH_LONG_NAMES[month - 1]} de ${year}`;
}

const EUR = "[\\s\\u00A0\\u202F]€";
const ACCOUNT_URL = "/accounts/1";
const ACCOUNT_NAME = "Cuenta de Miembro A";
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro A";
const CONTRIBUTION_NOTE = "Aportación común de Miembro A";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function kpisRegion(page: Page) {
  return page.getByRole("region", { name: "KPIs del mes" });
}

function contributionCell(page: Page) {
  return kpisRegion(page).getByText("Aportación común").locator("..");
}

function balanceCell(page: Page) {
  return kpisRegion(page).getByText("Saldo del mes").locator("..");
}

async function openAccount(page: Page): Promise<void> {
  await page.goto(ACCOUNT_URL);
  await expect(page.getByRole("heading", { name: ACCOUNT_NAME, exact: true })).toBeVisible();
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

test.describe("KPIs fijos en la página de cuenta personal (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("K0: cuenta personal sin config muestra «Sin aportación configurada» y saldo 0,00", async ({
    page,
  }) => {
    await openAccount(page);

    await expect(kpisRegion(page)).toBeVisible();
    await expect(kpisRegion(page).getByText(currentMonthLabel())).toBeVisible();
    await expect(
      contributionCell(page).getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible();
    await expect(contributionCell(page).getByText("Sin aportación configurada")).toBeVisible();
    await expect(balanceCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();
  });

  test("K1: ingreso 2.000,00 + aportación 25 % → KPIs 500,00 / −500,00", async ({ page }) => {
    await configureIncomeAndContribution(page);

    await openAccount(page);

    await expect(
      contributionCell(page).getByText(new RegExp(`^500,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      balanceCell(page).getByText(new RegExp(`^\u2212500,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("K2: gasto común 120,55 → 379,45 / −500,00 y coherencia con el cierre", async ({ page }) => {
    await openAccount(page);
    await registerMovement(page, {
      note: "Compra compartida",
      amount: "120,55",
      nature: "shared",
      tag: "Vivienda",
    });

    await expect(
      contributionCell(page).getByText(new RegExp(`^379,45${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      balanceCell(page).getByText(new RegExp(`^\u2212500,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    const kpiBalanceText = await balanceCell(page)
      .getByText(new RegExp(`^\u2212500,00${EUR}`))
      .textContent();
    const closure = page.getByRole("region", { name: `Cierre de ${currentMonthLabel()}` });
    await expect(closure.getByText("Saldo del mes")).toBeVisible();
    await expect(closure.getByText(new RegExp(`^\u2212500,00${EUR}`))).toBeVisible();
    expect(kpiBalanceText).toBeTruthy();
  });

  test("K3: ‹ mes anterior → aportación 0,00 sin subtexto; › vuelve a restaurar valores", async ({
    page,
  }) => {
    await openAccount(page);

    await page.getByRole("button", { name: "Mes anterior" }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/1\\?month=${previousMonthIso()}$`));

    await expect(kpisRegion(page).getByText(previousMonthLabel())).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      contributionCell(page).getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible();
    await expect(
      contributionCell(page).getByText("Sin aportación configurada"),
    ).toHaveCount(0);
    await expect(balanceCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();

    await page.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/1\\?month=${currentMonthIso()}$`));
    await expect(
      contributionCell(page).getByText(new RegExp(`^379,45${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      balanceCell(page).getByText(new RegExp(`^\u2212500,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("K4: tanda de 12 movimientos + scroll a fondo mantiene la región KPIs en viewport", async ({
    page,
  }) => {
    await openAccount(page);

    for (let i = 1; i <= 12; i += 1) {
      await registerMovement(page, {
        note: `Gasto personal ${String(i).padStart(2, "0")}`,
        amount: "10,00",
        nature: "personal",
        tag: "Ocio",
      });
    }

    await movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Gasto personal 12" })
      .scrollIntoViewIfNeeded();

    await expect(kpisRegion(page)).toBeInViewport();
    await expect(
      contributionCell(page).getByText(new RegExp(`^379,45${EUR}`)),
    ).toBeVisible();
  });

  test("K5: gasto común 400,00 (Σ 520,55 ≥ 500) → aportación retirada y KPI 0,00 sin subtexto", async ({
    page,
  }) => {
    await openAccount(page);
    await registerMovement(page, {
      note: "Reparación grande",
      amount: "400,00",
      nature: "shared",
      tag: "Vivienda",
    });

    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: CONTRIBUTION_NOTE }),
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(
      contributionCell(page).getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      contributionCell(page).getByText("Sin aportación configurada"),
    ).toHaveCount(0);
  });

  test("K6: la cuenta común no renderiza la región «KPIs del mes»", async ({ page }) => {
    await page.goto("/accounts/3");

    await expect(page.getByRole("heading", { name: "Cuenta común", exact: true })).toBeVisible();
    await expect(kpisRegion(page)).toHaveCount(0);
  });

  test("K7: limpieza total UI-driven — configs desactivadas y listado de A vacío", async ({
    page,
  }) => {
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

    const createdNotes = [
      "Compra compartida",
      "Reparación grande",
      ...Array.from({ length: 12 }, (_, i) => `Gasto personal ${String(i + 1).padStart(2, "0")}`),
    ];
    for (const note of createdNotes) {
      const items = movementList(page).getByRole("listitem").filter({ hasText: note });
      await expect(items).toHaveCount(1, { timeout: 10_000 });
      await deleteMovement(page, note);
    }

    await expect(movementList(page).getByRole("listitem")).toHaveCount(0);
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible();
    await expect(
      contributionCell(page).getByText(new RegExp(`^0,00${EUR}`)),
    ).toBeVisible();
    await expect(balanceCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();
  });
});
