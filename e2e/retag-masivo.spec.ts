import { expect, test, type Page } from "@playwright/test";

const ACCOUNT_URL = "/accounts/2?month=2026-02";
const ACCOUNT_NAME = "Cuenta de Miembro B";
const EUR = "[\\s\\u00A0\\u202F]€";

const OCIO_MOVEMENTS = [
  { note: "Cine febrero", date: "2026-02-05", amount: "12,00" },
  { note: "Museo febrero", date: "2026-02-08", amount: "8,00" },
  { note: "Concierto febrero", date: "2026-02-12", amount: "20,00" },
];
const PROTECTED_MOVEMENT = { note: "Aporte especial", date: "2026-02-10", amount: "30,00" };
const UNTAGGED_INCOME = { note: "Devolución febrero", date: "2026-02-15", amount: "15,00" };

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function kpisRegion(page: Page) {
  return page.getByRole("region", { name: "KPIs del mes" });
}

function balanceCell(page: Page) {
  return kpisRegion(page).getByText("Saldo del mes").locator("..");
}

function personalExpenseCell(page: Page) {
  return kpisRegion(page).getByText("Gasto personal").locator("..");
}

async function gotoAccount(page: Page): Promise<void> {
  await page.goto(ACCOUNT_URL);
  await expect(page.getByRole("heading", { name: ACCOUNT_NAME, exact: true })).toBeVisible();
}

