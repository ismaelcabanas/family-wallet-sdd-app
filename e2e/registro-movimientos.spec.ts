import { expect, test, type Page } from "@playwright/test";

async function selectAccount(page: Page, accountName: string): Promise<void> {
  await page.getByRole("combobox", { name: "Cuenta activa" }).click();
  await page.getByRole("option", { name: accountName }).click();
  await expect(page.getByRole("combobox", { name: "Cuenta activa" })).toContainText(accountName);
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

  await page.getByRole("button", { name: "Registrar" }).click();
}

test.describe("registro de movimientos (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Family Wallet" })).toBeVisible();
  });

  test("E1: gasto compartido de 850,00 € con tags Vivienda+Hipoteca en la cuenta común", async ({
    page,
  }) => {
    await selectAccount(page, "Cuenta común");
    await expect(page.getByText("Balance de Cuenta común")).toBeVisible();

    await registerMovement(page, {
      concept: "Hipoteca",
      amount: "850,00",
      tags: ["Vivienda", "Hipoteca"],
    });

    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = page.getByRole("listitem").filter({ hasText: "Hipoteca" }).first();
    await expect(movementItem).toBeVisible();
    await expect(movementItem).toContainText("−850,00");
    await expect(movementItem).toContainText("Gasto");
    await expect(movementItem).toContainText("Compartido");
    await expect(movementItem).toContainText("Vivienda");
    await expect(movementItem).toContainText("Hipoteca");

    await expect(page.getByText(/^-850,00/)).toBeVisible();

    await expect(page.getByLabel("Concepto", { exact: true })).toHaveValue("");
  });

  test("E2: gasto compartido pagado desde cuenta personal", async ({ page }) => {
    await selectAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, {
      concept: "Compra semanal",
      amount: "120,50",
      nature: "shared",
      tags: ["Alimentación"],
    });

    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = page.getByRole("listitem").filter({ hasText: "Compra semanal" }).first();
    await expect(movementItem).toBeVisible();
    await expect(movementItem).toContainText("Compartido");
    await expect(movementItem).toContainText("Alimentación");
    await expect(page.getByText(/^-120,50/)).toBeVisible();
  });

  test("E3: ingreso nómina 1.500,00 € actualiza el balance acumulado", async ({ page }) => {
    await selectAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, { concept: "Nómina", amount: "1500,00", type: "income" });

    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = page.getByRole("listitem").filter({ hasText: "Nómina" }).first();
    await expect(movementItem).toBeVisible();
    await expect(movementItem).toContainText("Ingreso");
    await expect(movementItem).toContainText("+1500,00");

    await expect(page.getByText(/^1379,50/)).toBeVisible();
  });

  test("E3 encadenado: ingreso seleccionable sin recarga tras un registro exitoso", async ({
    page,
  }) => {
    await selectAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, { concept: "Gasto previo", amount: "10,00" });
    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("radio", { name: "Ingreso" }).check();
    await expect(page.getByRole("radio", { name: "Ingreso" })).toBeChecked();

    await registerMovement(page, { concept: "Nómina encadenada", amount: "1500,00" });
    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = page
      .getByRole("listitem")
      .filter({ hasText: "Nómina encadenada" })
      .first();
    await expect(movementItem).toContainText("Ingreso");
    await expect(movementItem).toContainText("+1500,00");
  });

  test("E4: importe inválido no guarda nada y conserva el resto de valores", async ({ page }) => {
    await selectAccount(page, "Cuenta común");

    for (const invalidAmount of ["", "0", "abc"]) {
      await registerMovement(page, { concept: "Inválido", amount: invalidAmount });

      await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("alert").first()).toContainText("importe", { ignoreCase: true });
      await expect(page.getByLabel("Concepto", { exact: true })).toHaveValue("Inválido");
      await expect(page.getByText("Movimiento guardado")).toHaveCount(0);
    }

    await expect(page.getByRole("listitem").filter({ hasText: "Inválido" })).toHaveCount(0);
  });
});
