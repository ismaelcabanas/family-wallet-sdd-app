import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}));

vi.setSystemTime(new Date(2026, 8, 28));

import { MonthStepper } from "./month-stepper";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MonthStepper", () => {
  it("‹ navega al mes anterior de la misma cuenta (cruce de año incluido)", async () => {
    const user = userEvent.setup();
    render(<MonthStepper accountId={2} month="2026-01" />);

    await user.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(routerReplaceMock).toHaveBeenCalledExactlyOnceWith("/accounts/2?month=2025-12");
  });

  it("› está deshabilitado en el mes actual real", () => {
    render(<MonthStepper accountId={2} month="2026-09" />);

    expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
  });

  it("› está deshabilitado en un mes futuro alcanzado por URL directa", () => {
    render(<MonthStepper accountId={2} month="2027-03" />);

    expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
  });

  it("› activo navega al mes siguiente de la misma cuenta", async () => {
    const user = userEvent.setup();
    render(<MonthStepper accountId={2} month="2026-04" />);

    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));

    expect(routerReplaceMock).toHaveBeenCalledExactlyOnceWith("/accounts/2?month=2026-05");
  });

  it("‹ navega al mes anterior dentro del mismo año", async () => {
    const user = userEvent.setup();
    render(<MonthStepper accountId={2} month="2026-04" />);

    await user.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(routerReplaceMock).toHaveBeenCalledExactlyOnceWith("/accounts/2?month=2026-03");
  });

  it("el picker ofrece meses alrededor del activo sin meses futuros", async () => {
    const user = userEvent.setup();
    render(<MonthStepper accountId={2} month="2026-09" />);

    await user.click(screen.getByRole("combobox", { name: "Mes visible" }));

    expect(screen.getByRole("option", { name: "Septiembre de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agosto de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Enero de 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Octubre de 2026" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Diciembre de 2026" })).not.toBeInTheDocument();
  });

  it("el picker salta al mes elegido manteniendo la cuenta", async () => {
    const user = userEvent.setup();
    render(<MonthStepper accountId={2} month="2026-04" />);

    await user.click(screen.getByRole("combobox", { name: "Mes visible" }));
    await user.click(screen.getByRole("option", { name: "Marzo de 2026" }));

    expect(routerReplaceMock).toHaveBeenCalledExactlyOnceWith("/accounts/2?month=2026-03");
  });

  it("la cuenta nunca cambia: la URL siempre lleva el accountId de las props", async () => {
    const user = userEvent.setup();
    render(<MonthStepper accountId={5} month="2026-04" />);

    await user.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(routerReplaceMock.mock.calls[0][0]).toMatch(/^\/accounts\/5\?month=\d{4}-\d{2}$/);
  });
});