async function registerMovement(
  page: Page,
  fields: {
    note: string;
    amount: string;
    date: string;
    type?: "expense" | "income";
    nature?: "personal" | "shared";
    tag?: string;
  },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await page.getByLabel("Fecha", { exact: true }).fill(fields.date);
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
  await expect(page.getByText("Movimiento guardado").last()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible();

  await expect(
    movementList(page)
      .getByRole("listitem")
      .filter({ hasText: fields.note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function openRetagDialog(
  page: Page,
  notes: string[],
): Promise<void> {
  await page.getByRole("button", { name: "Seleccionar" }).click();
  for (const note of notes) {
    await page.getByRole("checkbox", { name: `Seleccionar ${note}` }).check();
  }
  await page.getByRole("button", { name: "Cambiar etiqueta…" }).click();
  await expect(page.getByRole("dialog", { name: "Cambiar etiqueta" })).toBeVisible();
}

async function confirmRetag(
  page: Page,
  targetTag: string,
  expectedToast: string,
): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Cambiar etiqueta" });
  await dialog.getByRole("combobox", { name: "Nueva etiqueta" }).click();
  await page.getByRole("option", { name: targetTag, exact: true }).click();
  await dialog.getByRole("button", { name: "Reasignar" }).click();

  await expect(page.getByText(expectedToast).last()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("dialog", { name: "Cambiar etiqueta" })).not.toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("checkbox")).toHaveCount(0);
}

test.describe("reasignación masiva de etiquetas (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("G1: «Seleccionar» habilita el modo con checkboxes en las filas seleccionables", async ({
    page,
  }) => {
    await gotoAccount(page);
    for (const movement of OCIO_MOVEMENTS) {
      await registerMovement(page, { ...movement, nature: "personal", tag: "Ocio" });
    }
    await registerMovement(page, {
      ...PROTECTED_MOVEMENT,
      nature: "personal",
      tag: "Aportación Común",
    });
    await registerMovement(page, { ...UNTAGGED_INCOME, type: "income" });

    await expect(page.getByRole("button", { name: "Seleccionar" })).toBeEnabled();
    await page.getByRole("button", { name: "Seleccionar" }).click();

    await expect(page.getByText("0 seleccionados")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(4);
    await expect(
      page.getByRole("checkbox", { name: `Seleccionar ${PROTECTED_MOVEMENT.note}` }),
    ).toHaveCount(0);
  });

  test("G2: «Seleccionar todo» marca solo las seleccionables (recuento n−1) y «Ninguno» limpia", async ({
    page,
  }) => {
    await gotoAccount(page);
    await page.getByRole("button", { name: "Seleccionar" }).click();

    await page.getByRole("button", { name: "Seleccionar todo" }).click();
    await expect(page.getByText("4 seleccionados")).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeChecked();

    await page.getByRole("button", { name: "Ninguno" }).click();
    await expect(page.getByText("0 seleccionados")).toBeVisible();
    await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  });

  test("G3: reasignar 2 de «Ocio» a «Hogar» → toast, filas actualizadas y resto intacto", async ({
    page,
  }) => {
    await gotoAccount(page);

    const balanceBefore = await balanceCell(page).textContent();
    const personalExpenseBefore = await personalExpenseCell(page).textContent();

    await openRetagDialog(page, ["Cine febrero", "Museo febrero"]);
    const dialog = page.getByRole("dialog", { name: "Cambiar etiqueta" });
    await expect(dialog).toContainText("Se cambiará la etiqueta de 2 movimientos.");

    await confirmRetag(page, "Hogar", "2 movimientos actualizados");

    const cineRow = movementList(page).getByRole("listitem").filter({ hasText: "Cine febrero" });
    const museoRow = movementList(page).getByRole("listitem").filter({ hasText: "Museo febrero" });
    await expect(cineRow.getByText("Hogar", { exact: true })).toBeVisible();
    await expect(museoRow.getByText("Hogar", { exact: true })).toBeVisible();
    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: "Concierto febrero" })
        .getByText("Ocio", { exact: true }),
    ).toBeVisible();
    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: PROTECTED_MOVEMENT.note })
        .getByText("Aportación Común", { exact: true }),
    ).toBeVisible();
    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: UNTAGGED_INCOME.note })
        .getByText("Ocio"),
    ).toHaveCount(0);

    expect(await balanceCell(page).textContent()).toBe(balanceBefore);
    expect(await personalExpenseCell(page).textContent()).toBe(personalExpenseBefore);
  });

  test("G4: los KPIs y el saldo del mes quedan idénticos tras la operación (SC-002)", async ({
    page,
  }) => {
    await gotoAccount(page);

    await expect(kpisRegion(page)).toBeVisible();
    await expect(balanceCell(page).getByText(new RegExp(`^−55,00${EUR}`))).toBeVisible();
    await expect(personalExpenseCell(page).getByText(new RegExp(`^70,00${EUR}`))).toBeVisible();
  });

  test("G5: no-op con destino igual al actual → «1 movimiento actualizado»", async ({ page }) => {
    await gotoAccount(page);

    await openRetagDialog(page, ["Cine febrero"]);
    await expect(
      page.getByRole("dialog", { name: "Cambiar etiqueta" }),
    ).toContainText("Se cambiará la etiqueta de 1 movimientos.");

    await confirmRetag(page, "Hogar", "1 movimiento actualizado");

    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: "Cine febrero" })
        .getByText("Hogar", { exact: true }),
    ).toBeVisible();
  });

  test("G6: /summary muestra los importes por etiqueta movidos con totales exactos", async ({
    page,
  }) => {
    await page.goto("/summary?month=2026-02");

    await expect(page.getByText("Resumen global de febrero de 2026")).toBeVisible();
    await expect(page.getByText("Ingresos", { exact: true }).locator("..")).toContainText("15,00");
    await expect(page.getByText("Gastos", { exact: true }).locator("..")).toContainText("70,00");
    await expect(page.getByText("Saldo del mes", { exact: true }).locator("..")).toContainText(
      "−55,00",
    );

    const breakdown = page.getByRole("listitem");
    await expect(breakdown.filter({ hasText: "Hogar" })).toContainText("20,00");
    await expect(breakdown.filter({ hasText: "Ocio" })).toContainText("20,00");
    await expect(breakdown.filter({ hasText: "Aportación Común" })).toContainText("30,00");
  });

  test("G7: «Salir de la selección» limpia el modo sin efectos", async ({ page }) => {
    await gotoAccount(page);

    await page.getByRole("button", { name: "Seleccionar" }).click();
    await page.getByRole("checkbox", { name: "Seleccionar Cine febrero" }).check();
    await expect(page.getByText("1 seleccionados")).toBeVisible();

    await page.getByRole("button", { name: "Salir de la selección" }).click();

    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Seleccionar" })).toBeVisible();

    await page.getByRole("button", { name: "Seleccionar" }).click();
    await expect(page.getByText("0 seleccionados")).toBeVisible();
  });
});
