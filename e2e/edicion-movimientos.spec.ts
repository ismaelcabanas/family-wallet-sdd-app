import { expect, test, type Page } from "@playwright/test";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function closurePanel(page: Page) {
  return page.getByRole("region").filter({ hasText: "Cierre de" }).first();
}

async function selectAccount(page: Page, accountName: string): Promise<void> {
  await page.getByRole("combobox", { name: "Cuenta activa" }).click();
  await page.getByRole("option", { name: accountName }).click();
  await expect(page.getByRole("combobox", { name: "Cuenta activa" })).toContainText(accountName);
}

async function selectAugust2026(page: Page): Promise<void> {
  await page.getByRole("combobox", { name: "Mes visible" }).click();
  await page.getByRole("option", { name: "Agosto de 2026" }).click();
  const panel = page.getByRole("region").filter({ hasText: "Cierre de" }).first();
  await expect(panel.getByText(/agosto de 2026/i).first()).toBeVisible({ timeout: 10_000 });
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
  await page.getByLabel("Fecha", { exact: true }).fill("2026-08-10");
  await page.getByLabel("Concepto", { exact: true }).fill(fields.concept);
  await page.getByLabel("Importe (€)").fill(fields.amount);

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

  await expect(
    movementList(page)
      .getByRole("listitem")
      .filter({ hasText: fields.concept })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("edición y eliminación de movimientos (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Family Wallet" })).toBeVisible();
    await selectAccount(page, "Cuenta de Miembro B");
    await selectAugust2026(page);
  });

  test("E1: editar el importe recalcula listado, balance y cierre", async ({ page }) => {
    await registerMovement(page, {
      concept: "Mercadona",
      amount: "85,00",
      nature: "personal",
      tags: ["Alimentación"],
    });

    await page.getByRole("button", { name: "Editar Mercadona" }).click();

    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Importe (€)")).toHaveValue("85,00");
    await expect(dialog.getByLabel("Concepto")).toHaveValue("Mercadona");
    await expect(dialog.getByRole("checkbox", { name: "Alimentación", exact: true })).toBeChecked();

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
      concept: "Compra a borrar",
      amount: "20,00",
      nature: "personal",
      tags: ["Alimentación"],
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
});
