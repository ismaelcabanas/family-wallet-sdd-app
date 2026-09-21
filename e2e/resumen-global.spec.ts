import { expect, test, type Page } from "@playwright/test";

const MONTH = "2026-06";

const EUR = "[\\s\\u00A0\\u202F]€";

function summaryPanel(page: Page) {
  return page.getByRole("region", { name: `Resumen global de Junio de 2026` });
}

async function selectAccount(page: Page, accountName: string): Promise<void> {
  await page.getByRole("combobox", { name: "Cuenta activa" }).click();
  await page.getByRole("option", { name: accountName }).click();
  await expect(page.getByRole("combobox", { name: "Cuenta activa" })).toContainText(accountName);
}

async function selectMonth(page: Page, optionName: string): Promise<void> {
  await page.getByRole("combobox", { name: "Mes visible" }).click();
  await page.getByRole("option", { name: optionName }).click();
  await expect(page.getByRole("combobox", { name: "Mes visible" })).toContainText(optionName);
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
  },
): Promise<void> {
  await page.getByLabel("Fecha", { exact: true }).fill(fields.date);
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

test.describe("resumen global mensual", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Family Wallet" })).toBeVisible();
  });

  test("E1-E3: KPIs exactos del global tras registrar en las tres cuentas y desgloses por tag y miembro", async ({
    page,
  }) => {
    await selectMonth(page, "Junio de 2026");

    await selectAccount(page, "Cuenta común");
    await registerMovement(page, {
      concept: "Hipoteca",
      amount: "850,00",
      date: "2026-06-05",
      tags: ["Vivienda", "Hipoteca"],
    });

    await selectAccount(page, "Cuenta de Miembro A");
    await registerMovement(page, {
      concept: "Nómina",
      amount: "2100,00",
      date: "2026-06-01",
      type: "income",
    });
    await registerMovement(page, {
      concept: "Gasolina",
      amount: "60,00",
      date: "2026-06-15",
      nature: "personal",
      tags: ["Coche"],
    });

    await selectAccount(page, "Cuenta de Miembro B");
    await registerMovement(page, {
      concept: "Compra semanal",
      amount: "150,50",
      date: "2026-06-20",
      nature: "shared",
      tags: ["Alimentación"],
    });

    await page.getByRole("link", { name: "Resumen global" }).click();
    await expect(page).toHaveURL(new RegExp(`/summary\\?month=${MONTH}$`));

    const panel = summaryPanel(page);
    await expect(panel).toBeVisible();

    await expect(panel.getByText(new RegExp(`^2100,00${EUR}$`))).toBeVisible();
    await expect(panel.getByText(new RegExp(`^1060,50${EUR}$`))).toBeVisible();
    await expect(panel.getByText(new RegExp(`^\\+1039,50${EUR}$`))).toBeVisible();
    await expect(panel.getByText(/Gastos compartidos: 1000,50/)).toBeVisible();
    await expect(panel.getByText(/Gastos personales: 60,00/)).toBeVisible();

    const tagRows = panel.getByRole("listitem");
    await expect(tagRows).toHaveCount(4);
    await expect(tagRows.nth(0)).toContainText("Hipoteca");
    await expect(tagRows.nth(0)).toContainText("850,00");
    await expect(tagRows.nth(1)).toContainText("Vivienda");
    await expect(tagRows.nth(1)).toContainText("850,00");
    await expect(tagRows.nth(2)).toContainText("Alimentación");
    await expect(tagRows.nth(2)).toContainText("150,50");
    await expect(tagRows.nth(3)).toContainText("Coche");
    await expect(tagRows.nth(3)).toContainText("60,00");

    const memberRows = panel.getByRole("table").getByRole("row");
    await expect(memberRows).toHaveCount(4);
    const commonRow = panel.getByRole("table").getByRole("row", { name: /Cuenta común/ });
    await expect(commonRow).toContainText("850,00");
    await expect(commonRow).toContainText("0,00");
    const memberBRow = panel.getByRole("table").getByRole("row", { name: /Miembro B/ });
    await expect(memberBRow).toContainText("150,50");
    const memberARow = panel.getByRole("table").getByRole("row", { name: /Miembro A/ });
    await expect(memberARow).toContainText("60,00");
  });

  test("E4: mes sin movimientos muestra KPIs a cero y ambos desgloses vacíos", async ({ page }) => {
    await page.goto(`/summary?month=2025-01`);

    const panel = page.getByRole("region", { name: "Resumen global de Enero de 2025" });
    await expect(panel).toBeVisible();

    await expect(panel.getByText(new RegExp(`^0,00${EUR}`)).first()).toBeVisible();
    await expect(panel.getByText("Sin gastos este mes.")).toHaveCount(2);
  });
});
