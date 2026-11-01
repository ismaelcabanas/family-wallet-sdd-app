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

function parseEur(text: string): number {
  const normalized = text
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  return Math.round(Number.parseFloat(normalized) * 100);
}

const EUR = "[\\s\\u00A0\\u202F]€";
const ACCOUNT_URL = "/accounts/2";
const SETTINGS_TRIGGER = "Configuración de Cuenta de Miembro B";
const CONTRIBUTION_NOTE = "Aportación común de Miembro B";
const REGULAR_INCOME_NOTE = "Ingreso regular de Miembro B";
const ENTRY_LEFTOVERS = [
  { note: "Aportación", amount: "1920,00", type: "income" as const },
  { note: "Gasolina", amount: "60,00", nature: "personal" as const, tag: "Coche" },
  { note: "Hipoteca", amount: "850,00", nature: "shared" as const, tag: "Hipoteca" },
];
const TANDA_NOTES = Array.from(
  { length: 12 },
  (_, i) => `Tanda personal ${String(i + 1).padStart(2, "0")}`,
);
const BASE_INCOME_NOTE = "Ingreso base";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function kpisRegion(page: Page) {
  return page.getByRole("region", { name: "KPIs del mes" });
}

function contributionCell(page: Page) {
  return kpisRegion(page).getByText("Aportación común").locator("..");
}

function expenseCell(page: Page) {
  return kpisRegion(page).getByText("Gasto personal").locator("..");
}

function balanceCell(page: Page) {
  return kpisRegion(page).getByText("Saldo del mes").locator("..");
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

async function deleteMovementIfPresent(page: Page, note: string): Promise<void> {
  const items = movementList(page).getByRole("listitem").filter({ hasText: note });
  if ((await items.count()) > 0) {
    await deleteMovement(page, note);
  }
}

async function sweepEntryLeftovers(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await openAccount(page);
    for (const leftover of ENTRY_LEFTOVERS) {
      await deleteMovementIfPresent(page, leftover.note);
    }
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Cuenta de Miembro B", exact: true }),
    ).toBeVisible();

    let stillPresent = false;
    for (const leftover of ENTRY_LEFTOVERS) {
      const items = movementList(page).getByRole("listitem").filter({ hasText: leftover.note });
      stillPresent = stillPresent || (await items.count()) > 0;
    }
    if (!stillPresent) {
      return;
    }
  }
  throw new Error("No se pudo completar el barrido defensivo de los residuos de entrada");
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

