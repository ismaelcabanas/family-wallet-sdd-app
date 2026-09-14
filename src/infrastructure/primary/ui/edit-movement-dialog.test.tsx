import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/update-movement.action", () => ({
  updateMovement: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import type { MovementDTO } from "@/application/movement/dto";
import { EditMovementDialog } from "./edit-movement-dialog";

const accounts = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal" as const, memberName: "Miembro A" },
  { id: 3, name: "Cuenta común", type: "shared" as const, memberName: null },
];

const tags = [
  { id: 2, name: "Vivienda", slug: "vivienda" },
  { id: 3, name: "Hipoteca", slug: "hipoteca" },
];

const movement: MovementDTO = {
  id: 7,
  accountId: 1,
  type: "expense",
  date: "2026-09-14",
  concept: "Mercadona",
  description: "Compra semanal",
  amountCents: 8_500,
  nature: "personal",
  tags: [{ id: 2, name: "Vivienda", slug: "vivienda" }],
};

const onCloseMock = vi.fn();

function renderDialog() {
  return render(
    <EditMovementDialog
      movement={movement}
      accounts={accounts}
      tags={tags}
      currentAccountId={1}
      currentMonth="2026-09"
      onClose={onCloseMock}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EditMovementDialog", () => {
  it("abre con el formulario precargado con los datos del movimiento", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Editar movimiento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Concepto")).toHaveValue("Mercadona");
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("85,00");
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-14");
    expect(screen.getByLabelText("Vivienda")).toBeChecked();
  });

  it("cancelar cierra el diálogo sin llamar a la action", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("éxito cierra el diálogo y tuesta el mensaje de la action", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Movimiento actualizado",
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento actualizado");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("tuesta el aviso de movimiento movido compuesto por la action", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Movimiento actualizado: ahora está en Agosto 2026",
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Movimiento actualizado: ahora está en Agosto 2026",
      );
    });
  });

  it("error _form mantiene el diálogo abierto y muestra el error", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      errors: { _form: ["No se ha podido guardar el movimiento. Inténtalo de nuevo."] },
      values: {
        date: "2026-09-14",
        concept: "Mercadona",
        description: "",
        amount: "85,00",
        accountId: "1",
        type: "expense",
        nature: "personal",
        tagIds: ["2"],
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(
        screen.getByText("No se ha podido guardar el movimiento. Inténtalo de nuevo."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("el error de movimiento inexistente cierra el diálogo y tuesta el error", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      errors: { _form: ["El movimiento ya no existe."] },
      values: {
        date: "2026-09-14",
        concept: "Mercadona",
        description: "",
        amount: "85,00",
        accountId: "1",
        type: "expense",
        nature: "personal",
        tagIds: ["2"],
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("El movimiento ya no existe.");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("incluye los campos ocultos de contexto y el id del movimiento", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Movimiento actualizado" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("movementId")).toBe("7");
    expect(formData.get("currentAccountId")).toBe("1");
    expect(formData.get("currentMonth")).toBe("2026-09");
  });
});
