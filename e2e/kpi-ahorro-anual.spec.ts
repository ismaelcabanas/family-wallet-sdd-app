import { expect, test, type Page } from "@playwright/test";

const ACCOUNT_NAME = "Cuenta de Miembro B";
const YEAR_URL = (month: string) => `/accounts/2?month=${month}`;
const MARCH = "2025-03";
const JULY = "2025-07";
const NOVEMBER = "2025-11";
const OTHER_YEAR = "2024-08";
const EUR = "[\\s\\u00A0\\u202F]€";

const MARCH_LABEL = "Marzo de 2025";
const JULY_LABEL = "Julio de 2025";
const OTHER_YEAR_LABEL = "Agosto de 2024";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function kpisRegion(page: Page) {
  return page.getByRole("region", { name: "KPIs del mes" });
}

function accumulatedCell(page: Page) {
  return kpisRegion(page).getByText("Ahorro acumulado").locator("..");
}

function monthBalanceCell(page: Page) {
  return kpisRegion(page).getByText("Saldo del mes").locator("..");
}

async function openMonth(page: Page, month: string, label: string): Promise<void> {
  await page.goto(YEAR_URL(month));
  await expect(page.getByRole("heading", { name: ACCOUNT_NAME, exact: true })).toBeVisible();
  await expect(kpisRegion(page).getByText(label)).toBeVisible();
}

async function registerMovement(
  page: Page,
  fields: {
    note: string;
    amount: string;
    date: string;
    type?: "expense" | "income";
  },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Fecha", { exact: true }).fill(fields.date);
  await dialog.getByLabel("Nota", { exact: true }).fill(fields.note);
  await dialog.getByLabel("Importe (€)").fill(fields.amount);

  if (fields.type === "income") {
    await dialog.getByRole("radio", { name: "Ingreso" }).check();
  } else {
    await dialog.getByRole("radio", { name: "Personal", exact: true }).check();
    await dialog.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Ocio", exact: true }).click();
  }

  await dialog.getByRole("button", { name: "Guardar y cerrar" }).click();
  await expect(page.getByText("Movimiento guardado").last()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

async function registerBatch(
  page: Page,
  movements: Array<{ note: string; amount: string; date: string }>,
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  for (const [index, movement] of movements.entries()) {
    await dialog.getByLabel("Fecha", { exact: true }).fill(movement.date);
    await dialog.getByLabel("Nota", { exact: true }).fill(movement.note);
    await dialog.getByLabel("Importe (€)").fill(movement.amount);
    await dialog.getByRole("radio", { name: "Personal", exact: true }).check();
    await dialog.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Ocio", exact: true }).click();
    const isLast = index === movements.length - 1;
    await dialog
      .getByRole("button", { name: isLast ? "Guardar y cerrar" : "Guardar y seguir" })
      .click();
    if (isLast) {
      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    } else {
      await expect(
        dialog.getByText(`Guardados: ${index + 1}`, { exact: true }),
      ).toBeVisible({ timeout: 10_000 });
    }
  }

  for (const movement of movements) {
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: movement.note }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }
}

async function deleteMovementByNote(page: Page, note: string): Promise<void> {
  await movementList(page).getByRole("button", { name: `Eliminar ${note}` }).first().click();
  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: /^Eliminar$/ }).click();
  await expect(
    movementList(page).getByRole("listitem").filter({ hasText: note }),
  ).toHaveCount(0, { timeout: 10_000 });
}

