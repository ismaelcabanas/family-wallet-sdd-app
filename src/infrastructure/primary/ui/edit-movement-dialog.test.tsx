import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock, createTagMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  createTagMock: vi.fn(),
}));

vi.mock("../actions/update-movement.action", () => ({
  updateMovement: actionMock,
}));

vi.mock("../actions/create-tag.action", () => ({
  createTag: createTagMock,
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

const tags = [
  { id: 2, name: "Vivienda", slug: "vivienda" },
  { id: 3, name: "Hipoteca", slug: "hipoteca" },
];

const movement: MovementDTO = {
  id: 7,
  accountId: 1,
  type: "expense",
  date: "2026-09-14",
  note: "Mercadona",
  amountCents: 8_500,
  nature: "personal",
  tag: { id: 2, name: "Vivienda", slug: "vivienda" },
};

const onCloseMock = vi.fn();

function renderDialog() {
  return render(
    <EditMovementDialog
      movement={movement}
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
  it("abre con el formulario precargado con nota y tag única del movimiento", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Editar movimiento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nota")).toHaveValue("Mercadona");
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("85,00");
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-14");
    expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent("Vivienda");
  });

  it("no muestra selector de cuenta", () => {
    renderDialog();

    expect(screen.queryByRole("combobox", { name: "Cuenta" })).not.toBeInTheDocument();
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

  it("éxito cierra el diálogo y tuesta el mensaje de la action (FR-006)", async () => {
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

  it("tuesta el aviso de mes movido compuesto por la action", async () => {
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
        note: "Mercadona",
        amount: "85,00",
        accountId: "",
        type: "expense",
        nature: "personal",
        tagId: "2",
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
        note: "Mercadona",
        amount: "85,00",
        accountId: "",
        type: "expense",
        nature: "personal",
        tagId: "2",
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

  it("crear etiqueta inline en edición la deja seleccionada y «Guardar cambios» envía su tagId y cierra", async () => {
    const user = userEvent.setup();
    createTagMock.mockResolvedValueOnce({
      ok: true,
      tag: { id: 15, name: "Regalos gato", slug: "regalos-gato" },
    });
    actionMock.mockResolvedValueOnce({ status: "success", message: "Movimiento actualizado" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "Regalos gato");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent(
        "Regalos gato",
      );
    });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("tagId")).toBe("15");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento actualizado");
    });
  });
});
