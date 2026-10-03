import { expect, test, type Page } from "@playwright/test";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function closurePanel(page: Page) {
  return page.getByRole("region").filter({ hasText: "Cierre de" }).first();
}

async function openAccount(page: Page, accountName: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: accountName }).click();
  await expect(page.getByRole("heading", { name: accountName, exact: true })).toBeVisible();
}

async function selectMonth(page: Page, monthLabel: string): Promise<void> {
  await page.getByRole("combobox", { name: "Mes visible" }).click();
  await page.getByRole("option", { name: monthLabel }).click();
  const panel = page.getByRole("region").filter({ hasText: "Cierre de" }).first();
  await expect(panel.getByText(new RegExp(monthLabel, "i")).first()).toBeVisible({
    timeout: 10_000,
  });
}

async function registerMovement(
  page: Page,
  fields: {
    note: string;
    amount: string;
    date?: string;
    type?: "expense" | "income";
    nature?: "personal" | "shared";
    tag?: string;
  },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo movimiento" })).toBeVisible();

  await page.getByLabel("Fecha", { exact: true }).fill(fields.date ?? "2026-08-10");
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

test.describe("edición y eliminación de movimientos (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await openAccount(page, "Cuenta de Miembro B");
    await selectMonth(page, "Agosto de 2026");
  });

  test("E1: editar el importe recalcula listado, balance y cierre", async ({ page }) => {
    await registerMovement(page, {
      note: "Mercadona",
      amount: "85,00",
      nature: "personal",
      tag: "Alimentación",
    });

    await page.getByRole("button", { name: "Editar Mercadona" }).click();

    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Importe (€)")).toHaveValue("85,00");
    await expect(dialog.getByLabel("Nota")).toHaveValue("Mercadona");
    await expect(dialog.getByRole("combobox", { name: "Etiqueta" })).toContainText("Alimentación");

    await dialog.getByLabel("Importe (€)").fill("78,50");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Movimiento actualizado")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const movementItem = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Mercadona" })
      .first();
    await expect(movementItem).toContainText("−78,50");

    const panel = closurePanel(page);
    await expect(panel.locator("dd").filter({ hasText: /^78,50[\s\u00A0\u202F]€/u })).toBeVisible();
    await expect(panel.getByText("Alimentación").first()).toBeVisible();
    await expect(movementList(page).getByRole("listitem")).toHaveCount(1);
  });

  test("E2: eliminar con confirmación actualiza listado, balance y cierre", async ({ page }) => {
    await registerMovement(page, {
      note: "Compra a borrar",
      amount: "20,00",
      nature: "personal",
      tag: "Alimentación",
    });

    await page.getByRole("button", { name: "Eliminar Compra a borrar" }).click();

    const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText("Compra a borrar")).toBeVisible();
    await expect(confirmDialog.getByText(/−20,00[\s\u00A0\u202F]€/)).toBeVisible();

    await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();

    await expect(page.getByText("Movimiento eliminado")).toBeVisible({ timeout: 10_000 });
    await expect(confirmDialog).not.toBeVisible();

    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Compra a borrar" }),
    ).toHaveCount(0);

    const panel = closurePanel(page);
    await expect(panel.locator("dd").filter({ hasText: /^78,50[\s\u00A0\u202F]€/u })).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByText("20,00")).toHaveCount(0);
  });

  test("E3: eliminar el último movimiento visible tuesta y muestra el estado vacío", async ({
    page,
  }) => {
    await selectMonth(page, "Julio de 2026");
    await registerMovement(page, {
      note: "Solitario",
      amount: "15,00",
      date: "2026-07-05",
      nature: "personal",
      tag: "Ocio",
    });

    await page.getByRole("button", { name: "Eliminar Solitario" }).click();
    const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();

    await expect(page.getByText("Movimiento eliminado")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("region", { name: "Movimientos del mes" }),
    ).toHaveCount(0);
  });
});
