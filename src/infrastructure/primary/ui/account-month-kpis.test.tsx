import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccountMonthKpis } from "./account-month-kpis";

afterEach(cleanup);

const EUR = "[\\s\\u00A0\\u202F]€$";

function renderKpis(
  netContribution: { configured: boolean; amountCents: number },
  monthBalanceCents: number,
  month = "2026-10",
) {
  render(
    <AccountMonthKpis
      netContribution={netContribution}
      monthBalanceCents={monthBalanceCents}
      month={month}
    />,
  );
  return screen.getByRole("region", { name: "KPIs del mes" });
}

function kpiCell(region: HTMLElement, label: string) {
  return within(within(region).getByText(label).closest("div") as HTMLElement);
}

describe("AccountMonthKpis", () => {
  it("con aportación configurada muestra el importe exacto sin subtexto", () => {
    const region = renderKpis({ configured: true, amountCents: 37945 }, -50000);

    expect(screen.getByRole("heading", { name: "KPIs del mes" })).toBeVisible();
    expect(within(region).getByText("Aportación común")).toBeVisible();
    expect(within(region).getByText(new RegExp(`^379,45${EUR}`))).toBeVisible();
    expect(within(region).queryByText("Sin aportación configurada")).not.toBeInTheDocument();
  });

  it("sin configuración muestra 0,00 € y el subtexto «Sin aportación configurada»", () => {
    const region = renderKpis({ configured: false, amountCents: 0 }, 0);

    const contribution = kpiCell(region, "Aportación común");
    expect(contribution.getByText(new RegExp(`^0,00${EUR}`))).toBeInTheDocument();
    expect(contribution.getByText("Sin aportación configurada")).toBeVisible();
  });

  it("neto cero con configuración muestra 0,00 € sin subtexto", () => {
    const region = renderKpis({ configured: true, amountCents: 0 }, 0);

    const contribution = kpiCell(region, "Aportación común");
    expect(contribution.getByText(new RegExp(`^0,00${EUR}`))).toBeInTheDocument();
    expect(contribution.queryByText("Sin aportación configurada")).not.toBeInTheDocument();
  });

  it("saldo negativo se pinta con signo U+2212 y clase text-red-600", () => {
    const region = renderKpis({ configured: true, amountCents: 37945 }, -5120);

    const balance = within(region).getByText(new RegExp(`^\u221251,20${EUR}`));
    expect(balance).toBeVisible();
    expect(balance.className).toContain("text-red-600");
    expect(within(region).getByText("Saldo del mes")).toBeVisible();
  });

  it("mes vacío muestra saldo 0,00 € sin color rojo", () => {
    const region = renderKpis({ configured: true, amountCents: 0 }, 0);

    const balance = kpiCell(region, "Saldo del mes").getByText(new RegExp(`^0,00${EUR}`));
    expect(balance.className).not.toContain("text-red-600");
  });

  it("muestra la etiqueta pasiva del mes consultado", () => {
    const region = renderKpis({ configured: true, amountCents: 50000 }, -50000, "2026-10");

    expect(within(region).getByText("Octubre de 2026")).toBeVisible();
  });

  it("región accesible con h2 y clases sticky + grid de 2 columnas", () => {
    const region = renderKpis({ configured: true, amountCents: 37945 }, -50000);

    expect(region.tagName).toBe("SECTION");
    expect(region.getAttribute("aria-labelledby")).toBe("account-month-kpis-title");
    expect(region.className).toContain("sticky");
    expect(region.className).toContain("top-0");
    expect(region.className).toContain("z-20");

    const dl = within(region).getByText("Aportación común").closest("dl");
    expect(dl).not.toBeNull();
    expect(dl?.className).toContain("grid-cols-2");
  });
});
