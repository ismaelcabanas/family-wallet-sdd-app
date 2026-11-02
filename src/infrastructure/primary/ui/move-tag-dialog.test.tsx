import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/move-tag-to-category.action", () => ({
  moveTagToCategory: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import type { CategoryDTO } from "@/application/tag-category/dto";
import type { CatalogTagDTO } from "@/application/tag/dto";
import { MoveTagDialog } from "./move-tag-dialog";

const tag: CatalogTagDTO = {
  id: 5,
  name: "Supermercado",
  slug: "supermercado",
  status: "active",
  isProtected: false,
};

const categories: CategoryDTO[] = [
  { id: 1, name: "General", isDefault: true },
  { id: 2, name: "Alimentación", isDefault: false },
  { id: 3, name: "Viajes", isDefault: false },
];

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(currentCategoryId = 1) {
  return render(
    <MoveTagDialog
      tag={tag}
      categories={categories}
      currentCategoryId={currentCategoryId}
      onClose={onCloseMock}
    />,
  );
}

describe("MoveTagDialog", () => {
  it("muestra el título, el texto con la etiqueta y el Select con foco inicial", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Mover etiqueta" });
    expect(dialog).toHaveTextContent('"Supermercado" pasará a la categoría que elijas.');
    const trigger = within(dialog).getByRole("combobox", { name: "Categoría" });
    expect(trigger).toHaveFocus();
  });

  it("el Select ofrece todas las categorías excepto la actual", async () => {
    const user = userEvent.setup();
    renderDialog(1);

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Alimentación", "Viajes"]);
  });

  it("«Mover» está deshabilitado sin selección", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Mover" })).toBeDisabled();
  });

  it("mover envía la action con tagId y categoryId del Select", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Etiqueta movida a Alimentación",
    });
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(screen.getByRole("option", { name: "Alimentación" }));
    await user.click(screen.getByRole("button", { name: "Mover" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("tagId")).toBe("5");
    expect(formData.get("categoryId")).toBe("2");
  });

  it("en error muestra role=alert y permanece abierto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: "La categoría seleccionada ya no está disponible.",
    });
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(screen.getByRole("option", { name: "Alimentación" }));
    await user.click(screen.getByRole("button", { name: "Mover" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La categoría seleccionada ya no está disponible.",
      );
    });
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it("éxito tuesta el mensaje de la action y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Etiqueta movida a Alimentación",
    });
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(screen.getByRole("option", { name: "Alimentación" }));
    await user.click(screen.getByRole("button", { name: "Mover" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta movida a Alimentación");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("isPending deshabilita Mover y Cancelar (doble envío)", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(screen.getByRole("option", { name: "Alimentación" }));
    await user.click(screen.getByRole("button", { name: "Mover" }));

    const pendingButton = screen.getByRole("button", { name: "Moviendo…" });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolveAction({ status: "success", message: "Etiqueta movida a Alimentación" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta movida a Alimentación");
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
