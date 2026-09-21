import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}));

import { MonthSelector } from "./month-selector";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MonthSelector", () => {
  it("renderiza la ventana de meses alrededor del activo con etiqueta 'Mes'", async () => {
    const user = userEvent.setup();
    render(<MonthSelector month="2026-09" />);

    expect(screen.getByRole("combobox", { name: "Mes visible" })).toHaveTextContent(
      /Septiembre de 2026/,
    );

    await user.click(screen.getByRole("combobox", { name: "Mes visible" }));

    expect(screen.getByRole("option", { name: "Septiembre de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agosto de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Octubre de 2026" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(49);
  });

  it("navega a /summary?month= al seleccionar otro mes", async () => {
    const user = userEvent.setup();
    render(<MonthSelector month="2026-09" />);

    await user.click(screen.getByRole("combobox", { name: "Mes visible" }));
    await user.click(screen.getByRole("option", { name: "Junio de 2026" }));

    expect(routerReplaceMock).toHaveBeenCalledExactlyOnceWith("/summary?month=2026-06");
  });

  it("mantiene el mes activo seleccionado", () => {
    render(<MonthSelector month="2026-06" />);

    expect(screen.getByRole("combobox", { name: "Mes visible" })).toHaveTextContent(
      /Junio de 2026/,
    );
  });
});
