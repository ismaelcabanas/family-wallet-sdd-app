import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/rename-member.action", () => ({
  renameMember: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import { RenameMemberDialog } from "./rename-member-dialog";

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(memberId = 1, memberName = "Miembro A") {
  return render(
    <RenameMemberDialog memberId={memberId} memberName={memberName} onClose={onCloseMock} />,
  );
}

describe("RenameMemberDialog", () => {
  it("muestra el título, el label «Nombre del miembro», el id oculto y el foco inicial", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Renombrar miembro" });
    const input = within(dialog).getByLabelText("Nombre del miembro");
    expect(input).toHaveValue("Miembro A");
    expect(input).toHaveFocus();
  });

  it("guardar envía la action con el FormData correcto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Miembro renombrado" });
    renderDialog();

    const input = screen.getByLabelText("Nombre del miembro");
    await user.clear(input);
    await user.type(input, "Isma");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("memberId")).toBe("1");
    expect(formData.get("name")).toBe("Isma");
  });

  it("en error muestra el mensaje con role=alert y conserva el nombre tecleado (SC-004)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: 'Ya existe un miembro con el nombre "ISMA".',
      values: { name: "ISMA" },
    });
    renderDialog();

    const input = screen.getByLabelText("Nombre del miembro");
    await user.clear(input);
    await user.type(input, "ISMA");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Ya existe un miembro con el nombre "ISMA".');
    expect(screen.getByLabelText("Nombre del miembro")).toHaveValue("ISMA");
    expect(onCloseMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("el input referencia el error por aria-describedby", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      message: "El nombre del miembro es obligatorio.",
      values: { name: "" },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const alert = await screen.findByRole("alert");
    expect(screen.getByLabelText("Nombre del miembro")).toHaveAttribute(
      "aria-describedby",
      alert.getAttribute("id") ?? "",
    );
  });

  it("éxito tuesta «Miembro renombrado» y cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Miembro renombrado" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Miembro renombrado");
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

    resolveAction({ status: "success", message: "Miembro renombrado" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Miembro renombrado");
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
