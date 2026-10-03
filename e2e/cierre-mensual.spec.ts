import { expect, test, type Page } from "@playwright/test";

async function openAccount(page: Page, accountName: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: accountName }).click();
  await expect(page.getByRole("heading", { name: accountName, exact: true })).toBeVisible();
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
    page
      .getByRole("region", { name: "Movimientos del mes" })
      .getByRole("listitem")
      .filter({ hasText: fields.note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("cierre mensual (cuenta de Miembro B)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await openAccount(page, "Cuenta de Miembro B");
    await expect(page.getByText("Cierre de")).toBeVisible();
  });

  test("E1: KPIs exactos del mes con ingreso, gasto compartido y gasto personal (tag única)", async ({
    page,
  }) => {
    await registerMovement(page, { note: "Aportación", amount: "1920,00", type: "income" });
    await registerMovement(page, {
      note: "Hipoteca",
      amount: "850,00",
      nature: "shared",
      tag: "Hipoteca",
    });
    await registerMovement(page, {
      note: "Gasolina",
      amount: "60,00",
      nature: "personal",
      tag: "Coche",
    });

    const panel = page.getByRole("region").filter({ hasText: "Cierre de" }).first();

    await expect(panel.getByText(/^1920,00[\s\u00A0\u202F]€$/)).toBeVisible();
    await expect(panel.getByText(/^910,00[\s\u00A0\u202F]€$/)).toBeVisible();
    await expect(panel.getByText(/^\+1010,00[\s\u00A0\u202F]€$/)).toBeVisible();

    await expect(panel.getByText("Gastos compartidos: 850,00").first()).toBeVisible();
    await expect(panel.getByText("Gastos personales: 60,00").first()).toBeVisible();

    const breakdown = panel.getByRole("listitem");
    await expect(breakdown).toHaveCount(2);
    await expect(breakdown.nth(0)).toContainText("Hipoteca");
    await expect(breakdown.nth(0)).toContainText("850,00");
    await expect(breakdown.nth(1)).toContainText("Coche");
    await expect(breakdown.nth(1)).toContainText("60,00");
  });

  test("E2: mes vacío muestra todos los KPIs a cero y desglose sin gastos", async ({ page }) => {
    await page.getByRole("combobox", { name: "Mes visible" }).click();
    await page
      .getByRole("option", { name: /de 2025/ })
      .first()
      .click();

    const panel = page.getByRole("region").filter({ hasText: "Cierre de" }).first();

    await expect(panel.getByText(/de 2025/).first()).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText(/^0,00[\s\u00A0\u202F]€/).first()).toBeVisible();
    await expect(panel.getByText("Sin gastos este mes.")).toBeVisible();
  });
});
