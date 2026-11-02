import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/rename-category.action", () => ({
  renameCategory: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import type { CategoryDTO } from "@/application/tag-category/dto";
import { RenameCategoryDialog } from "./rename-category-dialog";

const category: CategoryDTO = { id: 2, name: "Viajes", isDefault: false };

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(overrides: Partial<CategoryDTO> = {}) {
  return render(<RenameCategoryDialog category={{ ...category, ...overrides }} onClose={onCloseMock} />);
}

describe("RenameCategoryDialog", () => {
  it("muestra el título y el input pre-rellenado con el nombre actual", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Renombrar categoría" });
    const input = within(dialog).getByLabelText("Nombre");
    expect(input).toHaveValue("Viajes");
    expect(input).toHaveFocus();
  });

  it("guardar envía la action con el FormData correcto (incluye categoryId)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría renombrada" });
    renderDialog();

    const input = screen.getByLabelText("Nombre");
    await user.clear(input);
    await user.type(input, "Comida");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("categoryId")).toBe("2");
    expect(formData.get("name")).toBe("Comida");
  });

  it("en error (duplicado) muestra role=alert y conserva el valor tecleado", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: 'Ya existe una categoría con el nombre "Comida".',
    });
    renderDialog();

    const input = screen.getByLabelText("Nombre");
    await user.clear(input);
    await user.type(input, "Comida");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Ya existe una categoría con el nombre "Comida".');
    expect(screen.getByLabelText("Nombre")).toHaveValue("Comida");
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it("éxito tuesta «Categoría renombrada» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría renombrada" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Categoría renombrada");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("isPending deshabilita Guardar y Cancelar (doble envío)", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const pendingButton = screen.getByRole("button", { name: "Guardando…" });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolveAction({ status: "success", message: "Categoría renombrada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Categoría renombrada");
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