test.describe("KPI de gasto personal del mes en la cuenta personal (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("G1: barrido defensivo + ingreso 2.000,00 y aportación 25 % → bloque con 4 métricas y gasto 0,00", async ({
    page,
  }) => {
    await sweepEntryLeftovers(page);
    await expect(contributionItems(page)).toHaveCount(0);

    await configureIncomeAndContribution(page);

    await openAccount(page);
    await expect(contributionItems(page).first()).toContainText("−500,00");
    await registerMovement(page, { note: BASE_INCOME_NOTE, amount: "2000,00", type: "income" });

    await expect(kpisRegion(page)).toBeVisible();
    await expect(kpisRegion(page).getByRole("definition")).toHaveCount(4);
    await expect(kpisRegion(page).getByText("Gasto personal")).toBeVisible();
    await expect(expenseCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();
    await expect(expenseCell(page).getByText(/Sin .* configurad/)).toHaveCount(0);
  });

  test("G2: gastos de distinta naturaleza → gasto personal 200,55, aportación neta 440,00, saldo +1.299,45", async ({
    page,
  }) => {
    await openAccount(page);
    await registerMovement(page, {
      note: "Ocio compra",
      amount: "120,55",
      nature: "personal",
      tag: "Ocio",
    });
    await registerMovement(page, { note: "Cena", amount: "80,00", nature: "personal", tag: "Ocio" });
    await registerMovement(page, {
      note: "Compra compartida",
      amount: "60,00",
      nature: "shared",
      tag: "Vivienda",
    });

    const expenseValue = expenseCell(page).getByText(new RegExp(`^200,55${EUR}`));
    const contributionValue = contributionCell(page).getByText(new RegExp(`^440,00${EUR}`));
    await expect(expenseValue).toBeVisible({ timeout: 10_000 });
    await expect(contributionValue).toBeVisible();
    await expect(balanceCell(page).getByText(new RegExp(`^\\+1299,45${EUR}`))).toBeVisible();

    const closure = page.getByRole("region", { name: `Cierre de ${currentMonthLabel()}` });
    const closurePersonalLine = closure.getByText(/Gastos personales:/).locator("..");
    await expect(closurePersonalLine).toContainText("640,55");

    const expenseCents = parseEur((await expenseValue.textContent()) ?? "");
    const contributionCents = parseEur((await contributionValue.textContent()) ?? "");
    const closurePersonalCents = parseEur((await closurePersonalLine.textContent()) ?? "");
    expect(closurePersonalCents - contributionCents).toBe(expenseCents);
  });

  test("G3: tanda de 12 gastos de 10,00 → KPI 320,55 al alta y región visible al fondo del listado", async ({
    page,
  }) => {
    await openAccount(page);

    for (const note of TANDA_NOTES) {
      await registerMovement(page, { note, amount: "10,00", nature: "personal", tag: "Ocio" });
    }

    await expect(expenseCell(page).getByText(new RegExp(`^320,55${EUR}`))).toBeVisible({
      timeout: 10_000,
    });

    await movementList(page)
      .getByRole("listitem")
      .filter({ hasText: TANDA_NOTES[TANDA_NOTES.length - 1] })
      .scrollIntoViewIfNeeded();

    await expect(kpisRegion(page)).toBeInViewport();
    await expect(expenseCell(page).getByText(new RegExp(`^320,55${EUR}`))).toBeVisible();
  });

  test("G4: ‹ mes anterior → gasto personal 0,00 con etiqueta del mes consultado; › restaura 320,55", async ({
    page,
  }) => {
    await openAccount(page);

    await page.getByRole("button", { name: "Mes anterior" }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/2\\?month=${previousMonthIso()}$`));

    await expect(kpisRegion(page).getByText(previousMonthLabel())).toBeVisible({ timeout: 10_000 });
    await expect(expenseCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();
    await expect(expenseCell(page).getByText(/Sin .* configurad/)).toHaveCount(0);

    await page.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/2\\?month=${currentMonthIso()}$`));
    await expect(expenseCell(page).getByText(new RegExp(`^320,55${EUR}`))).toBeVisible({
      timeout: 10_000,
    });
  });

  test("G5: ingreso manual 500,00 no computa → KPI estable en 320,55", async ({ page }) => {
    await openAccount(page);
    await registerMovement(page, { note: "Ingreso extra", amount: "500,00", type: "income" });

    await expect(balanceCell(page).getByText(new RegExp(`^\\+1679,45${EUR}`))).toBeVisible({
      timeout: 10_000,
    });
    await expect(expenseCell(page).getByText(new RegExp(`^320,55${EUR}`))).toBeVisible();
  });

  test("G6: la cuenta común no renderiza la región «KPIs del mes»", async ({ page }) => {
    await page.goto("/accounts/3");

    await expect(page.getByRole("heading", { name: "Cuenta común", exact: true })).toBeVisible();
    await expect(kpisRegion(page)).toHaveCount(0);
  });

  test("G7: limpieza total — retira la aportación por regla, desactiva configs y restaura el estado de entrada", async ({
    page,
  }) => {
    await openAccount(page);

    for (const note of [
      "Ingreso extra",
      BASE_INCOME_NOTE,
      ...TANDA_NOTES,
      "Ocio compra",
      "Cena",
      "Compra compartida",
    ]) {
      await deleteMovement(page, note);
    }

    await registerMovement(page, {
      note: "Limpieza aportación",
      amount: "700,00",
      nature: "shared",
      tag: "Vivienda",
    });
    await expect(contributionItems(page)).toHaveCount(0, { timeout: 10_000 });

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
    await deleteMovement(page, "Limpieza aportación");
    await expect(contributionItems(page)).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Cuenta de Miembro B", exact: true }),
    ).toBeVisible();
    await deleteMovementIfPresent(page, REGULAR_INCOME_NOTE);
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: REGULAR_INCOME_NOTE }),
    ).toHaveCount(0);

    await expect(expenseCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible({
      timeout: 10_000,
    });

    for (const leftover of ENTRY_LEFTOVERS) {
      await registerMovement(page, leftover);
      await expect(
        movementList(page).getByRole("listitem").filter({ hasText: leftover.note }),
      ).toHaveCount(1);
    }
  });
});
