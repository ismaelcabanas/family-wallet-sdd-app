import { expect, test, type Page } from "@playwright/test";

const EUR = "[\\s\\u00A0\\u202F]€";

function tagCatalog(page: Page) {
  return page.getByRole("region", { name: "Catálogo de etiquetas" });
}

function categoryGroup(page: Page, name: string) {
  return tagCatalog(page).getByRole("region", { name: `Categoría ${name}` });
}

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

async function gotoTags(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Etiquetas" }).click();
  await expect(page).toHaveURL(/\/tags$/);
}

async function registerMovementWithInlineTag(
  page: Page,
  note: string,
  amount: string,
  tagName: string,
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await page.getByLabel("Fecha", { exact: true }).fill("2026-10-12");
  await page.getByLabel("Nota", { exact: true }).fill(note);
  await page.getByLabel("Importe (€)").fill(amount);
  await page.getByRole("radio", { name: "Personal", exact: true }).check();

  await page.getByRole("button", { name: "+ Nueva etiqueta" }).click();
  await page.getByLabel("Nombre de la etiqueta").fill(tagName);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByText("Etiqueta creada")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("combobox", { name: "Etiqueta" })).toContainText(tagName);

  await page.getByRole("button", { name: "Guardar y cerrar" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await expect(
    movementList(page)
      .getByRole("listitem")
      .filter({ hasText: note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function openTagActions(page: Page, tagName: string): Promise<void> {
  await page.getByRole("button", { name: `Acciones de ${tagName}`, exact: true }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}

async function moveTagToCategory(page: Page, tagName: string, categoryName: string): Promise<void> {
  await openTagActions(page, tagName);
  await page.getByRole("menuitem", { name: "Mover a categoría…" }).click();

  const dialog = page.getByRole("dialog", { name: "Mover etiqueta" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "Categoría" }).click();
  await page.getByRole("option", { name: categoryName, exact: true }).click();
  await dialog.getByRole("button", { name: "Mover" }).click();

  await expect(page.getByText(`Etiqueta movida a ${categoryName}`)).toBeVisible({
    timeout: 10_000,
  });
  await expect(dialog).not.toBeVisible();
}

test.describe("categorías de etiquetas (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("G1: puesta en marcha — todas las etiquetas del seed bajo «Categoría General» (backfill)", async ({
    page,
  }) => {
    await page.goto("/tags");
    await expect(page.getByRole("heading", { name: "Etiquetas", exact: true })).toBeVisible();

    const general = categoryGroup(page, "General");
    await expect(general).toBeVisible();
    for (const tagName of [
      "Hogar",
      "Coche",
      "Salud",
      "Alimentación",
      "Ocio",
      "Viaje",
      "Ropa",
      "Regalos",
      "Suscripciones online",
      "Sin Clasificar",
      "Vivienda",
      "Hipoteca",
      "Aportación Común",
    ]) {
      await expect(general.getByRole("listitem").filter({ hasText: tagName })).toBeVisible();
    }

    await expect(
      tagCatalog(page).getByRole("region", { name: /^Categoría / }).filter({ hasNotText: "General" }),
    ).toHaveCount(0);
    await expect(general.getByText("13 etiquetas")).toBeVisible();

    const contributionRow = general.getByRole("listitem").filter({ hasText: "Aportación Común" });
    await expect(contributionRow).toHaveText(/Sistema/);
  });

  test("G2: crear categoría — grupo vacío ordenado tras la genérica (esc. 2)", async ({ page }) => {
    await page.goto("/tags");

    await page.getByRole("button", { name: "Nueva etiqueta" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva etiqueta" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nombre").fill("Alimentación");
    await dialog.getByRole("button", { name: "Crear" }).click();

    await expect(page.getByText("Categoría creada")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const alimentacion = categoryGroup(page, "Alimentación");
    await expect(alimentacion).toBeVisible({ timeout: 10_000 });
    await expect(alimentacion.getByText("Sin etiquetas")).toBeVisible();
    await expect(alimentacion.getByRole("listitem")).toHaveCount(0);

    const groups = tagCatalog(page).getByRole("region", { name: /^Categoría / });
    await expect(groups).toHaveCount(2);
    await expect(groups.first()).toHaveAttribute("aria-label", "Categoría General");
    await expect(groups.nth(1)).toHaveAttribute("aria-label", "Categoría Alimentación");
  });

  test("G3: duplicado case-insensitive rechazado conservando el valor (esc. 3)", async ({ page }) => {
    await page.goto("/tags");

    await page.getByRole("button", { name: "Nueva etiqueta" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva etiqueta" });
    await dialog.getByLabel("Nombre").fill("alimentación");
    await dialog.getByRole("button", { name: "Crear" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(
      'Ya existe una categoría con el nombre "Alimentación".',
      { timeout: 10_000 },
    );
    await expect(dialog.getByLabel("Nombre")).toHaveValue("alimentación");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("G4: mover etiqueta — nace en la genérica y cambia de grupo sin recarga (esc. 4, esc. 8)", async ({
    page,
  }) => {
    await page.goto("/accounts/1?month=2026-10");
    await expect(
      page.getByRole("heading", { name: "Cuenta de Miembro A", exact: true }),
    ).toBeVisible();

    await registerMovementWithInlineTag(page, "Compra octubre", "64,50", "Mercadona");

    await gotoTags(page);
    const general = categoryGroup(page, "General");
    await expect(
      general.getByRole("listitem").filter({ hasText: "Mercadona" }),
    ).toBeVisible({ timeout: 10_000 });

    await moveTagToCategory(page, "Mercadona", "Alimentación");

    await expect(
      categoryGroup(page, "Alimentación")
        .getByRole("listitem")
        .filter({ hasText: "Mercadona" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      categoryGroup(page, "General").getByRole("listitem").filter({ hasText: "Mercadona" }),
    ).toHaveCount(0);
  });

  test("G5: histórico e informes intactos tras mover (esc. 5, SC-003)", async ({ page }) => {
    await page.goto("/accounts/1?month=2026-10");

    const movementRow = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Compra octubre" })
      .first();
    await expect(movementRow).toContainText("Mercadona");
    await expect(movementRow).toContainText(/−64,50/u);

    await page.getByRole("link", { name: "Resumen global" }).click();
    await page.getByRole("combobox", { name: "Mes visible" }).click();
    await page.getByRole("option", { name: "Octubre de 2026" }).click();
    const summary = page.getByRole("region", { name: "Resumen global de Octubre de 2026" });
    await expect(summary).toBeVisible();
    const summaryTagRow = summary.getByRole("listitem").filter({ hasText: "Mercadona" });
    await expect(summaryTagRow).toContainText(/64,50/u);

    await page.getByRole("link", { name: "Cuenta de resultados" }).click();
    await expect(page).toHaveURL(/\/annual\?year=2026$/);
    const breakdown = page.getByRole("region", { name: "Desglose de gastos por tag" });
    const annualTagRow = breakdown.getByRole("row", { name: /^Mercadona/ });
    await expect(annualTagRow).toContainText(new RegExp(`64,50${EUR}`));
  });

  test("G6: renombrar categoría — grupo con nuevo nombre y etiquetas dentro (esc. 6)", async ({
    page,
  }) => {
    await page.goto("/tags");

    await page
      .getByRole("button", { name: "Acciones de la categoría Alimentación" })
      .click();
    await page.getByRole("menuitem", { name: "Renombrar…" }).click();

    const dialog = page.getByRole("dialog", { name: "Renombrar categoría" });
    await expect(dialog.getByLabel("Nombre")).toHaveValue("Alimentación");
    await dialog.getByLabel("Nombre").fill("Comida");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Categoría renombrada")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const comida = categoryGroup(page, "Comida");
    await expect(comida).toBeVisible({ timeout: 10_000 });
    await expect(
      comida.getByRole("listitem").filter({ hasText: "Mercadona" }),
    ).toBeVisible();
    await expect(categoryGroup(page, "Alimentación")).toHaveCount(0);
  });

  test("G7: eliminar con etiquetas rechazado; restauración y eliminación vacía (esc. 7)", async ({
    page,
  }) => {
    await page.goto("/tags");

    await page.getByRole("button", { name: "Acciones de la categoría Comida" }).click();
    await page.getByRole("menuitem", { name: "Eliminar…" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Eliminar categoría" });
    await expect(dialog).toContainText(
      'Se eliminará la categoría "Comida". Las etiquetas no se verán afectadas.',
    );
    await dialog.getByRole("button", { name: "Eliminar" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(
      'La categoría "Comida" tiene etiquetas asignadas. Muévelas a otra categoría antes de eliminarla.',
      { timeout: 10_000 },
    );
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();

    await page.getByRole("button", { name: "Acciones de la categoría General" }).click();
    const generalMenu = page.getByRole("menu");
    await expect(generalMenu.getByRole("menuitem", { name: "Eliminar…" })).toHaveCount(0);
    await generalMenu.getByRole("menuitem", { name: "Renombrar…" }).click();
    const renameDialog = page.getByRole("dialog", { name: "Renombrar categoría" });
    await expect(renameDialog.getByLabel("Nombre")).toHaveValue("General");
    await renameDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(renameDialog).not.toBeVisible();

    await moveTagToCategory(page, "Mercadona", "General");

    await page.getByRole("button", { name: "Acciones de la categoría Comida" }).click();
    await page.getByRole("menuitem", { name: "Eliminar…" }).click();
    await dialog.getByRole("button", { name: "Eliminar" }).click();

    await expect(page.getByText("Categoría eliminada")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();
    await expect(categoryGroup(page, "Comida")).toHaveCount(0);
    await expect(
      categoryGroup(page, "General")
        .getByRole("listitem")
        .filter({ hasText: "Mercadona" }),
    ).toBeVisible();
  });

  test("G8: borrado del movimiento de prueba y catálogo restaurado", async ({ page }) => {
    await page.goto("/accounts/1?month=2026-10");

    const movementRow = movementList(page)
      .getByRole("listitem")
      .filter({ hasText: "Compra octubre" })
      .first();
    await movementRow.getByRole("button", { name: "Eliminar Compra octubre" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Eliminar movimiento" });
    await dialog.getByRole("button", { name: /^Eliminar$/ }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(
      movementList(page).getByRole("listitem").filter({ hasText: "Compra octubre" }),
    ).toHaveCount(0, { timeout: 10_000 });

    await gotoTags(page);
    await expect(
      tagCatalog(page).getByRole("region", { name: /^Categoría / }),
    ).toHaveCount(1);
    const general = categoryGroup(page, "General");
    await expect(general.getByRole("listitem").filter({ hasText: "Mercadona" })).toBeVisible();
    await expect(general.getByText("14 etiquetas")).toBeVisible();
  });
});
