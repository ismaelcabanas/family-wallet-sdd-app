import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/configure-savings-allocation.action", () => ({
  configureSavingsAllocation: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import type { SavingsAllocationDTO } from "@/application/savings/dto";
import { useState } from "react";
import { SavingsConfigDialog } from "./savings-config-dialog";

const activeConfig: SavingsAllocationDTO = {
  accountId: 1,
  percentage: 10,
  active: true,
  activatedAtMonth: "2026-08",
};

const inactiveConfig: SavingsAllocationDTO = { ...activeConfig, active: false };

function DialogHost({
  config,
  onClose,
}: {
  config: SavingsAllocationDTO | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <SavingsConfigDialog
      accountId={1}
      memberName="Miembro B"
      config={config}
      onClose={() => {
        setOpen(false);
        onClose?.();
      }}
    />
  );
}

function renderDialog(config: SavingsAllocationDTO | null = activeConfig, onClose?: () => void) {
  return render(<DialogHost config={config} onClose={onClose} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SavingsConfigDialog", () => {
  it("sin config: abre vacío con placeholder 10, sin «Desactivar»", () => {
    renderDialog(null);

    const dialog = screen.getByRole("dialog", { name: "Ahorro mensual" });
    const input = within(dialog).getByLabelText("Porcentaje (%)");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "10");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(within(dialog).queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
  });

  it("con config: abre pre-rellenado con el entero («10»)", () => {
    renderDialog(activeConfig);

    expect(
      within(screen.getByRole("dialog", { name: "Ahorro mensual" })).getByLabelText(
        "Porcentaje (%)",
      ),
    ).toHaveValue("10");
  });

  it("con config activa muestra «Desactivar»; con inactiva no", () => {
    renderDialog(activeConfig);
    expect(
      within(screen.getByRole("dialog", { name: "Ahorro mensual" })).getByRole("button", {
        name: "Desactivar",
      }),
    ).toBeInTheDocument();

    cleanup();
    renderDialog(inactiveConfig);
    expect(
      within(screen.getByRole("dialog", { name: "Ahorro mensual" })).queryByRole("button", {
        name: "Desactivar",
      }),
    ).not.toBeInTheDocument();
  });

  it("abre con el foco en «Porcentaje (%)»", async () => {
    renderDialog(null);

    await waitFor(() => {
      expect(screen.getByLabelText("Porcentaje (%)")).toHaveFocus();
    });
  });

  it("guardar con éxito tuesta «Ahorro guardado», cierra y envía intent save", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Ahorro guardado" });
    renderDialog(null, onClose);

    const dialog = screen.getByRole("dialog", { name: "Ahorro mensual" });
    await user.type(within(dialog).getByLabelText("Porcentaje (%)"), "10");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ahorro guardado");
    });
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    expect(formData.get("percentage")).toBe("10");
    expect(formData.get("intent")).toBe("save");
  });

  it("errores por campo con role=alert, valor conservado y diálogo abierto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      errors: {
        percentage: ["Introduce un porcentaje entero entre 1 y 100 (ej. 10)."],
        _form: ["Configura primero el ingreso regular de este miembro."],
      },
      values: { percentage: "12,5" },
    });
    renderDialog(null);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const dialog = screen.getByRole("dialog", { name: "Ahorro mensual" });
    expect(
      within(dialog).getAllByRole("alert").map((node) => node.textContent),
    ).toEqual([
      "Introduce un porcentaje entero entre 1 y 100 (ej. 10).",
      "Configura primero el ingreso regular de este miembro.",
    ]);
    expect(within(dialog).getByLabelText("Porcentaje (%)")).toHaveValue("12,5");
  });

  it("durante el envío los controles se deshabilitan y «Guardar» muestra «Guardando…»", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog(activeConfig);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const dialog = screen.getByRole("dialog", { name: "Ahorro mensual" });
    const pendingButtons = within(dialog).getAllByRole("button", { name: "Guardando…" });
    expect(pendingButtons).toHaveLength(2);
    for (const button of pendingButtons) {
      expect(button).toBeDisabled();
    }
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(within(dialog).getByLabelText("Porcentaje (%)")).toBeDisabled();

    resolveAction({ status: "success", message: "Ahorro guardado" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ahorro guardado");
    });
  });

  it("el «Desactivar» del diálogo tuesta «Ahorro desactivado» y viaja con intent deactivate", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Ahorro desactivado",
    });
    renderDialog(activeConfig);

    const dialog = screen.getByRole("dialog", { name: "Ahorro mensual" });
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ahorro desactivado");
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    expect(formData.get("intent")).toBe("deactivate");
  });

  it("«Cancelar» cierra el diálogo sin llamar a la action", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(null, onClose);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("sin preview de importe: no muestra ningún texto en €", () => {
    renderDialog(activeConfig);

    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });
});
