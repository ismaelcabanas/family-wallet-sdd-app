import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/rename-account.action", () => ({
  renameAccount: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import { RenameAccountDialog } from "./rename-account-dialog";

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(accountId = 3, accountName = "Cuenta común") {
  return render(
    <RenameAccountDialog accountId={accountId} accountName={accountName} onClose={onCloseMock} />,
  );
}

describe("RenameAccountDialog", () => {
  it("muestra el título, el label «Nombre de la cuenta», el id oculto y el foco inicial", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Renombrar cuenta" });
    const input = within(dialog).getByLabelText("Nombre de la cuenta");
    expect(input).toHaveValue("Cuenta común");
    expect(input).toHaveFocus();
  });

  it("guardar envía la action con el FormData correcto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Cuenta renombrada" });
    renderDialog();

    const input = screen.getByLabelText("Nombre de la cuenta");
    await user.clear(input);
    await user.type(input, "Cuenta conjunta");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("3");
    expect(formData.get("name")).toBe("Cuenta conjunta");
  });

  it("en error muestra el mensaje con role=alert y conserva el nombre tecleado (SC-004)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: 'Ya existe una cuenta con el nombre "Cuenta conjunta".',
      values: { name: "Cuenta conjunta" },
    });
    renderDialog();

    const input = screen.getByLabelText("Nombre de la cuenta");
    await user.clear(input);
    await user.type(input, "Cuenta conjunta");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Ya existe una cuenta con el nombre "Cuenta conjunta".');
    expect(screen.getByLabelText("Nombre de la cuenta")).toHaveValue("Cuenta conjunta");
    expect(onCloseMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("el input referencia el error por aria-describedby", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: "El nombre de la cuenta es obligatorio.",
      values: { name: "" },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const alert = await screen.findByRole("alert");
    expect(screen.getByLabelText("Nombre de la cuenta")).toHaveAttribute(
      "aria-describedby",
      alert.getAttribute("id") ?? "",
    );
  });

  it("éxito tuesta «Cuenta renombrada» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Cuenta renombrada" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Cuenta renombrada");
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

    resolveAction({ status: "success", message: "Cuenta renombrada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Cuenta renombrada");
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
