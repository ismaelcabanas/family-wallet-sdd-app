import { expect, test, type Page } from "@playwright/test";

function movementList(page: Page) {
  return page.getByRole("region", { name: "Movimientos del mes" });
}

function closurePanel(page: Page) {
  return page.getByRole("region").filter({ hasText: "Cierre de" }).first();
}

function tagCatalog(page: Page) {
  return page.getByRole("region", { name: "Catálogo de etiquetas" });
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

async function registerMovementWithInlineTag(
  page: Page,
  note: string,
  amount: string,
  tagName: string,
): Promise<void> {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await expect(dialog).toBeVisible();

  await page.getByLabel("Fecha", { exact: true }).fill("2026-09-10");
  await page.getByLabel("Nota", { exact: true }).fill(note);
  await page.getByLabel("Importe (€)").fill(amount);
  await page.getByRole("radio", { name: "Personal", exact: true }).check();
  await createTagInline(page, tagName);

  await page.getByRole("button", { name: "Guardar y cerrar" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await expect(
    movementList(page)
      .getByRole("listitem")
      .filter({ hasText: note })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function openTagActions(page: Page, tagName: string): Promise<Page> {
  await page.getByRole("button", { name: `Acciones de ${tagName}`, exact: true }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  return page;
}

test.describe("gestión del catálogo de etiquetas (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await openAccount(page, "Cuenta de Miembro B");
    await selectMonth(page, "Septiembre de 2026");
  });

  test("G1: acceso por navegación y catálogo completo con estados y protección", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Etiquetas" }).click();
    await expect(page).toHaveURL(/\/tags$/);
    await expect(page.getByRole("heading", { name: "Etiquetas", exact: true })).toBeVisible();

    const catalog = tagCatalog(page);
    await expect(catalog.getByRole("listitem").filter({ hasText: "Aportación Común" })).toHaveText(
      /Sistema/,
    );
    await expect(
      catalog.getByRole("button", { name: "Acciones de Aportación Común" }),
    ).toHaveCount(0);

    const ocioRow = catalog.getByRole("listitem").filter({ hasText: "Ocio" });
    await expect(ocioRow).toHaveText(/Activa/);
  });

  test("G2: renombrar se refleja en listado y cierres con totales intactos (SC-002)", async ({
    page,
  }) => {
    await registerMovementWithInlineTag(page, "Compra semanal", "50,00", "super");
    await registerMovementWithInlineTag(page, "Compra en casa", "30,00", "super-casa");

    const gastosBefore = await closurePanel(page)
      .locator("dd")
      .filter({ hasText: /80,00[\s\u00A0\u202F]€/u })
      .first()
      .count();
    expect(gastosBefore).toBeGreaterThan(0);

    await page.getByRole("link", { name: "Etiquetas" }).click();
    await openTagActions(page, "super");
    await page.getByRole("menuitem", { name: "Renombrar…" }).click();

    const dialog = page.getByRole("dialog", { name: "Renombrar etiqueta" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Nombre")).toHaveValue("super");
    await dialog.getByLabel("Nombre").fill("supermercado");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Etiqueta renombrada")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();
    await expect(
      tagCatalog(page).getByRole("listitem").filter({ hasText: "supermercado" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("link", { name: "Panel" }).click();
    await page.getByRole("link", { name: "Cuenta de Miembro B" }).click();
    await selectMonth(page, "Septiembre de 2026");

    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: "Compra semanal" })
        .first(),
    ).toContainText("supermercado");

    const breakdown = closurePanel(page)
      .getByRole("list")
      .getByRole("listitem")
      .filter({ hasText: "supermercado" });
    await expect(breakdown).toContainText(/50,00[\s\u00A0\u202F]€/u, { timeout: 10_000 });
    await expect(
      closurePanel(page)
        .locator("dd")
        .filter({ hasText: /80,00[\s\u00A0\u202F]€/u })
        .first(),
    ).toBeVisible();
  });

  test("G3: duplicado en renombrado rechazado conservando el nombre en el campo (SC-004)", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Etiquetas" }).click();
    await openTagActions(page, "supermercado");
    await page.getByRole("menuitem", { name: "Renombrar…" }).click();

    const dialog = page.getByRole("dialog", { name: "Renombrar etiqueta" });
    await dialog.getByLabel("Nombre").fill("Ocio");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog.getByRole("alert")).toHaveText('Ya existe una etiqueta con el nombre "Ocio".', {
      timeout: 10_000,
    });
    await expect(dialog.getByLabel("Nombre")).toHaveValue("Ocio");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("G4: fusionar reasigna movimientos y conserva los totales globales (SC-002)", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Etiquetas" }).click();
    await openTagActions(page, "super-casa");
    await page.getByRole("menuitem", { name: "Fusionar en otra…" }).click();

    const dialog = page.getByRole("dialog", { name: "Fusionar etiqueta" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/super-casa/).first()).toBeVisible();

    await dialog.getByRole("combobox", { name: "Etiqueta resultante" }).click();
    await expect(
      dialog.getByRole("option", { name: "Aportación Común", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("option", { name: "supermercado", exact: true }).click();
    await dialog.getByRole("button", { name: "Fusionar" }).click();

    await expect(page.getByText("Etiquetas fusionadas")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();
    await expect(
      tagCatalog(page).getByRole("listitem").filter({ hasText: "super-casa" }),
    ).toHaveCount(0, { timeout: 10_000 });

    await page.getByRole("link", { name: "Panel" }).click();
    await page.getByRole("link", { name: "Cuenta de Miembro B" }).click();
    await selectMonth(page, "Septiembre de 2026");

    const panel = closurePanel(page);
    const breakdownItem = panel
      .getByRole("list")
      .getByRole("listitem")
      .filter({ hasText: "supermercado" });
    await expect(breakdownItem).toContainText(/80,00[\s\u00A0\u202F]€/u, { timeout: 10_000 });
    await expect(
      panel
        .locator("dd")
        .filter({ hasText: /80,00[\s\u00A0\u202F]€/u })
        .first(),
    ).toBeVisible();
    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: "Compra en casa" })
        .first(),
    ).toContainText("supermercado");
  });

  test("G5: desactivar conserva el histórico y la retira del Select del alta (SC-003)", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Etiquetas" }).click();
    await openTagActions(page, "supermercado");
    await page.getByRole("menuitem", { name: "Desactivar…" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Desactivar etiqueta" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/dejará de ofrecerse/)).toBeVisible();
    await dialog.getByRole("button", { name: "Desactivar" }).click();

    await expect(page.getByText("Etiqueta desactivada")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();
    const deactivatedRow = tagCatalog(page)
      .getByRole("listitem")
      .filter({ hasText: "supermercado" });
    await expect(deactivatedRow).toHaveText(/Inactiva/, { timeout: 10_000 });

    await page.getByRole("link", { name: "Panel" }).click();
    await page.getByRole("link", { name: "Cuenta de Miembro B" }).click();
    await selectMonth(page, "Septiembre de 2026");

    await expect(
      movementList(page)
        .getByRole("listitem")
        .filter({ hasText: "Compra semanal" })
        .first(),
    ).toContainText("supermercado");
    await expect(
      closurePanel(page).getByText("supermercado").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await expect(
      page.getByRole("option", { name: "supermercado", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancelar" }).first().click();
  });

  test("G6: reactivar devuelve la etiqueta al Select con histórico intacto", async ({ page }) => {
    await page.getByRole("link", { name: "Etiquetas" }).click();
    await openTagActions(page, "supermercado");
    await page.getByRole("menuitem", { name: "Reactivar" }).click();

    await expect(page.getByText("Etiqueta reactivada")).toBeVisible({ timeout: 10_000 });
    await expect(
      tagCatalog(page).getByRole("listitem").filter({ hasText: "supermercado" }),
    ).toHaveText(/Activa/, { timeout: 10_000 });

    await page.getByRole("link", { name: "Panel" }).click();
    await page.getByRole("link", { name: "Cuenta de Miembro B" }).click();
    await selectMonth(page, "Septiembre de 2026");

    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    await page.getByRole("combobox", { name: "Etiqueta" }).click();
    await expect(
      page.getByRole("option", { name: "supermercado", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancelar" }).first().click();
  });

  test("G7: la etiqueta de sistema no aparece como destino de fusión (FR-007)", async ({ page }) => {
    await page.getByRole("link", { name: "Etiquetas" }).click();
    await openTagActions(page, "Ocio");
    await page.getByRole("menuitem", { name: "Fusionar en otra…" }).click();

    const dialog = page.getByRole("dialog", { name: "Fusionar etiqueta" });
    await dialog.getByRole("combobox", { name: "Etiqueta resultante" }).click();

    await expect(
      page.getByRole("option", { name: "Aportación Común", exact: true }),
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
  });
});
