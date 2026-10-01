import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/create-movement.action", () => ({
  createMovement: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import { CreateMovementDialog } from "./create-movement-dialog";
import { todayIsoDate } from "./format";

const tags = [
  { id: 2, name: "Vivienda", slug: "vivienda" },
  { id: 3, name: "Hipoteca", slug: "hipoteca" },
];

const onCloseMock = vi.fn();

function renderDialog(
  overrides: Partial<Parameters<typeof CreateMovementDialog>[0]> = {},
) {
  return render(
    <CreateMovementDialog
      accountId={1}
      accountName="Cuenta de Miembro A"
      accountType="personal"
      tags={tags}
      onClose={onCloseMock}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreateMovementDialog", () => {
  it("abre con los defaults de alta: fecha hoy, Gasto y cuenta fijada como texto", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha")).toHaveValue(todayIsoDate());
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Personal" })).toBeChecked();
    expect(
      screen.getByText("Cuenta de Miembro A (se cambia con el selector superior)"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Cuenta" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeInTheDocument();
  });

  it("submit válido llama a la action con la cuenta fijada, cierra y tuesta «Movimiento guardado»", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Movimiento guardado" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento guardado");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("error de campo mantiene el diálogo abierto con alerts y valores conservados", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      errors: {
        amount: ["El importe es obligatorio."],
        concept: ["El concepto es obligatorio."],
      },
      values: {
        date: "2026-09-03",
        concept: "Hipoteca",
        description: "",
        amount: "850,00",
        accountId: "1",
        type: "expense",
        nature: "personal",
        tagIds: ["2"],
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(screen.getByText("El importe es obligatorio.")).toBeInTheDocument();
    });
    expect(screen.getByText("El concepto es obligatorio.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hipoteca")).toBeInTheDocument();
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("850,00");
    expect(screen.getByLabelText("Vivienda")).toBeChecked();
  });

  it("Cancelar cierra el diálogo sin llamar a la action", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("con Ingreso la Naturaleza queda oculta", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Compartido" })).not.toBeInTheDocument();
  });
});
