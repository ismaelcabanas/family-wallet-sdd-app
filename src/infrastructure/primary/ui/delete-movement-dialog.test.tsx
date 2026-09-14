import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/delete-movement.action", () => ({
  deleteMovement: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import type { MovementDTO } from "@/application/movement/dto";
import { formatDate } from "./format";
import { DeleteMovementDialog } from "./delete-movement-dialog";

const movement: MovementDTO = {
  id: 7,
  accountId: 1,
  type: "expense",
  date: "2026-09-14",
  concept: "Mercadona",
  description: null,
  amountCents: 8_500,
  nature: "personal",
  tags: [{ id: 2, name: "Vivienda", slug: "vivienda" }],
};

const onCloseMock = vi.fn();

function renderDialog(overrides: Partial<MovementDTO> = {}) {
  return render(
    <DeleteMovementDialog movement={{ ...movement, ...overrides }} onClose={onCloseMock} />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DeleteMovementDialog", () => {
  it("muestra concepto, importe con signo y fecha larga del movimiento", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog", { name: "Eliminar movimiento" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Mercadona")).toBeInTheDocument();
    expect(within(dialog).getByText(/−85,00[\s\u00A0]€/u)).toBeInTheDocument();
    expect(within(dialog).getByText(formatDate("2026-09-14"))).toBeInTheDocument();
  });

  it("cancelar cierra sin llamar a la action", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("eliminar invoca deleteMovement con el id y tuesta el éxito", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Movimiento eliminado" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento eliminado");
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("movementId")).toBe("7");
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("muestra 'Eliminando…' y queda deshabilitado mientras la action está pendiente", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Eliminar$/ }));

    const pendingButton = screen.getByRole("button", { name: "Eliminando…" });
    expect(pendingButton).toBeDisabled();

    resolveAction({ status: "success", message: "Movimiento eliminado" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento eliminado");
    });
  });

  it("tuesta el error de movimiento inexistente", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: "El movimiento ya no existe.",
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("El movimiento ya no existe.");
    });
  });
});
