import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/merge-tags.action", () => ({
  mergeTags: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import type { CatalogTagDTO } from "@/application/tag/dto";
import { MergeTagsDialog } from "./merge-tags-dialog";

const absorbed: CatalogTagDTO = {
  id: 2,
  name: "super-casa",
  slug: "super-casa",
  status: "active",
  isProtected: false,
};

const catalog: CatalogTagDTO[] = [
  { id: 1, name: "supermercado", slug: "supermercado", status: "active", isProtected: false },
  { id: 2, name: "super-casa", slug: "super-casa", status: "active", isProtected: false },
  { id: 3, name: "Apagada", slug: "apagada", status: "inactive", isProtected: false },
  { id: 100, name: "Aportación Común", slug: "aportacion-comun", status: "active", isProtected: true },
];

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog() {
  return render(
    <MergeTagsDialog tag={absorbed} tags={catalog} onClose={onCloseMock} />,
  );
}

async function chooseTarget(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox", { name: "Etiqueta resultante" }));
  await user.click(screen.getByRole("option", { name }));
}

describe("MergeTagsDialog", () => {
  it("muestra el título y el texto de consecuencia con el nombre de la absorbida", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Fusionar etiqueta" });
    expect(dialog).toHaveTextContent(
      'Los movimientos con la etiqueta "super-casa" pasarán a la etiqueta que elijas. "super-casa" desaparecerá del catálogo.',
    );
  });

  it("el Select ofrece todas menos la propia absorbida y las protegidas; inactivas con sufijo", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Etiqueta resultante" }));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "supermercado",
      "Apagada (inactiva)",
    ]);
    expect(screen.queryByRole("option", { name: "super-casa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Aportación Común/ })).not.toBeInTheDocument();
  });

  it("«Fusionar» deshabilitado sin destino y habilitado al elegirlo", async () => {
    const user = userEvent.setup();
    renderDialog();

    const mergeButton = screen.getByRole("button", { name: "Fusionar" });
    expect(mergeButton).toBeDisabled();

    await chooseTarget(user, "supermercado");
    expect(screen.getByRole("button", { name: "Fusionar" })).toBeEnabled();
  });

  it("submit envía la action con absorbedId y targetId y tuesta el éxito", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Etiquetas fusionadas" });
    renderDialog();

    await chooseTarget(user, "supermercado");
    await user.click(screen.getByRole("button", { name: "Fusionar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("absorbedId")).toBe("2");
    expect(formData.get("targetId")).toBe("1");

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiquetas fusionadas");
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("en vuelo muestra «Fusionando…» y deshabilita los controles", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await chooseTarget(user, "supermercado");
    await user.click(screen.getByRole("button", { name: "Fusionar" }));

    const pendingButton = screen.getByRole("button", { name: "Fusionando…" });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Etiqueta resultante" })).toBeDisabled();

    resolveAction({ status: "success", message: "Etiquetas fusionadas" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiquetas fusionadas");
    });
  });

  it("el error de dominio es visible con role=alert y el diálogo permanece abierto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: "Elige dos etiquetas distintas.",
    });
    renderDialog();

    await chooseTarget(user, "supermercado");
    await user.click(screen.getByRole("button", { name: "Fusionar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Elige dos etiquetas distintas.");
    expect(screen.getByRole("dialog", { name: "Fusionar etiqueta" })).toBeInTheDocument();
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
