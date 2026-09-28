import { expect, test, type Page } from "@playwright/test";

const ACCOUNT_B = 2;
const ACCOUNT_B_NAME = "Cuenta de Miembro B";
const MONTH = "2026-04";

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

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

async function gotoAccountMonth(page: Page, month = MONTH): Promise<void> {
  await page.goto(`/accounts/${ACCOUNT_B}?month=${month}`);
  await expect(page.getByRole("heading", { name: ACCOUNT_B_NAME, exact: true })).toBeVisible();
}

async function registerMovement(
  page: Page,
  fields: {
    concept: string;
    amount: string;
    date: string;
    type?: "expense" | "income";
    nature?: "personal" | "shared";
    tags?: string[];
    description?: string;
  },
): Promise<void> {
  await page.getByLabel("Fecha", { exact: true }).fill(fields.date);
  await page.getByLabel("Concepto", { exact: true }).fill(fields.concept);
  await page.getByLabel("Importe (€)").fill(fields.amount);

  if (fields.description !== undefined) {
    await page.getByLabel("Descripción (opcional)").fill(fields.description);
  }

  if (fields.type === "income") {
    await page.getByRole("radio", { name: "Ingreso" }).check();
  }

  if (fields.nature === "personal") {
    await page.getByRole("radio", { name: "Personal", exact: true }).check();
  } else if (fields.nature === "shared") {
    await page.getByRole("radio", { name: "Compartido", exact: true }).check();
  }

  for (const tagName of fields.tags ?? []) {
    await page.getByRole("checkbox", { name: tagName, exact: true }).check();
  }

  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Movimiento guardado").last()).toBeVisible({ timeout: 10_000 });

  const item = movementList(page)
    .getByRole("listitem")
    .filter({ hasText: fields.concept })
    .first();
  await expect(item).toBeVisible({ timeout: 10_000 });
}

test.describe("página de cuenta (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("P1: registro en la página de cuenta con agrupación por fecha y orden interno por registro", async ({
    page,
  }) => {
    await gotoAccountMonth(page);

    await expect(page.getByText("Cuenta personal de Miembro B")).toBeVisible();
    await expect(
      page.getByRole("region").filter({ hasText: "Acumulado hasta Abril de 2026" }).first(),
    ).toBeVisible();

    await registerMovement(page, {
      concept: "Mercadona",
      amount: "85,00",
      date: "2026-04-05",
      nature: "shared",
      tags: ["Alimentación"],
      description: "compra semanal",
    });
    await registerMovement(page, {
      concept: "Gasolina",
      amount: "30,00",
      date: "2026-04-05",
      nature: "personal",
      tags: ["Coche"],
    });
    await registerMovement(page, {
      concept: "Cine",
      amount: "12,00",
      date: "2026-04-02",
      nature: "personal",
      tags: ["Ocio"],
    });

    const groups = movementList(page).getByRole("heading", { level: 3 });
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0).getByRole("time")).toHaveText("5 de abril de 2026");
    await expect(groups.nth(1).getByRole("time")).toHaveText("2 de abril de 2026");

    const day5Items = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: /Gasolina|Mercadona/ });
    await expect(day5Items.first()).toContainText("Gasolina");
    await expect(day5Items.nth(1)).toContainText("Mercadona");

    const mercadonaRow = movementList(page).getByRole("listitem").filter({ hasText: "Mercadona" });
    await expect(mercadonaRow).toContainText("Alimentación");
    await expect(mercadonaRow).toContainText("Mercadona · compra semanal");
    await expect(mercadonaRow).toContainText("−85,00");
    await expect(mercadonaRow).toContainText("Común");

    const cineRow = movementList(page).getByRole("listitem").filter({ hasText: "Cine" });
    await expect(cineRow).toContainText("Ocio");
    await expect(cineRow).toContainText("Personal");

    await expect(movementList(page)).not.toContainText("Gasto");
    await expect(movementList(page)).not.toContainText("Ingreso");
  });

  test("P2: edición y eliminación desde la fila recalculan en la propia página", async ({ page }) => {
    await gotoAccountMonth(page);

    await page.getByRole("button", { name: "Editar Mercadona" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Importe (€)").fill("90,00");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Movimiento actualizado")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const mercadonaRow = movementList(page).getByRole("listitem").filter({ hasText: "Mercadona" });
    await expect(mercadonaRow).toContainText("−90,00", { timeout: 10_000 });

    await page.getByRole("button", { name: "Eliminar Cine" }).click();
    const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();

    await expect(page.getByText("Movimiento eliminado")).toBeVisible({ timeout: 10_000 });
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Cine" }),
    ).toHaveCount(0);

    await expect(page.getByText(/^-120,00/)).toBeVisible();
  });

  test("P3: ‹ navega a marzo 2026 con estado vacío y balance heredado; › activo desde abril", async ({
    page,
  }) => {
    await gotoAccountMonth(page);

    await page.getByRole("button", { name: "Mes anterior" }).click();

    await expect(page).toHaveURL(new RegExp(`/accounts/${ACCOUNT_B}\\?month=2026-03$`));
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/^0,00/).first()).toBeVisible();

    const nextButton = page.getByRole("button", { name: "Mes siguiente" });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await expect(page).toHaveURL(new RegExp(`/accounts/${ACCOUNT_B}\\?month=2026-04$`));
    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: "Mercadona" })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("P4: › deshabilitado en el mes actual real y picker sin meses futuros", async ({ page }) => {
    await page.goto(`/accounts/${ACCOUNT_B}`);

    await expect(page.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();

    await page.getByRole("combobox", { name: "Mes visible" }).click();

    const now = new Date();
    const currentOptionLabel = `${MONTH_LONG_NAMES[now.getMonth()]} de ${now.getFullYear()}`;
    await expect(page.getByRole("option", { name: currentOptionLabel, exact: true })).toBeVisible();

    const nextMonthLabel =
      now.getMonth() === 11
        ? `${MONTH_LONG_NAMES[0]} de ${now.getFullYear() + 1}`
        : `${MONTH_LONG_NAMES[now.getMonth() + 1]} de ${now.getFullYear()}`;
    await expect(page.getByRole("option", { name: nextMonthLabel, exact: true })).toHaveCount(0);
  });

  test("P5: URL directa a mes futuro es válida, vacía, con › deshabilitado", async ({ page }) => {
    await page.goto(`/accounts/${ACCOUNT_B}?month=2027-06`);

    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Mes anterior" })).toBeEnabled();
  });

  test("P6: accountId inválido o inexistente devuelve 404", async ({ page }) => {
    for (const invalidId of ["999", "abc"]) {
      const response = await page.goto(`/accounts/${invalidId}`);
      expect(response?.status()).toBe(404);
    }
  });

  test("P7: month inválido cae al mes actual", async ({ page }) => {
    await page.goto(`/accounts/${ACCOUNT_B}?month=2026-13`);

    await expect(page.getByRole("heading", { name: ACCOUNT_B_NAME, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
  });

  test("P8: /accounts/2 mantiene la pasarela / sin cambios (FR-007)", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Family Wallet" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Cuenta activa" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Mes visible" }).first()).toBeVisible();
  });
});
