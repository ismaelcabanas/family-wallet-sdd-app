import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/create-category.action", () => ({
  createCategory: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import { CreateCategoryDialog } from "./create-category-dialog";

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog() {
  return render(<CreateCategoryDialog onClose={onCloseMock} />);
}

describe("CreateCategoryDialog", () => {
  it("muestra el título y el foco inicial en el campo vacío", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Nueva categoría" });
    const input = within(dialog).getByLabelText("Nombre");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("crear envía la action con el FormData correcto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría creada" });
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Alimentación");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("name")).toBe("Alimentación");
  });

  it("en error (duplicado) muestra role=alert y conserva el valor tecleado (esc. 3)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: 'Ya existe una categoría con el nombre "Alimentación".',
    });
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "alimentación");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Ya existe una categoría con el nombre "Alimentación".');
    expect(screen.getByLabelText("Nombre")).toHaveValue("alimentación");
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it("el error de nombre vacío muestra el mensaje congelado", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: "El nombre de la categoría es obligatorio.",
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Crear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El nombre de la categoría es obligatorio.");
  });

  it("éxito tuesta «Categoría creada» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría creada" });
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Viajes");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Categoría creada");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("isPending muestra «Creando…» y deshabilita el submit (doble envío)", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Viajes");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    const pendingButton = screen.getByRole("button", { name: "Creando…" });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolveAction({ status: "success", message: "Categoría creada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Categoría creada");
    });
  });

  it("Cancelar cierra sin enviar", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });
});
