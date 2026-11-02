import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/delete-category.action", () => ({
  deleteCategory: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import type { CategoryDTO } from "@/application/tag-category/dto";
import { DeleteCategoryDialog } from "./delete-category-dialog";

const category: CategoryDTO = { id: 2, name: "Comida", isDefault: false };

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(overrides: Partial<CategoryDTO> = {}) {
  return render(<DeleteCategoryDialog category={{ ...category, ...overrides }} onClose={onCloseMock} />);
}

describe("DeleteCategoryDialog", () => {
  it("es un alertdialog con el texto de confirmación congelado", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog", { name: "Eliminar categoría" });
    expect(dialog).toHaveTextContent(
      'Se eliminará la categoría "Comida". Las etiquetas no se verán afectadas.',
    );
  });

  it("confirmar envía la action con el categoryId", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría eliminada" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("categoryId")).toBe("2");
  });

  it("categoría con etiquetas: muestra el mensaje de CategoryNotEmptyError y permanece abierto (esc. 7)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message:
        'La categoría "Comida" tiene etiquetas asignadas. Muévelas a otra categoría antes de eliminarla.',
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        'La categoría "Comida" tiene etiquetas asignadas. Muévelas a otra categoría antes de eliminarla.',
      );
    });
    expect(onCloseMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Eliminar categoría" })).toBeInTheDocument();
  });

  it("éxito tuesta «Categoría eliminada» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría eliminada" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Categoría eliminada");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("isPending deshabilita Eliminar y Cancelar (doble envío)", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    const pendingButton = screen.getByRole("button", { name: "Eliminando…" });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolveAction({ status: "success", message: "Categoría eliminada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Categoría eliminada");
    });
  });

  it("Cancelar cierra sin enviar", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });
});
