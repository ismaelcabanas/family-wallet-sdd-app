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
    page
      .getByRole("region", { name: "Movimientos del mes" })
      .getByRole("listitem")
      .filter({ hasText: fields.concept })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("cierre mensual (cuenta de Miembro B)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Family Wallet" })).toBeVisible();
    await selectAccount(page, "Cuenta de Miembro B");
    await expect(page.getByText("Cierre de")).toBeVisible();
  });

  test("E1: KPIs exactos del mes con ingreso, gasto compartido multi-tag y gasto personal", async ({
    page,
  }) => {
    await registerMovement(page, { concept: "Aportación", amount: "1920,00", type: "income" });
    await registerMovement(page, {
      concept: "Hipoteca",
      amount: "850,00",
      nature: "shared",
      tags: ["Vivienda", "Hipoteca"],
    });
    await registerMovement(page, {
      concept: "Gasolina",
      amount: "60,00",
      nature: "personal",
      tags: ["Coche"],
    });

    const panel = page.getByRole("region").filter({ hasText: "Cierre de" }).first();

    await expect(panel.getByText(/^1920,00[\s\u00A0\u202F]€$/)).toBeVisible();
    await expect(panel.getByText(/^910,00[\s\u00A0\u202F]€$/)).toBeVisible();
    await expect(panel.getByText(/^\+1010,00[\s\u00A0\u202F]€$/)).toBeVisible();

    await expect(panel.getByText("Gastos compartidos: 850,00").first()).toBeVisible();
    await expect(panel.getByText("Gastos personales: 60,00").first()).toBeVisible();

    const breakdown = panel.getByRole("listitem");
    await expect(breakdown).toHaveCount(3);
    await expect(breakdown.nth(0)).toContainText("Hipoteca");
    await expect(breakdown.nth(0)).toContainText("850,00");
    await expect(breakdown.nth(1)).toContainText("Vivienda");
    await expect(breakdown.nth(1)).toContainText("850,00");
    await expect(breakdown.nth(2)).toContainText("Coche");
    await expect(breakdown.nth(2)).toContainText("60,00");
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
