import { expect, test, type Page } from "@playwright/test";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
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

async function createTagInline(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "+ Nueva etiqueta" }).click();
  await page.getByLabel("Nombre de la etiqueta").fill(name);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByText("Etiqueta creada")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText(name);
}

test.describe("creación de etiquetas desde el formulario (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await openAccount(page, "Cuenta de Miembro B");
    await selectMonth(page, "Mayo de 2026");
  });

  test("T1: tanda con creación inline en la 2.ª captura y reutilización en la 3.ª", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();

    await page.getByLabel("Fecha", { exact: true }).fill("2026-05-02");
    await page.getByLabel("Nota", { exact: true }).fill("Compra semanal");
    await page.getByLabel("Importe (€)").fill("42,10");
    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Alimentación", exact: true }).click();
    await page.getByRole("button", { name: "Guardar y seguir" }).click();
    await expect(dialog.getByText("Guardados: 1")).toBeVisible({ timeout: 10_000 });

    await page.getByLabel("Nota", { exact: true }).fill("Pienso y arena");
    await page.getByLabel("Importe (€)").fill("18,65");
    await createTagInline(page, "Mascotas");
    await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("Pienso y arena");
    await expect(page.getByLabel("Importe (€)")).toHaveValue("18,65");
    await page.getByRole("button", { name: "Guardar y seguir" }).click();
    await expect(dialog.getByText("Guardados: 2")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByLabel("Nota")).toHaveValue("");
    await expect(page.getByLabel("Importe (€)")).toHaveValue("");
    await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText(
      "Selecciona etiqueta",
    );

    await page.getByLabel("Nota", { exact: true }).fill("Juguete gato");
    await page.getByLabel("Importe (€)").fill("9,99");
    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Mascotas", exact: true }).click();
    await page.getByRole("button", { name: "Guardar y cerrar" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const mascotasItems = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Mascotas" });
    await expect(mascotasItems).toHaveCount(2, { timeout: 10_000 });
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Compra semanal" }),
    ).toBeVisible();
  });

  test("T2: duplicado case-insensitive rechazado con mensaje y datos intactos", async ({ page }) => {
    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();

    await page.getByLabel("Nota", { exact: true }).fill("Factura");
    await page.getByLabel("Importe (€)").fill("30,00");
    await page.getByRole("button", { name: "+ Nueva etiqueta" }).click();
    await page.getByLabel("Nombre de la etiqueta").fill("HOGAR");
    await page.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(
      page.getByText('Ya existe una etiqueta con el nombre "HOGAR".'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Nombre de la etiqueta")).toHaveValue("HOGAR");
    await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("Factura");
    await expect(page.getByLabel("Importe (€)")).toHaveValue("30,00");

    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(page.getByLabel("Nombre de la etiqueta")).not.toBeVisible();

    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(dialog).not.toBeVisible();
  });

  test("T3: cancelación de la captación sin efectos y nombre vacío bloquea", async ({ page }) => {
    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();

    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await page.getByRole("option", { name: "Ocio", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText("Ocio");

    await page.getByRole("button", { name: "+ Nueva etiqueta" }).click();
    await page.getByLabel("Nombre de la etiqueta").fill("Farmacia");
    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(page.getByLabel("Nombre de la etiqueta")).not.toBeVisible();
    await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText("Ocio");

    await page.getByRole("button", { name: "+ Nueva etiqueta" }).click();
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await expect(page.getByText("El nombre de la etiqueta es obligatorio.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel("Nombre de la etiqueta")).not.toBeDisabled();

    await page.getByLabel("Nombre de la etiqueta").click();
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Nombre de la etiqueta")).not.toBeVisible();
    await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText("Ocio");

    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(dialog).not.toBeVisible();
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Ocio" }),
    ).toHaveCount(0);
  });

  test("T4: creación en el diálogo de edición con guardado y cierre", async ({ page }) => {
    await page.getByRole("button", { name: "Editar Juguete gato" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();

    await createTagInline(page, "Regalos gato");

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Movimiento actualizado")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const movementItem = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Juguete gato" });
    await expect(movementItem).toContainText("Regalos gato");
  });
});
