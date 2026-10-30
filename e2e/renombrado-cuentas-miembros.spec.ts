import { expect, test, type Page } from "@playwright/test";

const MONTH_LONG_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function currentMonth(): { param: string; label: string } {
  const now = new Date();
  return {
    param: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    label: `${MONTH_LONG_NAMES[now.getMonth()]} de ${now.getFullYear()}`,
  };
}

function summaryPanel(page: Page, monthLabel: string) {
  return page.getByRole("region", { name: `Resumen global de ${monthLabel}` });
}

async function renameViaPanel(
  page: Page,
  cardName: string,
  kind: "member" | "account",
  newName: string,
): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: `Configuración de ${cardName}` }).click();
  await page.getByRole("menuitem", { name: kind === "member" ? "Renombrar miembro" : "Renombrar cuenta" }).click();

  const dialog = page.getByRole("dialog", {
    name: kind === "member" ? "Renombrar miembro" : "Renombrar cuenta",
  });
  await expect(dialog).toBeVisible();
  const label = kind === "member" ? "Nombre del miembro" : "Nombre de la cuenta";
  await dialog.getByLabel(label).fill(newName);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

test.describe("renombrado de cuentas y miembros (flujo crítico)", () => {
  test.describe.configure({ mode: "serial" });

  test("R1: renombrar «Miembro A»→«Isma» propaga el derivado con importes intactos", async ({
    page,
  }) => {
    const month = currentMonth();
    await page.goto(`/summary?month=${month.param}`);
    const memberARow = summaryPanel(page, month.label)
      .getByRole("table")
      .getByRole("row", { name: /Miembro A/ });
    const amountsBefore = ((await memberARow.textContent()) ?? "").replace("Miembro A", "").trim();

    await page.goto("/");
    await page.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }).click();
    await page.getByRole("menuitem", { name: "Renombrar miembro" }).click();

    const dialog = page.getByRole("dialog", { name: "Renombrar miembro" });
    await expect(dialog.getByLabel("Nombre del miembro")).toHaveValue("Miembro A");
    await dialog.getByLabel("Nombre del miembro").fill("Isma");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Miembro renombrado")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const derivedCard = page.getByRole("link", { name: /Cuenta de Isma\s*Cuenta personal de Isma/ });
    await expect(derivedCard).toBeVisible({ timeout: 10_000 });

    await derivedCard.click();
    await expect(page.getByRole("heading", { name: "Cuenta de Isma", exact: true })).toBeVisible();

    await page.goto(`/summary?month=${month.param}`);
    const ismaRow = summaryPanel(page, month.label)
      .getByRole("table")
      .getByRole("row", { name: "Isma" });
    await expect(ismaRow).toBeVisible();
    expect(((await ismaRow.textContent()) ?? "").replace("Isma", "").trim()).toBe(amountsBefore);
  });

  test("R2: renombrar la cuenta común actualiza tarjeta y página con el nuevo nombre", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Configuración de Cuenta común" }).click();
    await page.getByRole("menuitem", { name: "Renombrar cuenta" }).click();

    const dialog = page.getByRole("dialog", { name: "Renombrar cuenta" });
    await expect(dialog.getByLabel("Nombre de la cuenta")).toHaveValue("Cuenta común");
    await dialog.getByLabel("Nombre de la cuenta").fill("Cuenta conjunta");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Cuenta renombrada")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible();

    const card = page.getByRole("link", { name: /Cuenta conjunta\s*Cuenta común/ });
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.click();
    await expect(page.getByRole("heading", { name: "Cuenta conjunta", exact: true })).toBeVisible();
  });

  test("R3: validación — vacío conserva el campo y duplicado nocase bloquea sin guardar", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Configuración de Cuenta de Isma" }).click();
    await page.getByRole("menuitem", { name: "Renombrar miembro" }).click();

    const dialog = page.getByRole("dialog", { name: "Renombrar miembro" });
    await dialog.getByLabel("Nombre del miembro").fill("   ");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog.getByRole("alert")).toHaveText("El nombre del miembro es obligatorio.", {
      timeout: 10_000,
    });
    await expect(dialog.getByLabel("Nombre del miembro")).toHaveValue("   ");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();

    await page.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }).click();
    await page.getByRole("menuitem", { name: "Renombrar miembro" }).click();

    await dialog.getByLabel("Nombre del miembro").fill("ISMA");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog.getByRole("alert")).toHaveText('Ya existe un miembro con el nombre "ISMA".', {
      timeout: 10_000,
    });
    await expect(dialog.getByLabel("Nombre del miembro")).toHaveValue("ISMA");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancelar" }).click();
  });

  test("R4: trim — «  Sole  » se guarda como «Sole» y la tarjeta muestra el derivado", async ({
    page,
  }) => {
    await renameViaPanel(page, "Cuenta de Miembro B", "member", "  Sole  ");

    await expect(page.getByText("Miembro renombrado")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("link", { name: /Cuenta de Sole\s*Cuenta personal de Sole/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("R5: restauración final — los nombres del seed vuelven y el panel queda inicial", async ({
    page,
  }) => {
    await renameViaPanel(page, "Cuenta de Isma", "member", "Miembro A");
    await renameViaPanel(page, "Cuenta de Sole", "member", "Miembro B");
    await renameViaPanel(page, "Cuenta conjunta", "account", "Cuenta común");

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Cuenta de Miembro A\s*Cuenta personal de Miembro A/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Cuenta de Miembro B\s*Cuenta personal de Miembro B/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Cuenta común\s*Cuenta común/ })).toBeVisible();
  });
});
