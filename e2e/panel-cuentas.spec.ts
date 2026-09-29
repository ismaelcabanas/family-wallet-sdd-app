import { expect, test } from "@playwright/test";

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

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTH_LONG_NAMES[now.getMonth()]} de ${now.getFullYear()}`;
}

test.describe("panel de cuentas", () => {
  test("N1: el panel es un lanzador puro — una tarjeta por cuenta con nombre y tipo, sin nada más", async ({
    page,
  }) => {
    await page.goto("/");

    const accounts = page.getByRole("list", { name: "Cuentas" });
    await expect(accounts).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Cuenta de Miembro A\s*Cuenta personal de Miembro A/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Cuenta de Miembro B\s*Cuenta personal de Miembro B/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Cuenta común\s*Cuenta común/ })).toBeVisible();

    await expect(accounts.getByRole("link")).toHaveCount(3);

    await expect(page.getByText("€")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Cuenta activa" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Registrar" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Movimientos del mes" })).toHaveCount(0);
    await expect(page.getByRole("region").filter({ hasText: "Cierre de" })).toHaveCount(0);
  });

  test("N2: un clic en la tarjeta de Miembro B lleva a /accounts/2 en su mes actual", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Cuenta de Miembro B/ }).click();

    await expect(page).toHaveURL(/\/accounts\/2$/);
    await expect(
      page.getByRole("heading", { name: "Cuenta de Miembro B", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Mes visible" })).toContainText(
      currentMonthLabel(),
    );
  });

  test("N3: navegación global en / con los 3 destinos y Panel activo", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Panel", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Resumen global" })).not.toHaveAttribute(
      "aria-current",
    );
    await expect(nav.getByRole("link", { name: "Cuenta de resultados" })).not.toHaveAttribute(
      "aria-current",
    );
    await expect(nav.getByRole("link", { name: "Panel", exact: true })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("N4: query ?month= residual en / se ignora sin error", async ({ page }) => {
    const response = await page.goto("/?month=2025-01");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Family Wallet" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Cuentas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar" })).toHaveCount(0);
  });

  test("N5: la navegación global propaga el contexto temporal y marca el destino activo", async ({
    page,
  }) => {
    await page.goto("/accounts/2?month=2026-03");

    let nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Panel", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Resumen global" })).toHaveAttribute(
      "href",
      "/summary?month=2026-03",
    );
    await expect(nav.getByRole("link", { name: "Cuenta de resultados" })).toHaveAttribute(
      "href",
      "/annual?year=2026",
    );

    await page.goto("/summary?month=2025-01");

    nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Resumen global" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Cuenta de resultados" })).toHaveAttribute(
      "href",
      "/annual?year=2025",
    );

    await page.goto("/annual?year=2028");

    nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Cuenta de resultados" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Resumen global" })).toHaveAttribute(
      "href",
      "/summary?month=2028-01",
    );
    await expect(nav.getByRole("link", { name: "Panel", exact: true })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
