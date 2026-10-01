import { expect, test, type Page } from "@playwright/test";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

async function openAccount(page: Page, accountName: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: accountName }).click();
  await expect(page.getByRole("heading", { name: accountName, exact: true })).toBeVisible();
}

async function openCreateDialog(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  if (await dialog.isVisible()) return;
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  await expect(dialog).toBeVisible();
}

async function fillMovementFields(
  page: Page,
  fields: {
    concept: string;
    amount: string;
    type?: "expense" | "income";
    nature?: "personal" | "shared";
    tags?: string[];
  },
): Promise<void> {
  await page.getByLabel("Concepto", { exact: true }).fill(fields.concept);
  await page.getByLabel("Importe (€)").fill(fields.amount);

  if (fields.type === "income") {
    await page.getByRole("radio", { name: "Ingreso" }).check();
  }

  if (fields.nature === "shared") {
    await page.getByRole("radio", { name: "Compartido", exact: true }).check();
  }

  for (const tagName of fields.tags ?? []) {
    await page.getByRole("checkbox", { name: tagName, exact: true }).check();
  }
}

async function registerMovement(
  page: Page,
  fields: {
    concept: string;
    amount: string;
    type?: "expense" | "income";
    nature?: "personal" | "shared";
    tags?: string[];
  },
): Promise<void> {
  await openCreateDialog(page);
  await fillMovementFields(page, fields);
  await page.getByRole("button", { name: "Registrar" }).click();

  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect
    .poll(
      async () => {
        const dialogVisible = await dialog.isVisible();
        const alertVisible = await page.getByRole("alert").first().isVisible();
        return !dialogVisible || alertVisible;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

test.describe("registro de movimientos (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("E1: gasto compartido de 850,00 € con tags Vivienda+Hipoteca en la cuenta común", async ({
    page,
  }) => {
    await openAccount(page, "Cuenta común");

    await registerMovement(page, {
      concept: "Hipoteca",
      amount: "850,00",
      tags: ["Vivienda", "Hipoteca"],
    });

    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = movementList(page).getByRole("listitem").filter({ hasText: "Hipoteca" }).first();
    await expect(movementItem).toBeVisible();
    await expect(movementItem).toContainText("−850,00");
    await expect(movementItem).toContainText("Común");
    await expect(movementItem).toContainText("Vivienda");
    await expect(movementItem).toContainText("Hipoteca");

    await expect(page.getByText(/^-850,00/)).toBeVisible();

    await expect(page.getByRole("dialog", { name: "Nuevo movimiento" })).toHaveCount(0);
  });

  test("E2: gasto compartido pagado desde cuenta personal", async ({ page }) => {
    await openAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, {
      concept: "Compra semanal",
      amount: "120,50",
      nature: "shared",
      tags: ["Alimentación"],
    });

    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = movementList(page).getByRole("listitem").filter({ hasText: "Compra semanal" }).first();
    await expect(movementItem).toBeVisible();
    await expect(movementItem).toContainText("Común");
    await expect(movementItem).toContainText("Alimentación");
    await expect(page.getByText(/^-120,50/)).toBeVisible();
  });

  test("E3: ingreso nómina 1.500,00 € actualiza el balance acumulado", async ({ page }) => {
    await openAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, { concept: "Nómina", amount: "1500,00", type: "income" });

    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = movementList(page).getByRole("listitem").filter({ hasText: "Nómina" }).first();
    await expect(movementItem).toBeVisible();
    await expect(movementItem).toContainText("+1500,00");

    await expect(page.getByText(/^1379,50/)).toBeVisible();
  });

  test("E3 encadenado: ingreso seleccionable sin recarga tras un registro exitoso", async ({
    page,
  }) => {
    await openAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, { concept: "Gasto previo", amount: "10,00" });
    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    await openCreateDialog(page);
    await expect(page.getByLabel("Concepto", { exact: true })).toHaveValue("");
    await page.getByRole("radio", { name: "Ingreso" }).check();
    await expect(page.getByRole("radio", { name: "Ingreso" })).toBeChecked();

    await page.getByLabel("Concepto", { exact: true }).fill("Nómina encadenada");
    await page.getByLabel("Importe (€)").fill("1500,00");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Nómina encadenada" })
      .first();
    await expect(movementItem).toContainText("+1500,00");
  });

  test("E4: importe inválido no guarda nada y conserva el resto de valores", async ({ page }) => {
    await openAccount(page, "Cuenta común");

    for (const invalidAmount of ["", "0", "abc"]) {
      await registerMovement(page, { concept: "Inválido", amount: invalidAmount });

      await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("alert").first()).toContainText("importe", { ignoreCase: true });
      await expect(page.getByLabel("Concepto", { exact: true })).toHaveValue("Inválido");
      await expect(page.getByText("Movimiento guardado")).toHaveCount(0);
    }

    await expect(movementList(page).getByRole("listitem").filter({ hasText: "Inválido" })).toHaveCount(0);
  });
});
