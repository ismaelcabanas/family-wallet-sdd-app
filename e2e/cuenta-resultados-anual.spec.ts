import { expect, test, type Page } from "@playwright/test";

const YEAR = "2027";

const EUR = "[\\s\\u00A0\\u202F]€";

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

function monthlyTable(page: Page, year: string = YEAR) {
  return page.getByRole("region", { name: `Cuenta de resultados de ${year}` });
}

function tagTable(page: Page) {
  return page.getByRole("region", { name: "Desglose de gastos por tag" });
}

test.describe("cuenta de resultados anual", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Family Wallet" })).toBeVisible();
  });

  test("E1-E3: tabla mensual con atribución de ingresos, saldo acumulado y desglose por tag del año 2027", async ({
    page,
  }) => {
    await selectMonth(page, "Enero de 2027");

    await selectAccount(page, "Cuenta de Miembro B");
    await registerMovement(page, {
      concept: "Nómina B enero",
      amount: "1600,00",
      date: "2027-01-05",
      type: "income",
    });
    await registerMovement(page, {
      concept: "Gasolina B",
      amount: "60,00",
      date: "2027-01-10",
      nature: "personal",
      tags: ["Coche"],
    });
    await registerMovement(page, {
      concept: "Compra enero",
      amount: "300,00",
      date: "2027-01-12",
      nature: "shared",
      tags: ["Alimentación"],
    });

    await selectMonth(page, "Julio de 2027");
    await registerMovement(page, {
      concept: "Nómina B julio",
      amount: "1600,00",
      date: "2027-07-05",
      type: "income",
    });
    await registerMovement(page, {
      concept: "Compra julio",
      amount: "200,00",
      date: "2027-07-12",
      nature: "shared",
      tags: ["Alimentación", "Ocio"],
    });

    await page.getByRole("link", { name: "Cuenta de resultados" }).click();
    await expect(page).toHaveURL(new RegExp(`/annual\\?year=${YEAR}$`));

    const table = monthlyTable(page);
    await expect(table).toBeVisible();

    const memberBRow = table.getByRole("row", { name: /^Miembro B/ });
    await expect(memberBRow).toContainText(new RegExp(`1600,00${EUR}`));
    await expect(memberBRow).toContainText(new RegExp(`3200,00${EUR}`));
    await expect(memberBRow).toContainText(new RegExp(`266,67${EUR}`));

    const memberARow = table.getByRole("row", { name: /^Miembro A/ });
    await expect(memberARow).toContainText(new RegExp(`0,00${EUR}`));

    const commonRow = table.getByRole("row", { name: /^Cuenta común/ });
    await expect(commonRow).toContainText(new RegExp(`0,00${EUR}`));

    const totalIncomeRow = table.getByRole("row", { name: /^Total ingresos/ });
    await expect(totalIncomeRow).toContainText(new RegExp(`1600,00${EUR}`));
    await expect(totalIncomeRow).toContainText(new RegExp(`3200,00${EUR}`));
    await expect(totalIncomeRow).toContainText(new RegExp(`266,67${EUR}`));

    const expenseRealRow = table.getByRole("row", { name: /^Gasto real/ });
    await expect(expenseRealRow).toContainText(new RegExp(`360,00${EUR}`));
    await expect(expenseRealRow).toContainText(new RegExp(`560,00${EUR}`));
    await expect(expenseRealRow).toContainText(new RegExp(`46,67${EUR}`));

    const noPersonalRow = table.getByRole("row", { name: /^Sin gastos personales/ });
    await expect(noPersonalRow).toContainText(new RegExp(`300,00${EUR}`));
    await expect(noPersonalRow).toContainText(new RegExp(`500,00${EUR}`));

    const balanceRow = table.getByRole("row", { name: /^Saldo\s\+/ });
    await expect(balanceRow).toContainText(new RegExp(`\\+1240,00${EUR}`));
    await expect(balanceRow).toContainText(new RegExp(`\\+1400,00${EUR}`));
    await expect(balanceRow).toContainText(new RegExp(`\\+2640,00${EUR}`));
    await expect(balanceRow).toContainText(new RegExp(`\\+220,00${EUR}`));

    const accumulatedRow = table.getByRole("row", { name: /^Saldo acumulado/ });
    await expect(accumulatedRow).toContainText(new RegExp(`\\+1240,00${EUR}`));
    await expect(accumulatedRow).toContainText(new RegExp(`\\+2640,00${EUR}`));
    await expect(accumulatedRow).toContainText("—");

    const breakdown = tagTable(page);
    await expect(breakdown).toBeVisible();

    const alimentacionRow = breakdown.getByRole("row", { name: /^Alimentación/ });
    await expect(alimentacionRow).toContainText(new RegExp(`300,00${EUR}`));
    await expect(alimentacionRow).toContainText(new RegExp(`200,00${EUR}`));
    await expect(alimentacionRow).toContainText(new RegExp(`500,00${EUR}`));
    await expect(alimentacionRow).toContainText(new RegExp(`41,67${EUR}`));

    const ocioRow = breakdown.getByRole("row", { name: /^Ocio/ });
    await expect(ocioRow).toContainText(new RegExp(`200,00${EUR}`));

    const cocheRow = breakdown.getByRole("row", { name: /^Coche/ });
    await expect(cocheRow).toContainText(new RegExp(`60,00${EUR}`));
    await expect(cocheRow).toContainText(new RegExp(`5,00${EUR}`));

    await expect(
      breakdown.getByText(
        "Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.",
      ),
    ).toBeVisible();

    const tagTotalsReal = breakdown.getByRole("row", { name: /^Gasto real/ });
    await expect(tagTotalsReal).toContainText(new RegExp(`560,00${EUR}`));
    const tagNoPersonal = breakdown.getByRole("row", { name: /^Sin gastos personales/ });
    await expect(tagNoPersonal).toContainText(new RegExp(`500,00${EUR}`));
  });

  test("E5: año vacío muestra la estructura completa a ceros y 'Sin gastos este año.'", async ({
    page,
  }) => {
    await page.goto(`/annual?year=2028`);

    const table = monthlyTable(page, "2028");
    await expect(
      page.getByRole("heading", { name: "Cuenta de resultados de 2028" }),
    ).toBeVisible();

    await expect(table.getByRole("row", { name: /^Miembro A/ })).toContainText(
      new RegExp(`0,00${EUR}`),
    );
    await expect(table.getByRole("row", { name: /^Total ingresos/ })).toContainText(
      new RegExp(`0,00${EUR}`),
    );

    await expect(page.getByText("Sin gastos este año.")).toBeVisible();
  });
});
