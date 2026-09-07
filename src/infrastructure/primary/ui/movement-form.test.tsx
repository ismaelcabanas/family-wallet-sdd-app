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

import { MovementForm } from "./movement-form";
import { todayIsoDate } from "./format";
import type { CreateMovementState } from "../actions/create-movement.action";

const tags = [
  { id: 2, name: "Vivienda", slug: "vivienda" },
  { id: 3, name: "Hipoteca", slug: "hipoteca" },
  { id: 9, name: "Sin Clasificar", slug: "sin-clasificar" },
];

const personalAccount = {
  accountId: 1,
  accountName: "Cuenta de Miembro A",
  accountType: "personal" as const,
};

const sharedAccount = {
  accountId: 3,
  accountName: "Cuenta común",
  accountType: "shared" as const,
};

function errorState(overrides: Partial<Extract<CreateMovementState, { status: "error" }>> = {}) {
  return {
    status: "error" as const,
    errors: {},
    values: {
      date: "2026-09-03",
      concept: "Hipoteca",
      description: "",
      amount: "850,00",
      accountId: "1",
      type: "expense",
      nature: "personal",
      tagIds: ["2"],
    },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MovementForm", () => {
  it("renderiza los defaults: fecha hoy, tipo gasto y naturaleza personal editable", () => {
    render(<MovementForm {...personalAccount} tags={tags} />);

    const dateInput = screen.getByLabelText("Fecha");
    expect(dateInput).toHaveValue(todayIsoDate());
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Personal" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Compartido" })).toBeEnabled();
  });

  it("en la cuenta común la naturaleza es compartido y no editable", () => {
    render(<MovementForm {...sharedAccount} tags={tags} />);

    const personal = screen.getByRole("radio", { name: /Personal/ });
    const shared = screen.getByRole("radio", { name: /Compartido \(fijo/ });

    expect(personal).toBeDisabled();
    expect(shared).toBeDisabled();
    expect(shared).toBeChecked();
  });

  it("oculta la naturaleza al seleccionar ingreso", async () => {
    const user = userEvent.setup();
    render(<MovementForm {...personalAccount} tags={tags} />);

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Compartido" })).not.toBeInTheDocument();
  });

  it("muestra los errores por campo con los mensajes del contrato", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(
      errorState({
        errors: {
          amount: ["El importe es obligatorio."],
          concept: ["El concepto es obligatorio."],
        },
      }),
    );
    render(<MovementForm {...personalAccount} tags={tags} />);

    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(screen.getByText("El importe es obligatorio.")).toBeInTheDocument();
    });
    expect(screen.getByText("El concepto es obligatorio.")).toBeInTheDocument();
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it("conserva los valores introducidos tras un fallo", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(errorState());
    render(<MovementForm {...personalAccount} tags={tags} />);

    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Hipoteca")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("850,00");
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-03");
    expect(screen.getByLabelText("Vivienda")).toBeChecked();
  });

  it("en éxito muestra el toast y resetea el formulario a los defaults", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Movimiento guardado" });
    render(<MovementForm {...personalAccount} tags={tags} />);

    await user.type(screen.getByLabelText("Concepto"), "Mercadona");
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento guardado");
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Concepto")).toHaveValue("");
    });
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
  });

  it("permite seleccionar ingreso después de un registro exitoso (regresión E3)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({ status: "success", message: "Movimiento guardado" });
    render(<MovementForm {...personalAccount} tags={tags} />);

    await user.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento guardado");
    });

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.getByRole("radio", { name: "Ingreso" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Compartido" })).not.toBeInTheDocument();
  });

  it("muestra el error de formulario inesperado bajo el formulario", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(
      errorState({
        errors: { _form: ["No se ha podido guardar el movimiento. Inténtalo de nuevo."] },
      }),
    );
    render(<MovementForm {...personalAccount} tags={tags} />);

    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(
        screen.getByText("No se ha podido guardar el movimiento. Inténtalo de nuevo."),
      ).toBeInTheDocument();
    });
  });
});
