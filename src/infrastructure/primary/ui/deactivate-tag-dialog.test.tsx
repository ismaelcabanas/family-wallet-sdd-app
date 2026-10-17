import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/deactivate-tag.action", () => ({
  deactivateTag: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import type { CatalogTagDTO } from "@/application/tag/dto";
import { DeactivateTagDialog } from "./deactivate-tag-dialog";

const tag: CatalogTagDTO = {
  id: 1,
  name: "supermercado",
  slug: "supermercado",
  status: "active",
  isProtected: false,
};

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(overrides: Partial<CatalogTagDTO> = {}) {
  return render(<DeactivateTagDialog tag={{ ...tag, ...overrides }} onClose={onCloseMock} />);
}

describe("DeactivateTagDialog", () => {
  it("muestra el título y el texto de consecuencia exacto", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog", { name: "Desactivar etiqueta" });
    expect(dialog).toHaveTextContent(
      '"supermercado" dejará de ofrecerse para nuevos movimientos. Los movimientos existentes la conservarán y seguirán computando en los desgloses.',
    );
  });

  it("Desactivar envía la action con el tagId y tuesta el éxito", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Etiqueta desactivada" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Desactivar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("tagId")).toBe("1");

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta desactivada");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("isPending deshabilita ambos botones", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Desactivar" }));

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desactivando…" })).toBeDisabled();

    resolveAction({ status: "success", message: "Etiqueta desactivada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta desactivada");
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
