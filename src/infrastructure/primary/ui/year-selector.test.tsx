import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}));

import { YearSelector } from "./year-selector";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("YearSelector", () => {
  it("renderiza la ventana de 13 años alrededor del activo con etiqueta 'Año'", async () => {
    const user = userEvent.setup();
    render(<YearSelector year="2027" />);

    expect(screen.getByRole("combobox", { name: "Año visible" })).toHaveTextContent("2027");

    await user.click(screen.getByRole("combobox", { name: "Año visible" }));

    expect(screen.getAllByRole("option")).toHaveLength(13);
    expect(screen.getByRole("option", { name: "2021" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2027" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2033" })).toBeInTheDocument();
  });

  it("navega a /annual?year= al seleccionar otro año", async () => {
    const user = userEvent.setup();
    render(<YearSelector year="2027" />);

    await user.click(screen.getByRole("combobox", { name: "Año visible" }));
    await user.click(screen.getByRole("option", { name: "2026" }));

    expect(routerReplaceMock).toHaveBeenCalledExactlyOnceWith("/annual?year=2026");
  });

  it("mantiene el año activo seleccionado", () => {
    render(<YearSelector year="2026" />);

    expect(screen.getByRole("combobox", { name: "Año visible" })).toHaveTextContent("2026");
  });
});
