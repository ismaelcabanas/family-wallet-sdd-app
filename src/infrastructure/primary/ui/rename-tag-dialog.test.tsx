import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/rename-tag.action", () => ({
  renameTag: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import type { CatalogTagDTO } from "@/application/tag/dto";
import { RenameTagDialog } from "./rename-tag-dialog";

const tag: CatalogTagDTO = {
  id: 1,
  name: "super",
  slug: "super",
  status: "active",
  isProtected: false,
};

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(overrides: Partial<CatalogTagDTO> = {}) {
  return render(<RenameTagDialog tag={{ ...tag, ...overrides }} onClose={onCloseMock} />);
}

describe("RenameTagDialog", () => {
  it("muestra el título, el input pre-rellenado y el foco inicial en el campo", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Renombrar etiqueta" });
    const input = within(dialog).getByLabelText("Nombre");
    expect(input).toHaveValue("super");
    expect(input).toHaveFocus();
  });

  it("guardar envía la action con el FormData correcto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Etiqueta renombrada" });
    renderDialog();

    const input = screen.getByLabelText("Nombre");
    await user.clear(input);
    await user.type(input, "supermercado");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("tagId")).toBe("1");
    expect(formData.get("name")).toBe("supermercado");
  });

  it("en error muestra el mensaje con role=alert y conserva el nombre tecleado (SC-004)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: 'Ya existe una etiqueta con el nombre "Ocio".',
    });
    renderDialog();

    const input = screen.getByLabelText("Nombre");
    await user.clear(input);
    await user.type(input, "Ocio");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Ya existe una etiqueta con el nombre "Ocio".');
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ocio");
    expect(onCloseMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("el input referencia el error por aria-describedby", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: 'Ya existe una etiqueta con el nombre "Ocio".',
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const alert = await screen.findByRole("alert");
    expect(screen.getByLabelText("Nombre")).toHaveAttribute(
      "aria-describedby",
      alert.getAttribute("id") ?? "",
    );
  });

  it("éxito tuesta «Etiqueta renombrada» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Etiqueta renombrada" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta renombrada");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("isPending muestra «Guardando…» y deshabilita Guardar (doble envío)", async () => {
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

    resolveAction({ status: "success", message: "Etiqueta renombrada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta renombrada");
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

  it("Escape cierra sin enviar", async () => {
    renderDialog();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });
});
