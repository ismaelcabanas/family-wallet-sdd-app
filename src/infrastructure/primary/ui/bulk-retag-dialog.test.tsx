import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/bulk-retag.action", () => ({
  bulkRetag: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import type { ActiveTagGroupDTO } from "@/application/tag/dto";
import { BulkRetagDialog } from "./bulk-retag-dialog";

const tagGroups: ActiveTagGroupDTO[] = [
  {
    category: { id: 1, name: "General", isDefault: true },
    tags: [
      { id: 4, name: "Hogar", slug: "hogar", categoryId: 1, categoryName: "General" },
      { id: 5, name: "Ocio", slug: "ocio", categoryId: 1, categoryName: "General" },
      {
        id: 100,
        name: "Aportación Común",
        slug: "aportacion-comun",
        categoryId: 1,
        categoryName: "General",
      },
    ],
  },
];

const onCloseMock = vi.fn();
const onSuccessMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(movementIds: number[] = [10, 11, 12]) {
  return render(
    <BulkRetagDialog
      accountId={2}
      month="2026-02"
      movementIds={movementIds}
      tagGroups={tagGroups}
      onClose={onCloseMock}
      onSuccess={onSuccessMock}
    />,
  );
}

async function chooseTarget(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox", { name: "Nueva etiqueta" }));
  await user.click(screen.getByRole("option", { name }));
}

describe("BulkRetagDialog", () => {
  it("muestra el título y el texto de consecuencia con el número de seleccionados", () => {
    renderDialog([10, 11, 12]);

    const dialog = screen.getByRole("dialog", { name: "Cambiar etiqueta" });
    expect(dialog).toHaveTextContent("Se cambiará la etiqueta de 3 movimientos.");
  });

  it("el Select agrupado excluye protegidas y no ofrece «Sin etiqueta»", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Nueva etiqueta" }));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Hogar", "Ocio"]);
    expect(screen.queryByRole("option", { name: /Aportación Común/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Sin etiqueta")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "General" })).toBeInTheDocument();
  });

  it("incluye los hidden inputs de accountId, month y un movementIds por seleccionado", () => {
    renderDialog([10, 11, 12]);

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    expect(form?.querySelector('input[name="accountId"]')).toHaveAttribute("value", "2");
    expect(form?.querySelector('input[name="month"]')).toHaveAttribute("value", "2026-02");
    const idInputs = form?.querySelectorAll('input[name="movementIds"]');
    expect(Array.from(idInputs ?? []).map((input) => input.getAttribute("value"))).toEqual([
      "10",
      "11",
      "12",
    ]);
  });

  it("«Reasignar» deshabilitado sin destino y habilitado al elegirlo", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole("button", { name: "Reasignar" })).toBeDisabled();

    await chooseTarget(user, "Hogar");
    expect(screen.getByRole("button", { name: "Reasignar" })).toBeEnabled();
  });

  it("en vuelo muestra «Reasignando…» y deshabilita los controles", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await chooseTarget(user, "Hogar");
    await user.click(screen.getByRole("button", { name: "Reasignar" }));

    expect(screen.getByRole("button", { name: "Reasignando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Nueva etiqueta" })).toBeDisabled();

    resolveAction({ status: "success", message: "3 movimientos actualizados" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("3 movimientos actualizados");
    });
    expect(onSuccessMock).toHaveBeenCalled();
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("el error de dominio es visible con role=alert y el Select conserva el valor", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
    renderDialog();

    await chooseTarget(user, "Hogar");
    await user.click(screen.getByRole("button", { name: "Reasignar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se ha podido completar la operación. Inténtalo de nuevo.");
    expect(screen.getByRole("combobox", { name: "Nueva etiqueta" })).toHaveTextContent("Hogar");
    expect(screen.getByRole("dialog", { name: "Cambiar etiqueta" })).toBeInTheDocument();
    expect(onSuccessMock).not.toHaveBeenCalled();
  });

  it("«Cancelar» cierra sin enviar ni avisar éxito", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
    expect(onSuccessMock).not.toHaveBeenCalled();
  });
});
