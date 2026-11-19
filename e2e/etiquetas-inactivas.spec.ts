import { expect, test, type Page } from "@playwright/test";

const ACCOUNT_URL = "/accounts/1?month=2026-07";
const ACCOUNT_NAME = "Cuenta de Miembro A";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function inactiveChips(page: Page) {
  return movementList(page).locator('[data-inactive="true"]');
}

async function gotoAccount(page: Page): Promise<void> {
  await page.goto(ACCOUNT_URL);
  await expect(page.getByRole("heading", { name: ACCOUNT_NAME, exact: true })).toBeVisible();
}

async function createTagInline(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "+ Nueva etiqueta" }).click();
  await page.getByLabel("Nombre de la etiqueta").fill(name);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByText("Etiqueta creada")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText(name);
}

async function registerMovement(
  page: Page,
  fields: { note: string; amount: string; date: string; tag?: string; newTag?: string },
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await page.getByLabel("Fecha", { exact: true }).fill(fields.date);
  await page.getByLabel("Nota", { exact: true }).fill(fields.note);
  await page.getByLabel("Importe (€)").fill(fields.amount);
  await page.getByRole("radio", { name: "Personal", exact: true }).check();

  if (fields.newTag !== undefined) {
    await createTagInline(page, fields.newTag);
  } else if (fields.tag !== undefined) {
    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: fields.tag, exact: true }).click();
  }

  await page.getByRole("button", { name: "Guardar y cerrar" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await expect(
    movementList(page)
      .getByRole("listitem")
      .filter({ hasText: fields.note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function deactivateTag(page: Page, tagName: string): Promise<void> {
  await page.getByRole("link", { name: "Etiquetas" }).click();
  await page.getByRole("button", { name: `Acciones de ${tagName}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Desactivar…" }).click();

  const dialog = page.getByRole("alertdialog", { name: "Desactivar etiqueta" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Desactivar" }).click();

  await expect(page.getByText("Etiqueta desactivada")).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible();
}

test.describe("etiquetas inactivas visibles en el listado (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("I1: siembra 2 movimientos con etiqueta propia inline y 1 con etiqueta activa de contraste", async ({
    page,
  }) => {
    await gotoAccount(page);
    await registerMovement(page, {
      note: "Hotel julio",
      amount: "60,00",
      date: "2026-07-05",
      newTag: "Vacaciones",
    });
    await registerMovement(page, {
      note: "Excursión julio",
      amount: "40,00",
      date: "2026-07-08",
      tag: "Vacaciones",
    });
    await registerMovement(page, {
      note: "Cine julio",
      amount: "20,00",
      date: "2026-07-10",
      tag: "Ocio",
    });

    await expect(inactiveChips(page)).toHaveCount(0);
    await expect(movementList(page).getByRole("listitem")).toHaveCount(3);
  });

  test("I2: desactivar en /tags marca los chips y deja intacta la etiqueta activa (FR-001)", async ({
    page,
  }) => {
    await gotoAccount(page);
    await deactivateTag(page, "Vacaciones");
    await gotoAccount(page);

    await expect(inactiveChips(page)).toHaveCount(2, { timeout: 10_000 });
    await expect(inactiveChips(page).first()).toHaveAttribute(
      "title",
      "Vacaciones (inactiva)",
    );

    const ocioRow = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Cine julio" })
      .first();
    await expect(ocioRow.getByText("Ocio", { exact: true })).toBeVisible();
    await expect(ocioRow.locator('[data-inactive="true"]')).toHaveCount(0);
  });

  test("I3: editar fila marcada muestra la inactiva como valor no elegible y guardar sin cambiar da el error existente (FR-002)", async ({
    page,
  }) => {
    await gotoAccount(page);

    await page.getByRole("button", { name: "Editar Hotel julio" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Etiqueta" })).toContainText(
      "Vacaciones (inactiva)",
    );

    await dialog.getByRole("combobox", { name: "Etiqueta" }).click();
    const inactiveOption = page.getByRole("option", { name: "Vacaciones (inactiva)" });
    await expect(inactiveOption).toBeDisabled();
    await expect(page.getByRole("option").first()).toContainText("Vacaciones (inactiva)");
    await expect(page.getByRole("option", { name: "Ocio", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(
      "Una de las etiquetas seleccionadas ya no está disponible.",
      { timeout: 10_000 },
    );
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Etiqueta" })).toContainText(
      "Vacaciones (inactiva)",
    );

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("I4: reasignar a una activa restaura el chip normal (escenario 3)", async ({ page }) => {
    await gotoAccount(page);

    await page.getByRole("button", { name: "Editar Hotel julio" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Ocio", exact: true }).click();
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Movimiento actualizado")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const hotelRow = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Hotel julio" })
      .first();
    await expect(hotelRow.getByText("Ocio", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(hotelRow.locator('[data-inactive="true"]')).toHaveCount(0);
    await expect(inactiveChips(page)).toHaveCount(1);
  });

  test("I5: retag masivo de la fila aún marcada vacía el mes de marcadores (escenario 4)", async ({
    page,
  }) => {
    await gotoAccount(page);

    await page.getByRole("button", { name: "Seleccionar" }).click();
    await page
      .getByRole("checkbox", { name: "Seleccionar Excursión julio" })
      .check();
    await expect(inactiveChips(page)).toHaveCount(1);
    await page.getByRole("button", { name: "Cambiar etiqueta…" }).click();

    const dialog = page.getByRole("dialog", { name: "Cambiar etiqueta" });
    await expect(dialog).toContainText("Se cambiará la etiqueta de 1 movimientos.");
    await dialog.getByRole("combobox", { name: "Nueva etiqueta" }).click();
    await page.getByRole("option", { name: "Ocio", exact: true }).click();
    await dialog.getByRole("button", { name: "Reasignar" }).click();

    await expect(page.getByText("1 movimiento actualizado").last()).toBeVisible({
      timeout: 10_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(inactiveChips(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});
