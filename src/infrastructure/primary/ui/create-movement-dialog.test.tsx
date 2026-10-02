import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("../actions/create-movement.action", () => ({
  createMovement: actionMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import { CreateMovementDialog } from "./create-movement-dialog";
import { todayIsoDate } from "./format";

const tags = [
  { id: 2, name: "Vivienda", slug: "vivienda" },
  { id: 3, name: "Hipoteca", slug: "hipoteca" },
];

const onCloseMock = vi.fn();

function renderDialog(
  overrides: Partial<Parameters<typeof CreateMovementDialog>[0]> = {},
) {
  return render(
    <CreateMovementDialog
      accountId={1}
      accountName="Cuenta de Miembro A"
      accountType="personal"
      tags={tags}
      onClose={onCloseMock}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreateMovementDialog", () => {
  it("abre con los defaults de alta: fecha hoy, Gasto, naturaleza personal y sin contador", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha")).toHaveValue(todayIsoDate());
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Personal" })).toBeChecked();
    expect(screen.queryByText(/Guardados:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Cuenta" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar y seguir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar y cerrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("submit con «Guardar y cerrar» llama a la action con intent=close, cierra y tuesta", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Movimiento guardado",
      intent: "close",
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar y cerrar" }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("accountId")).toBe("1");
    expect(formData.get("intent")).toBe("close");
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento guardado");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("error de campo mantiene el diálogo abierto con alerts y valores conservados", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "error",
      errors: {
        amount: ["El importe es obligatorio."],
        note: ["La nota es obligatoria."],
      },
      values: {
        date: "2026-09-03",
        note: "Hipoteca",
        amount: "850,00",
        accountId: "1",
        type: "expense",
        nature: "personal",
        tagId: "2",
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    await waitFor(() => {
      expect(screen.getByText("El importe es obligatorio.")).toBeInTheDocument();
    });
    expect(screen.getByText("La nota es obligatoria.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hipoteca")).toBeInTheDocument();
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("850,00");
    expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent("Vivienda");
  });

  it("Cancelar cierra el diálogo sin llamar a la action", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("con Ingreso la Naturaleza queda oculta", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Compartido" })).not.toBeInTheDocument();
  });
});

describe("CreateMovementDialog (captación continua)", () => {
  it("«Guardar y seguir» deja el diálogo abierto, incrementa el contador y prepara la siguiente captura", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValue({
      status: "success",
      message: "Movimiento guardado",
      intent: "continue",
    });
    renderDialog();

    await user.type(screen.getByLabelText("Nota"), "Mercadona");
    await user.type(screen.getByLabelText("Importe (€)"), "85,00");
    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));
    await user.click(screen.getByRole("option", { name: "Vivienda" }));
    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("intent")).toBe("continue");

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento guardado");
    });
    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();
    expect(screen.getByText("Guardados: 1")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("Nota")).toHaveValue("");
      expect(screen.getByLabelText("Importe (€)")).toHaveValue("");
    });
    expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent(
      "Selecciona etiqueta",
    );
    expect(screen.getByLabelText("Fecha")).toHaveValue(todayIsoDate());
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Personal" })).toBeChecked();
    expect(screen.getByLabelText("Nota")).toHaveFocus();
  });

  it("la fecha, tipo y naturaleza del último envío se pegan en la siguiente captura", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValue({
      status: "success",
      message: "Movimiento guardado",
      intent: "continue",
    });
    renderDialog();

    await user.clear(screen.getByLabelText("Fecha"));
    await user.type(screen.getByLabelText("Fecha"), "2026-10-01");
    await user.click(screen.getByRole("radio", { name: "Compartido" }));
    await user.type(screen.getByLabelText("Nota"), "Uno");
    await user.type(screen.getByLabelText("Importe (€)"), "10,00");
    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));
    await user.click(screen.getByRole("option", { name: "Hipoteca" }));
    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    await waitFor(() => {
      expect(screen.getByText("Guardados: 1")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-10-01");
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Compartido" })).toBeChecked();
  });

  it("dos guardados consecutivos con «Guardar y seguir» cuentan 2 y el tercero con «Guardar y cerrar» cierra", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValue({
      status: "success",
      message: "Movimiento guardado",
      intent: "continue",
    });
    renderDialog();

    const fillAndSave = async (note: string) => {
      await user.type(screen.getByLabelText("Nota"), note);
      await user.type(screen.getByLabelText("Importe (€)"), "10,00");
      await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));
      await user.click(screen.getByRole("option", { name: "Vivienda" }));
      await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));
      await waitFor(() => {
        expect(screen.getByText(`Guardados: ${note === "Uno" ? 1 : 2}`)).toBeInTheDocument();
      });
    };

    await fillAndSave("Uno");
    await new Promise((r) => setTimeout(r, 50));
    await fillAndSave("Dos");

    actionMock.mockResolvedValue({
      status: "success",
      message: "Movimiento guardado",
      intent: "close",
    });
    await user.type(screen.getByLabelText("Nota"), "Tres");
    await user.type(screen.getByLabelText("Importe (€)"), "30,00");
    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));
    await user.click(screen.getByRole("option", { name: "Hipoteca" }));
    await user.click(screen.getByRole("button", { name: "Guardar y cerrar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCloseMock).toHaveBeenCalled();
    expect(actionMock).toHaveBeenCalledTimes(3);
  });

  it("ambos botones de guardado quedan deshabilitados durante el envío", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    const pendingButtons = screen.getAllByRole("button", { name: "Guardando…" });
    expect(pendingButtons).toHaveLength(2);
    for (const button of pendingButtons) {
      expect(button).toBeDisabled();
    }

    resolveAction({ status: "success", message: "Movimiento guardado", intent: "continue" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Guardar y seguir" })).toBeEnabled();
    });
  });
});
