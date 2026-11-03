import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/create-tag-entry.action", () => ({
  createTagEntry: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import type { CategoryDTO } from "@/application/tag-category/dto";
import { CreateTagDialog } from "./create-tag-dialog";

const CATEGORIES: CategoryDTO[] = [
  { id: 1, name: "General", isDefault: true },
  { id: 2, name: "Alimentación", isDefault: false },
  { id: 3, name: "Viajes", isDefault: false },
];

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog() {
  return render(<CreateTagDialog categories={CATEGORIES} onClose={onCloseMock} />);
}

describe("CreateTagDialog (única vía de creación con inferencia)", () => {
  it("muestra el título, el foco inicial en «Nombre» y el Select «Categoría» sin selección", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Nueva etiqueta" });
    const input = within(dialog).getByLabelText("Nombre");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(within(dialog).getByRole("combobox", { name: "Categoría" })).toHaveTextContent(
      "Ninguna — se creará una categoría",
    );
  });

  it("el Select «Categoría» ofrece todas las categorías (genérica primero) y la opción sin padre", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Ninguna — se creará una categoría",
      "General",
      "Alimentación",
      "Viajes",
    ]);
  });

  it("submit sin padre envía el FormData con categoryId vacío", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría creada" });
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Suscripciones");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("name")).toBe("Suscripciones");
    expect(formData.get("categoryId")).toBe("");
  });

  it("submit con padre envía el categoryId seleccionado", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Etiqueta creada" });
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Mercadona");
    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(screen.getByRole("option", { name: "Alimentación" }));
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("name")).toBe("Mercadona");
    expect(formData.get("categoryId")).toBe("2");
  });

  it("en error muestra role=alert con aria-describedby y conserva el nombre y la categoría tecleados (esc. 3)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: 'Ya existe una etiqueta con el nombre "Mercadona".',
    });
    renderDialog();

    const input = screen.getByLabelText("Nombre");
    await user.type(input, "Mercadona");
    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(screen.getByRole("option", { name: "Alimentación" }));
    await user.click(screen.getByRole("button", { name: "Crear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Ya existe una etiqueta con el nombre "Mercadona".');
    expect(alert).toHaveAttribute("id");
    expect(input).toHaveAttribute("aria-describedby", alert.id);
    expect(input).toHaveValue("Mercadona");
    expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Alimentación");
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it("el éxito sin padre tuesta «Categoría creada» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Categoría creada" });
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Suscripciones");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Categoría creada");
    });
    expect(onCloseMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("el éxito con padre tuesta «Etiqueta creada» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Etiqueta creada" });
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Mercadona");
    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(screen.getByRole("option", { name: "Alimentación" }));
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta creada");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("isPending muestra «Creando…» y deshabilita «Cancelar» y «Crear» (doble envío)", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Mercadona");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(screen.getByRole("button", { name: "Creando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolveAction({ status: "success", message: "Etiqueta creada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta creada");
    });
  });

  it("Cancelar cierra sin enviar ni comprometer nada", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Nombre"), "Borrador");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });
});
