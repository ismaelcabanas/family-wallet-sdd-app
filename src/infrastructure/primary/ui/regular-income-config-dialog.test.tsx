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
import { useState } from "react";
import { RegularIncomeConfigDialog } from "./regular-income-config-dialog";

const activeConfig: RegularIncomeDTO = {
  accountId: 1,
  amountCents: 200_000,
  dayOfMonth: 1,
  note: "Ingreso regular de Miembro A",
  active: true,
  activatedAtMonth: "2026-08",
};

const inactiveConfig: RegularIncomeDTO = { ...activeConfig, active: false };

function DialogHost({
  config,
  onClose,
}: {
  config: RegularIncomeDTO | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <RegularIncomeConfigDialog
      accountId={1}
      memberName="Miembro A"
      config={config}
      onClose={() => {
        setOpen(false);
        onClose?.();
      }}
    />
  );
}

function renderDialog(config: RegularIncomeDTO | null = activeConfig, onClose?: () => void) {
  return render(<DialogHost config={config} onClose={onClose} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegularIncomeConfigDialog", () => {
  it("sin config: abre vacío con día 1 y placeholder de nota por miembro, sin «Desactivar»", () => {
    renderDialog(null);

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

  it("con config activa: abre precargado con los valores y botón «Desactivar»", () => {
    renderDialog({ ...activeConfig, dayOfMonth: 5, note: "Nómina" });

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    expect(within(dialog).getByLabelText("Importe (€)")).toHaveValue("2000,00");
    expect(within(dialog).getByLabelText("Día del mes")).toHaveValue("5");
    expect(within(dialog).getByLabelText("Nota")).toHaveValue("Nómina");
    expect(within(dialog).getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  });

  it("con config inactiva: abre precargado sin botón «Desactivar» (reactivar editando y guardando)", () => {
    renderDialog(inactiveConfig);

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    expect(within(dialog).getByLabelText("Importe (€)")).toHaveValue("2000,00");
    expect(within(dialog).getByLabelText("Día del mes")).toHaveValue("1");
    expect(within(dialog).getByLabelText("Nota")).toHaveValue("Ingreso regular de Miembro A");
    expect(within(dialog).queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
  });

  it("abre con el foco en «Importe (€)»", async () => {
    renderDialog(null);

    await waitFor(() => {
      expect(screen.getByLabelText("Importe (€)")).toHaveFocus();
    });
  });

  it("guardar con éxito tuesta «Ingreso regular guardado», cierra y envía intent save", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Ingreso regular guardado" });
    renderDialog(null, onClose);

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    await user.type(within(dialog).getByLabelText("Importe (€)"), "2000,00");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ingreso regular guardado");
    });
    expect(onClose).toHaveBeenCalled();
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
    renderDialog(null);

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
    renderDialog(null);

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

  it("el «Desactivar» del diálogo viaja con intent deactivate", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Ingreso regular desactivado",
    });
    renderDialog(activeConfig);

    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Ingreso regular desactivado");
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
});