test.describe("KPI de ahorro acumulado del año en la cuenta personal (035)", () => {
  test.describe.configure({ mode: "serial" });

  test("A1: año vacío — 5 métricas, subtext «Año 2025» y acumulado 0,00 € sin estados", async ({
    page,
  }) => {
    await openMonth(page, MARCH, MARCH_LABEL);

    for (const label of [
      "Aportación común",
      "Gasto personal",
      "Ahorro del mes",
      "Saldo del mes",
      "Ahorro acumulado",
    ]) {
      await expect(kpisRegion(page).getByText(label, { exact: true })).toBeVisible();
    }

    await expect(accumulatedCell(page).getByText(/^Año 2025$/)).toBeVisible();
    await expect(accumulatedCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();
    await expect(accumulatedCell(page).getByText(/Sin .*/)).toHaveCount(0);
  });

  test("A2: altas con saldos de signo opuesto → acumulado = suma exacta de los saldos del año", async ({
    page,
  }) => {
    await openMonth(page, MARCH, MARCH_LABEL);
    await registerMovement(page, { note: "Nómina marzo", amount: "2000,00", date: "2025-03-01", type: "income" });
    await registerMovement(page, { note: "Gasto marzo", amount: "350,50", date: "2025-03-20" });

    await expect(
      monthBalanceCell(page).getByText(new RegExp(`^\\+1649,50${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      accumulatedCell(page).getByText(new RegExp(`^\\+1649,50${EUR}`)),
    ).toBeVisible();

    await openMonth(page, JULY, JULY_LABEL);
    await registerMovement(page, { note: "Gasto julio", amount: "1800,00", date: "2025-07-15" });

    await expect(
      monthBalanceCell(page).getByText(new RegExp(`^\u22121800,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(accumulatedCell(page).getByText(new RegExp(`^\u2212150,50${EUR}`))).toBeVisible();
  });

  test("A3: estable navegando meses del mismo año (FR-003)", async ({ page }) => {
    await openMonth(page, MARCH, MARCH_LABEL);
    await expect(accumulatedCell(page).getByText(new RegExp(`^\u2212150,50${EUR}`))).toBeVisible();

    await page.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(kpisRegion(page).getByText("Abril de 2025")).toBeVisible();
    await expect(accumulatedCell(page).getByText(new RegExp(`^\u2212150,50${EUR}`))).toBeVisible();

    await page.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(kpisRegion(page).getByText("Mayo de 2025")).toBeVisible();
    await expect(accumulatedCell(page).getByText(new RegExp(`^\u2212150,50${EUR}`))).toBeVisible();
  });

  test("A4: cambio de año en la misma visita → subtext y acumulado del otro año (SC-004)", async ({
    page,
  }) => {
    await openMonth(page, OTHER_YEAR, OTHER_YEAR_LABEL);

    await expect(accumulatedCell(page).getByText(/^Año 2024$/)).toBeVisible();
    await expect(accumulatedCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();

    await registerMovement(page, { note: "Ingreso 2024", amount: "500,00", date: "2024-08-10", type: "income" });

    await expect(
      accumulatedCell(page).getByText(new RegExp(`^\\+500,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    await openMonth(page, MARCH, MARCH_LABEL);
    await expect(accumulatedCell(page).getByText(/^Año 2025$/)).toBeVisible();
    await expect(accumulatedCell(page).getByText(new RegExp(`^\u2212150,50${EUR}`))).toBeVisible();
  });

  test("A5: visibilidad continua — tanda de 12 movimientos y scroll a fondo con el KPI en viewport (SC-001)", async ({
    page,
  }) => {
    await openMonth(page, MARCH, MARCH_LABEL);

    const batch = Array.from({ length: 12 }, (_, index) => ({
      note: `Tanda ${String(index + 1).padStart(2, "0")}`,
      amount: "5,00",
      date: "2025-03-25",
    }));
    await registerBatch(page, batch);

    await expect(
      accumulatedCell(page).getByText(new RegExp(`^\u2212210,50${EUR}`)),
    ).toBeVisible();

    await movementList(page).getByRole("listitem").last().scrollIntoViewIfNeeded();
    await expect(kpisRegion(page)).toBeInViewport();
    await expect(
      accumulatedCell(page).getByText(new RegExp(`^\u2212210,50${EUR}`)),
    ).toBeInViewport();
  });

  test("A6: alta en otro mes del año → acumulado actualizado al reconsultar (FR-007)", async ({ page }) => {
    await openMonth(page, NOVEMBER, "Noviembre de 2025");
    await registerMovement(page, { note: "Ingreso noviembre", amount: "100,00", date: "2025-11-05", type: "income" });

    await expect(
      monthBalanceCell(page).getByText(new RegExp(`^\\+100,00${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      accumulatedCell(page).getByText(new RegExp(`^\u2212110,50${EUR}`)),
    ).toBeVisible({ timeout: 10_000 });

    await openMonth(page, MARCH, MARCH_LABEL);
    await expect(
      accumulatedCell(page).getByText(new RegExp(`^\u2212110,50${EUR}`)),
    ).toBeVisible();
  });

  test("A7: limpieza total UI-driven → ambos años vuelven a 0,00 €", async ({ page }) => {
    await openMonth(page, MARCH, MARCH_LABEL);
    await deleteMovementByNote(page, "Nómina marzo");
    await deleteMovementByNote(page, "Gasto marzo");
    for (let index = 1; index <= 12; index += 1) {
      await deleteMovementByNote(page, `Tanda ${String(index).padStart(2, "0")}`);
    }
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible();

    await openMonth(page, JULY, JULY_LABEL);
    await deleteMovementByNote(page, "Gasto julio");
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible();

    await openMonth(page, NOVEMBER, "Noviembre de 2025");
    await deleteMovementByNote(page, "Ingreso noviembre");
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible();
    await expect(accumulatedCell(page).getByText(/^Año 2025$/)).toBeVisible();
    await expect(accumulatedCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();

    await openMonth(page, OTHER_YEAR, OTHER_YEAR_LABEL);
    await deleteMovementByNote(page, "Ingreso 2024");
    await expect(page.getByText(/Aún no hay movimientos en este mes/)).toBeVisible();
    await expect(accumulatedCell(page).getByText(/^Año 2024$/)).toBeVisible();
    await expect(accumulatedCell(page).getByText(new RegExp(`^0,00${EUR}`))).toBeVisible();
  });
});
