import { expect, test, type Page } from "@playwright/test";

function tagCatalog(page: Page) {
  return page.getByRole("region", { name: "Catálogo de etiquetas" });
}

function categoryGroup(page: Page, name: string) {
  return tagCatalog(page).getByRole("region", { name: `Categoría ${name}` });
}

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

async function openCreateTagDialog(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva etiqueta" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nombre").fill(name);
}

test.describe("jerarquía de etiquetas (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("J1: crear categoría por inferencia — «Nueva etiqueta» sin padre (FR-002, esc. 2)", async ({
    page,
  }) => {
    await page.goto("/tags");
    await expect(page.getByRole("heading", { name: "Etiquetas", exact: true })).toBeVisible();

    await openCreateTagDialog(page, "Suscripciones");
    await expect(
      page.getByRole("dialog", { name: "Nueva etiqueta" }).getByRole("combobox", { name: "Categoría" }),
    ).toHaveText(/Ninguna — se creará una categoría/);
    await page.getByRole("dialog", { name: "Nueva etiqueta" }).getByRole("button", { name: "Crear" }).click();

    await expect(page.getByText("Categoría creada")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog", { name: "Nueva etiqueta" })).not.toBeVisible();

    const suscripciones = categoryGroup(page, "Suscripciones");
    await expect(suscripciones).toBeVisible({ timeout: 10_000 });
    await expect(suscripciones.getByText("Sin etiquetas")).toBeVisible();
    await expect(suscripciones.getByRole("listitem")).toHaveCount(0);

    const groups = tagCatalog(page).getByRole("region", { name: /^Categoría / });
    await expect(groups.first()).toHaveAttribute("aria-label", "Categoría General");
    await expect(groups.nth(1)).toHaveAttribute("aria-label", "Categoría Suscripciones");
  });

  test("J2: duplicado case-insensitive sin padre — alerta con el valor conservado (esc. 3)", async ({
    page,
  }) => {
    await page.goto("/tags");

    await openCreateTagDialog(page, "SUSCRIPCIONES");
    const dialog = page.getByRole("dialog", { name: "Nueva etiqueta" });
    await dialog.getByRole("button", { name: "Crear" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(
      'Ya existe una categoría con el nombre "Suscripciones".',
      { timeout: 10_000 },
    );
    await expect(dialog.getByLabel("Nombre")).toHaveValue("SUSCRIPCIONES");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("J3: crear etiqueta con padre — fila dentro del grupo (FR-001, esc. 1/2)", async ({ page }) => {
    await page.goto("/tags");

    await openCreateTagDialog(page, "Netflix");
    const dialog = page.getByRole("dialog", { name: "Nueva etiqueta" });
    await dialog.getByRole("combobox", { name: "Categoría" }).click();
    await page.getByRole("option", { name: "Suscripciones", exact: true }).click();
    await dialog.getByRole("button", { name: "Crear" }).click();

    await expect(page.getByText("Etiqueta creada")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const suscripciones = categoryGroup(page, "Suscripciones");
    await expect(
      suscripciones.getByRole("listitem").filter({ hasText: "Netflix" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(suscripciones.getByText("1 etiqueta")).toBeVisible();
    await expect(
      categoryGroup(page, "General").getByRole("listitem").filter({ hasText: "Netflix" }),
    ).toHaveCount(0);
  });

  test("J4: gasto con la etiqueta nueva — Select agrupado con cabecera no seleccionable (FR-004/005, esc. 5/6)", async ({
    page,
  }) => {
    await page.goto("/accounts/1?month=2026-01");
    await expect(
      page.getByRole("heading", { name: "Cuenta de Miembro A", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await expect(dialog).toBeVisible();

    await page.getByLabel("Fecha", { exact: true }).fill("2026-01-15");
    await page.getByLabel("Nota", { exact: true }).fill("Cuota enero");
    await page.getByLabel("Importe (€)").fill("12,99");
    await page.getByRole("radio", { name: "Personal", exact: true }).check();

    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    const groupLabel = page
      .locator('[data-slot="select-group"]')
      .filter({ has: page.locator('[data-slot="select-label"]', { hasText: "Suscripciones" }) });
    await expect(groupLabel).toBeVisible();
    await expect(
      groupLabel.getByRole("option", { name: "Netflix", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "Suscripciones", exact: true })).toHaveCount(0);

    await page.getByRole("option", { name: "Netflix", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText("Netflix");

    await page.getByRole("button", { name: "Guardar y cerrar" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const movementRow = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Cuota enero" })
      .first();
    await expect(movementRow).toBeVisible({ timeout: 10_000 });
    await expect(movementRow).toContainText("Netflix");
  });

  test("J5: restauración del catálogo — movimiento borrado, etiqueta a la genérica y categoría eliminada", async ({
    page,
  }) => {
    await page.goto("/accounts/1?month=2026-01");

    const movementRow = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Cuota enero" })
      .first();
    await movementRow.getByRole("button", { name: "Eliminar Cuota enero" }).click();

    const deleteDialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await deleteDialog.getByRole("button", { name: /^Eliminar$/ }).click();
    await expect(deleteDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Cuota enero" }),
    ).toHaveCount(0, { timeout: 10_000 });

    await page.goto("/tags");
    await expect(categoryGroup(page, "Suscripciones")).toBeVisible();

    await page.getByRole("button", { name: "Acciones de Netflix", exact: true }).click();
    await page.getByRole("menuitem", { name: "Mover a categoría…" }).click();
    const moveDialog = page.getByRole("dialog", { name: "Mover etiqueta" });
    await moveDialog.getByRole("combobox", { name: "Categoría" }).click();
    await page.getByRole("option", { name: "General", exact: true }).click();
    await moveDialog.getByRole("button", { name: "Mover" }).click();
    await expect(page.getByText("Etiqueta movida a General")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Acciones de la categoría Suscripciones" }).click();
    await page.getByRole("menuitem", { name: "Eliminar…" }).click();
    const categoryDialog = page.getByRole("alertdialog", { name: "Eliminar categoría" });
    await categoryDialog.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Categoría eliminada")).toBeVisible({ timeout: 10_000 });
    await expect(categoryDialog).not.toBeVisible();

    await expect(categoryGroup(page, "Suscripciones")).toHaveCount(0);
    const general = categoryGroup(page, "General");
    await expect(general.getByRole("listitem").filter({ hasText: "Netflix" })).toBeVisible();
    await expect(general.getByRole("listitem").filter({ hasText: "Netflix" })).toContainText(
      "Activa",
    );
  });
});
