import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/configure-regular-income.action", () => ({
  configureRegularIncome: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import type { RegularIncomeDTO } from "@/application/regular-income/dto";
import { RegularIncomePanel } from "./regular-income-panel";

const activeConfig: RegularIncomeDTO = {
  accountId: 1,
  amountCents: 200_000,
  dayOfMonth: 1,
  note: "Ingreso regular de Miembro A",
  active: true,
  activatedAtMonth: "2026-08",
};

const inactiveConfig: RegularIncomeDTO = { ...activeConfig, active: false };

function renderPanel(config: RegularIncomeDTO | null = activeConfig) {
  return render(<RegularIncomePanel accountId={1} memberName="Miembro A" config={config} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegularIncomePanel", () => {
  it("sin config: muestra la descripción y el CTA «Configurar ingreso»", () => {
    renderPanel(null);

    expect(
      screen.getByText(
        "Configura tu ingreso mensual habitual y aparecerá cada mes sin registrarlo a mano.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurar ingreso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar ingreso" })).not.toBeInTheDocument();
  });

  it("config activa: resumen con importe y día, nota, estado «Activa» y botones", () => {
    renderPanel(activeConfig);

    const panel = screen.getByTestId("regular-income-panel");
    expect(within(panel).getByText(/2000,00[\s\u00A0]€ el día 1 de cada mes/u)).toBeInTheDocument();
    expect(within(panel).getByText(/Nota: Ingreso regular de Miembro A/)).toBeInTheDocument();
    expect(within(panel).getByText("Activa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar ingreso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  });

  it("config inactiva: «Ingreso regular desactivado.» con Editar y sin Desactivar", () => {
    renderPanel(inactiveConfig);

    expect(screen.getByText("Ingreso regular desactivado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar ingreso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
  });

  it("el CTA abre el diálogo vacío con día 1 y placeholder de nota por miembro", async () => {
    const user = userEvent.setup();
    renderPanel(null);

    await user.click(screen.getByRole("button", { name: "Configurar ingreso" }));

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    expect(within(dialog).getByLabelText("Importe (€)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Día del mes")).toHaveValue("1");
    expect(within(dialog).getByLabelText("Nota")).toHaveValue("");
    expect(within(dialog).getByLabelText("Nota")).toHaveAttribute(
      "placeholder",
      "Ingreso regular de Miembro A",
    );
    expect(within(dialog).queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
  });

  it("«Editar ingreso» abre el diálogo precargado con la config", async () => {
    const user = userEvent.setup();
    renderPanel({ ...activeConfig, dayOfMonth: 5, note: "Nómina" });

    await user.click(screen.getByRole("button", { name: "Editar ingreso" }));

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    expect(within(dialog).getByLabelText("Importe (€)")).toHaveValue("2000,00");
    expect(within(dialog).getByLabelText("Día del mes")).toHaveValue("5");
    expect(within(dialog).getByLabelText("Nota")).toHaveValue("Nómina");
    expect(within(dialog).getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  });

  it("el diálogo abre con el foco en «Importe (€)»", async () => {
    const user = userEvent.setup();
    renderPanel(null);

    await user.click(screen.getByRole("button", { name: "Configurar ingreso" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Importe (€)")).toHaveFocus();
    });
  });

  it("guardar con éxito tuesta «Ingreso regular guardado», cierra y envía intent save", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Ingreso regular guardado" });
    renderPanel(null);

    await user.click(screen.getByRole("button", { name: "Configurar ingreso" }));
    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    await user.type(within(dialog).getByLabelText("Importe (€)"), "2000,00");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ingreso regular guardado");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    expect(formData.get("amount")).toBe("2000,00");
    expect(formData.get("dayOfMonth")).toBe("1");
    expect(formData.get("note")).toBe("");
    expect(formData.get("intent")).toBe("save");
  });

  it("errores por campo con role=alert, valores conservados y diálogo abierto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      errors: { amount: ["El importe es obligatorio."], dayOfMonth: ["El día del mes debe estar entre 1 y 31."] },
      values: { amount: "", dayOfMonth: "40", note: "Nómina" },
    });
    renderPanel(null);

    await user.click(screen.getByRole("button", { name: "Configurar ingreso" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    expect(
      within(dialog).getAllByRole("alert").map((node) => node.textContent),
    ).toEqual(["El importe es obligatorio.", "El día del mes debe estar entre 1 y 31."]);
    expect(within(dialog).getByLabelText("Importe (€)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Día del mes")).toHaveValue("40");
    expect(within(dialog).getByLabelText("Nota")).toHaveValue("Nómina");
  });

  it("durante el envío los controles se deshabilitan y «Guardar» muestra «Guardando…»", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderPanel(null);

    await user.click(screen.getByRole("button", { name: "Configurar ingreso" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    expect(within(dialog).getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(within(dialog).getByLabelText("Importe (€)")).toBeDisabled();

    resolveAction({ status: "success", message: "Ingreso regular guardado" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ingreso regular guardado");
    });
  });

  it("«Desactivar» del panel actúa sin abrir el diálogo y tuesta al terminar", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Ingreso regular desactivado",
    });
    renderPanel(activeConfig);

    await user.click(screen.getByRole("button", { name: "Desactivar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ingreso regular desactivado");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    expect(formData.get("intent")).toBe("deactivate");
  });

  it("el «Desactivar» del diálogo viaja con intent deactivate", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Ingreso regular desactivado",
    });
    renderPanel(activeConfig);

    await user.click(screen.getByRole("button", { name: "Editar ingreso" }));
    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ingreso regular desactivado");
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("intent")).toBe("deactivate");
  });

  it("«Cancelar» cierra el diálogo sin llamar a la action", async () => {
    const user = userEvent.setup();
    renderPanel(null);

    await user.click(screen.getByRole("button", { name: "Configurar ingreso" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(actionMock).not.toHaveBeenCalled();
  });
});
