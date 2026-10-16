import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/configure-common-contribution.action", () => ({
  configureCommonContribution: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import type { CommonContributionDTO } from "@/application/common-contribution/dto";
import { useState } from "react";
import { CommonContributionConfigDialog } from "./common-contribution-config-dialog";

const activeConfig: CommonContributionDTO = {
  accountId: 1,
  percentageBasisPoints: 2500,
  active: true,
  activatedAtMonth: "2026-08",
};

const inactiveConfig: CommonContributionDTO = { ...activeConfig, active: false };

function DialogHost({
  config,
  onClose,
}: {
  config: CommonContributionDTO | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <CommonContributionConfigDialog
      accountId={1}
      memberName="Miembro B"
      config={config}
      onClose={() => {
        setOpen(false);
        onClose?.();
      }}
    />
  );
}

function renderDialog(config: CommonContributionDTO | null = activeConfig, onClose?: () => void) {
  return render(<DialogHost config={config} onClose={onClose} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CommonContributionConfigDialog", () => {
  it("sin config: abre vacío con placeholder 25, sin «Desactivar»", () => {
    renderDialog(null);

    const dialog = screen.getByRole("dialog", { name: "Aportación a la cuenta común" });
    const input = within(dialog).getByLabelText("Porcentaje (%)");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "25");
    expect(within(dialog).queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
  });

  it("con config: abre pre-rellenado (2500 bp → «25»; 1250 bp → «12,5»)", () => {
    renderDialog(activeConfig);
    expect(
      within(screen.getByRole("dialog", { name: "Aportación a la cuenta común" })).getByLabelText(
        "Porcentaje (%)",
      ),
    ).toHaveValue("25");

    cleanup();
    renderDialog({ ...activeConfig, percentageBasisPoints: 1250 });
    expect(
      within(screen.getByRole("dialog", { name: "Aportación a la cuenta común" })).getByLabelText(
        "Porcentaje (%)",
      ),
    ).toHaveValue("12,5");
  });

  it("con config activa muestra «Desactivar»; con inactiva no", () => {
    renderDialog(activeConfig);
    expect(
      within(screen.getByRole("dialog", { name: "Aportación a la cuenta común" })).getByRole(
        "button",
        { name: "Desactivar" },
      ),
    ).toBeInTheDocument();

    cleanup();
    renderDialog(inactiveConfig);
    expect(
      within(screen.getByRole("dialog", { name: "Aportación a la cuenta común" })).queryByRole(
        "button",
        { name: "Desactivar" },
      ),
    ).not.toBeInTheDocument();
  });

  it("abre con el foco en «Porcentaje (%)»", async () => {
    renderDialog(null);

    await waitFor(() => {
      expect(screen.getByLabelText("Porcentaje (%)")).toHaveFocus();
    });
  });

  it("guardar con éxito tuesta «Aportación guardada», cierra y envía intent save", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Aportación guardada" });
    renderDialog(null, onClose);

    const dialog = screen.getByRole("dialog", { name: "Aportación a la cuenta común" });
    await user.type(within(dialog).getByLabelText("Porcentaje (%)"), "25");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Aportación guardada");
    });
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    expect(formData.get("percentage")).toBe("25");
    expect(formData.get("intent")).toBe("save");
  });

  it("errores por campo con role=alert, valor conservado y diálogo abierto", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      errors: { percentage: ["El porcentaje es obligatorio."], _form: ["Configura primero el ingreso regular de este miembro."] },
      values: { percentage: "abc" },
    });
    renderDialog(null);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const dialog = screen.getByRole("dialog", { name: "Aportación a la cuenta común" });
    expect(
      within(dialog).getAllByRole("alert").map((node) => node.textContent),
    ).toEqual(["El porcentaje es obligatorio.", "Configura primero el ingreso regular de este miembro."]);
    expect(within(dialog).getByLabelText("Porcentaje (%)")).toHaveValue("abc");
  });

  it("durante el envío los controles se deshabilitan y «Guardar» muestra «Guardando…»", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog(activeConfig);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const dialog = screen.getByRole("dialog", { name: "Aportación a la cuenta común" });
    const pendingButtons = within(dialog).getAllByRole("button", { name: "Guardando…" });
    expect(pendingButtons).toHaveLength(2);
    for (const button of pendingButtons) {
      expect(button).toBeDisabled();
    }
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(within(dialog).getByLabelText("Porcentaje (%)")).toBeDisabled();

    resolveAction({ status: "success", message: "Aportación guardada" });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Aportación guardada");
    });
  });

  it("el «Desactivar» del diálogo tuesta «Aportación desactivada» y viaja con intent deactivate", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Aportación desactivada",
    });
    renderDialog(activeConfig);

    const dialog = screen.getByRole("dialog", { name: "Aportación a la cuenta común" });
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Aportación desactivada");
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    expect(formData.get("intent")).toBe("deactivate");
  });

  it("«Cancelar» cierra el diálogo sin llamar a la action", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(null, onClose);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(actionMock).not.toHaveBeenCalled();
  });
});
