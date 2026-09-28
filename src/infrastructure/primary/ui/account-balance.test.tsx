import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccountBalance } from "./account-balance";

afterEach(() => {
  cleanup();
});

describe("AccountBalance", () => {
  it("muestra el subtítulo por defecto cuando no llega la prop", () => {
    render(<AccountBalance accountName="Cuenta común" balanceCents={1_920_00} />);

    expect(
      screen.getByText("Histórico completo de la cuenta (ingresos − gastos)"),
    ).toBeInTheDocument();
  });

  it("muestra el subtítulo recibido por prop (acumulado a mes)", () => {
    render(
      <AccountBalance
        accountName="Cuenta común"
        balanceCents={1_920_00}
        subtitle="Acumulado hasta Abril de 2026"
      />,
    );

    expect(screen.getByText("Acumulado hasta Abril de 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("Histórico completo de la cuenta (ingresos − gastos)"),
    ).not.toBeInTheDocument();
  });

  it("pinta el balance negativo en rojo", () => {
    render(<AccountBalance accountName="Cuenta común" balanceCents={-850_00} />);

    const balance = screen.getByText(/-850,00/);
    expect(balance).toBeInTheDocument();
    expect(balance.className).toContain("text-red-600");
  });

  it("pinta el balance no negativo con el color de primer plano", () => {
    render(<AccountBalance accountName="Cuenta común" balanceCents={0} />);

    const balance = screen.getByText(/0,00/);
    expect(balance.className).not.toContain("text-red-600");
  });
});
