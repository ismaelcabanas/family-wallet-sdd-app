import { expect, test, type Page } from "@playwright/test";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function movementListAny(page: Page) {
  return page.locator('[aria-labelledby="movement-list-title"] [data-testid="movement-item"]');
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
    note: string;
    amount: string;
    type?: "expense" | "income";
    nature?: "personal" | "shared";
    tag?: string;
  },
): Promise<void> {
  await page.getByLabel("Nota", { exact: true }).fill(fields.note);
  await page.getByLabel("Importe (€)").fill(fields.amount);

  if (fields.type === "income") {
    await page.getByRole("radio", { name: "Ingreso" }).check();
  } else if (fields.type === "expense") {
    await page.getByRole("radio", { name: "Gasto" }).check();
  }

  if (fields.nature === "shared") {
    await page.getByRole("radio", { name: "Compartido", exact: true }).check();
  }

  if (fields.tag !== undefined) {
    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: fields.tag, exact: true }).click();
  }
}

async function saveMovement(page: Page, intent: "continue" | "close" = "close"): Promise<void> {
  await page
    .getByRole("button", { name: intent === "continue" ? "Guardar y seguir" : "Guardar y cerrar" })
    .click();
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
  intent: "continue" | "close" = "close",
): Promise<void> {
  await openCreateDialog(page);
  await fillMovementFields(page, fields);
  await saveMovement(page, intent);

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

test.describe("registro de movimientos (flujo crítico, tanda continua)", () => {
  test.describe.configure({ mode: "serial" });

  test("E1: tanda continua — gasto, error por tag ausente, ingreso sin tag y cierre (SC-001)", async ({
    page,
  }) => {
    await openAccount(page, "Cuenta común");

    await openCreateDialog(page);

    await fillMovementFields(page, { note: "Hipoteca", amount: "850,00", tag: "Hipoteca" });
    await saveMovement(page, "continue");
    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Guardados: 1")).toBeVisible();
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();

    await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Importe (€)")).toHaveValue("");
    await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText(
      "Selecciona etiqueta",
    );

    const movementItem = movementListAny(page).filter({ hasText: "Hipoteca" }).first();
    await expect(movementItem).toBeVisible({ timeout: 10_000 });
    await expect(movementItem).toContainText("−850,00");
    await expect(movementItem).toContainText("Común");
    await expect(movementItem).toContainText("Hipoteca");

    await fillMovementFields(page, { note: "Luz", amount: "120,00" });
    await saveMovement(page, "continue");
    await expect(
      page.getByRole("alert").filter({ hasText: "Selecciona una etiqueta para el gasto." }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("Luz");

    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Hogar", exact: true }).click();
    await saveMovement(page, "continue");
    await expect(page.getByText("Guardados: 2")).toBeVisible({ timeout: 10_000 });
    await expect(
      movementListAny(page).filter({ hasText: "Luz" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await fillMovementFields(page, { note: "Aportación", amount: "1500,00", type: "income" });
    await saveMovement(page, "continue");
    await expect(page.getByText("Guardados: 3")).toBeVisible({ timeout: 10_000 });

    await fillMovementFields(page, { note: "Cierre", amount: "30,00", type: "expense", tag: "Ocio" });
    await saveMovement(page, "close");
    await expect(dialog).toHaveCount(0);
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Cierre" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/^500,00/).first()).toBeVisible();
  });

  test("E2: gasto compartido pagado desde cuenta personal", async ({ page }) => {
    await openAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, {
      note: "Compra semanal",
      amount: "120,50",
      nature: "shared",
      tag: "Alimentación",
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

    await registerMovement(page, { note: "Nómina", amount: "1500,00", type: "income" });

    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    const movementItem = movementList(page).getByRole("listitem").filter({ hasText: "Nómina" }).first();
    await expect(movementItem).toBeVisible();
    await expect(movementItem).toContainText("+1500,00");

    await expect(page.getByText(/^1500,00/)).toBeVisible();
  });

  test("E3 encadenado: ingreso seleccionable sin recarga tras un registro exitoso", async ({
    page,
  }) => {
    await openAccount(page, "Cuenta de Miembro A");

    await registerMovement(page, { note: "Gasto previo", amount: "10,00", tag: "Ocio" });
    await expect(page.getByText("Movimiento guardado")).toBeVisible({ timeout: 10_000 });

    await openCreateDialog(page);
    await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("");
    await page.getByRole("radio", { name: "Ingreso" }).check();
    await expect(page.getByRole("radio", { name: "Ingreso" })).toBeChecked();

    await page.getByLabel("Nota", { exact: true }).fill("Nómina encadenada");
    await page.getByLabel("Importe (€)").fill("1500,00");
    await saveMovement(page, "close");
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
      await registerMovement(page, { note: "Inválido", amount: invalidAmount, tag: "Ocio" });

      await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("alert").first()).toContainText("importe", { ignoreCase: true });
      await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("Inválido");
      await expect(page.getByText("Movimiento guardado")).toHaveCount(0);

      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    await expect(movementList(page).getByRole("listitem").filter({ hasText: "Inválido" })).toHaveCount(0);
  });
});
