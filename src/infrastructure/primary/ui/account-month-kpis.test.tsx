import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccountMonthKpis } from "./account-month-kpis";

afterEach(cleanup);

const EUR = "[\\s\\u00A0\\u202F]€$";

interface RenderKpisInput {
  netContribution: { configured: boolean; amountCents: number };
  savings: { configured: boolean; amountCents: number };
  netMonthBalanceCents: number;
  month?: string;
}

function renderKpis({
  netContribution,
  savings,
  netMonthBalanceCents,
  month = "2026-10",
}: RenderKpisInput) {
  render(
    <AccountMonthKpis
      netContribution={netContribution}
      savings={savings}
      netMonthBalanceCents={netMonthBalanceCents}
      month={month}
    />,
  );
  return screen.getByRole("region", { name: "KPIs del mes" });
}

function kpiCell(region: HTMLElement, label: string) {
  return within(within(region).getByText(label).closest("div") as HTMLElement);
}

function kpiOrder(region: HTMLElement) {
  const dl = within(region).getByText("Aportación común").closest("dl") as HTMLElement;
  return within(dl)
    .getAllByRole("definition")
    .map((dd) => dd.previousElementSibling?.textContent);
}

describe("AccountMonthKpis", () => {
  it("muestra las 3 métricas en el orden congelado: Aportación común · Ahorro del mes · Saldo del mes", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 37945 },
      savings: { configured: true, amountCents: 30000 },
      netMonthBalanceCents: -42055,
    });

    expect(kpiOrder(region)).toEqual(["Aportación común", "Ahorro del mes", "Saldo del mes"]);
  });

  it("con aportación configurada muestra el importe exacto sin subtexto", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 37945 },
      savings: { configured: true, amountCents: 30000 },
      netMonthBalanceCents: -42055,
    });

    expect(screen.getByRole("heading", { name: "KPIs del mes" })).toBeVisible();
    expect(within(region).getByText("Aportación común")).toBeVisible();
    expect(within(region).getByText(new RegExp(`^379,45${EUR}`))).toBeVisible();
    expect(within(region).queryByText("Sin aportación configurada")).not.toBeInTheDocument();
  });

  it("sin aportación configurada muestra 0,00 € y el subtexto «Sin aportación configurada»", () => {
    const region = renderKpis({
      netContribution: { configured: false, amountCents: 0 },
      savings: { configured: false, amountCents: 0 },
      netMonthBalanceCents: 0,
    });

    const contribution = kpiCell(region, "Aportación común");
    expect(contribution.getByText(new RegExp(`^0,00${EUR}`))).toBeInTheDocument();
    expect(contribution.getByText("Sin aportación configurada")).toBeVisible();
  });

  it("sin ahorro configurado: 0,00 € con subtexto «Sin ahorro configurado» y saldo neto = bruto", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 37945 },
      savings: { configured: false, amountCents: 0 },
      netMonthBalanceCents: -50_000,
    });

    const savings = kpiCell(region, "Ahorro del mes");
    expect(savings.getByText(new RegExp(`^0,00${EUR}`))).toBeInTheDocument();
    expect(savings.getByText("Sin ahorro configurado")).toBeVisible();

    const balance = kpiCell(region, "Saldo del mes");
    expect(balance.getByText(new RegExp(`^\u2212500,00${EUR}`))).toBeVisible();
  });

  it("con ahorro configurado: importe formateado sin subtexto y neto = bruto − ahorro", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 37945 },
      savings: { configured: true, amountCents: 30000 },
      netMonthBalanceCents: -80_055,
    });

    const savings = kpiCell(region, "Ahorro del mes");
    expect(savings.getByText(new RegExp(`^300,00${EUR}`))).toBeVisible();
    expect(savings.queryByText("Sin ahorro configurado")).not.toBeInTheDocument();

    const balance = kpiCell(region, "Saldo del mes");
    expect(balance.getByText(new RegExp(`^\u2212800,55${EUR}`))).toBeVisible();
  });

  it("ahorro configurado sin deducción en el mes: 0,00 € sin subtexto", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 0 },
      savings: { configured: true, amountCents: 0 },
      netMonthBalanceCents: 0,
    });

    const savings = kpiCell(region, "Ahorro del mes");
    expect(savings.getByText(new RegExp(`^0,00${EUR}`))).toBeInTheDocument();
    expect(savings.queryByText("Sin ahorro configurado")).not.toBeInTheDocument();
  });

  it("saldo neto negativo se pinta con signo U+2212 y clase text-red-600", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 37945 },
      savings: { configured: true, amountCents: 0 },
      netMonthBalanceCents: -5120,
    });

    const balance = within(region).getByText(new RegExp(`^\u221251,20${EUR}`));
    expect(balance).toBeVisible();
    expect(balance.className).toContain("text-red-600");
    expect(within(region).getByText("Saldo del mes")).toBeVisible();
  });

  it("saldo neto cero muestra 0,00 € sin color rojo", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 0 },
      savings: { configured: false, amountCents: 0 },
      netMonthBalanceCents: 0,
    });

    const balance = kpiCell(region, "Saldo del mes").getByText(new RegExp(`^0,00${EUR}`));
    expect(balance.className).not.toContain("text-red-600");
  });

  it("muestra la etiqueta pasiva del mes consultado", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 50000 },
      savings: { configured: true, amountCents: 30000 },
      netMonthBalanceCents: -50_000,
      month: "2026-10",
    });

    expect(within(region).getByText("Octubre de 2026")).toBeVisible();
  });

  it("región accesible con h2 y clases sticky + grid de 3 columnas", () => {
    const region = renderKpis({
      netContribution: { configured: true, amountCents: 37945 },
      savings: { configured: true, amountCents: 30000 },
      netMonthBalanceCents: -42055,
    });

    expect(region.tagName).toBe("SECTION");
    expect(region.getAttribute("aria-labelledby")).toBe("account-month-kpis-title");
    expect(region.className).toContain("sticky");
    expect(region.className).toContain("top-0");
    expect(region.className).toContain("z-20");

    const dl = within(region).getByText("Aportación común").closest("dl");
    expect(dl).not.toBeNull();
    expect(dl?.className).toContain("grid-cols-3");
  });
});
