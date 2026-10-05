import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock, toastSuccessMock, createTagMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  createTagMock: vi.fn(),
}));

vi.mock("../actions/create-movement.action", () => ({
  createMovement: actionMock,
}));

vi.mock("../actions/create-tag.action", () => ({
  createTag: createTagMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock },
  };
});

import { CreateMovementDialog } from "./create-movement-dialog";
import { MovementFormFields } from "./movement-form";
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
      note: "Hipoteca",
      amount: "850,00",
      accountId: "1",
      type: "expense",
      nature: "personal",
      tagId: "2",
    },
    ...overrides,
  };
}

function renderCreateDialog(
  account: typeof personalAccount | typeof sharedAccount = personalAccount,
) {
  return render(
    <CreateMovementDialog
      accountId={account.accountId}
      accountName={account.accountName}
      accountType={account.accountType}
      tags={tags}
      onClose={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreateMovementDialog (flujo de alta)", () => {
  it("renderiza los 6 controles: fecha hoy, importe, Nota, Gasto, naturaleza personal editable y Etiqueta sin selección", () => {
    renderCreateDialog();

    const dateInput = screen.getByLabelText("Fecha");
    expect(dateInput).toHaveValue(todayIsoDate());
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("");
    expect(screen.getByLabelText("Nota")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Personal" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Compartido" })).toBeEnabled();
    const tagTrigger = screen.getByRole("combobox", { name: "Etiqueta" });
    expect(tagTrigger).toHaveTextContent("Selecciona etiqueta");
  });

  it("no muestra campo descripción, bloque de cuenta ni texto de Sin Clasificar", () => {
    renderCreateDialog();

    expect(screen.queryByLabelText("Descripción (opcional)")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin selección, el movimiento se guarda/)).not.toBeInTheDocument();
    expect(screen.queryByText(/se cambia con el selector superior/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Cuenta" })).not.toBeInTheDocument();
  });

  it("el Select de etiqueta ofrece una opción por tag activa y «Sin etiqueta» solo con Ingreso", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));
    expect(screen.getByRole("option", { name: "Vivienda" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hipoteca" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sin Clasificar" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sin etiqueta" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));
    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));
    expect(screen.getByRole("option", { name: "Sin etiqueta" })).toBeInTheDocument();
  });

  it("en la cuenta común la naturaleza es compartido y no editable", () => {
    renderCreateDialog(sharedAccount);

    const personal = screen.getByRole("radio", { name: /Personal/ });
    const shared = screen.getByRole("radio", { name: /Compartido \(fijo/ });

    expect(personal).toBeDisabled();
    expect(shared).toBeDisabled();
    expect(shared).toBeChecked();
  });

  it("oculta la naturaleza al seleccionar ingreso", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Compartido" })).not.toBeInTheDocument();
  });

  it("muestra el error de tag en gasto con el mensaje del contrato", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(
      errorState({
        errors: { tagId: ["Selecciona una etiqueta para el gasto."] },
      }),
    );
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    await waitFor(() => {
      expect(
        screen.getByText("Selecciona una etiqueta para el gasto."),
      ).toBeInTheDocument();
    });
  });

  it("muestra los errores por campo con los mensajes del contrato", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(
      errorState({
        errors: {
          amount: ["El importe es obligatorio."],
          note: ["La nota es obligatoria."],
        },
      }),
    );
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    await waitFor(() => {
      expect(screen.getByText("El importe es obligatorio.")).toBeInTheDocument();
    });
    expect(screen.getByText("La nota es obligatoria.")).toBeInTheDocument();
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it("conserva los valores introducidos tras un fallo (nota y tag)", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(errorState());
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Hipoteca")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("850,00");
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-03");
    expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent("Vivienda");
  });

  it("en éxito tuesta y cierra el diálogo", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Movimiento guardado",
      intent: "close",
    });
    renderCreateDialog();

    await user.type(screen.getByLabelText("Nota"), "Mercadona");
    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Movimiento guardado");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("muestra el error de formulario inesperado bajo el formulario", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(
      errorState({
        errors: { _form: ["No se ha podido guardar el movimiento. Inténtalo de nuevo."] },
      }),
    );
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    await waitFor(() => {
      expect(
        screen.getByText("No se ha podido guardar el movimiento. Inténtalo de nuevo."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();
  });
});

describe("MovementFormFields (creación inline de etiquetas)", () => {
  it("abrir «+ Nueva etiqueta» y cancelar restaura el Select exacto como estaba", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));
    await user.click(screen.getByRole("option", { name: "Vivienda" }));

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    expect(screen.getByLabelText("Nombre de la etiqueta")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Etiqueta" })).not.toBeInTheDocument();

    const cancelTagCreation = screen
      .getAllByRole("button", { name: "Cancelar" })
      .find((button) => button.closest("div.flex.items-center.gap-2") !== null);
    expect(cancelTagCreation).toBeDefined();
    await user.click(cancelTagCreation!);

    expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent("Vivienda");
    expect(screen.queryByLabelText("Nombre de la etiqueta")).not.toBeInTheDocument();
  });

  it("Escape en el input de nombre cancela la captación y restaura el Select", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "Masc");
    await user.keyboard("{Escape}");

    expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent(
      "Selecciona etiqueta",
    );
    expect(screen.queryByLabelText("Nombre de la etiqueta")).not.toBeInTheDocument();
  });

  it("crear con éxito tuesta «Etiqueta creada», colapsa la captación, selecciona la nueva y avisa al padre", async () => {
    const user = userEvent.setup();
    const onTagCreated = vi.fn();
    createTagMock.mockResolvedValueOnce({
      ok: true,
      tag: { id: 15, name: "Mascotas", slug: "mascotas" },
    });
    render(
      <MovementFormFields
        state={{ status: "idle" }}
        formAction={actionMock}
        isPending={false}
        tags={tags}
        accountId={1}
        accountType="personal"
        onTagCreated={onTagCreated}
      />,
    );

    await user.type(screen.getByLabelText("Nota"), "Tienda de mascotas");
    await user.type(screen.getByLabelText("Importe (€)"), "85,00");
    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "Mascotas");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta creada");
    });
    expect(createTagMock).toHaveBeenCalledExactlyOnceWith("Mascotas");
    expect(onTagCreated).toHaveBeenCalledExactlyOnceWith({
      id: 15,
      name: "Mascotas",
      slug: "mascotas",
    });
    expect(screen.queryByLabelText("Nombre de la etiqueta")).not.toBeInTheDocument();
    const combobox = screen.getByRole("combobox", { name: "Etiqueta" });
    expect(combobox).toHaveTextContent("Mascotas");
    expect(screen.getByLabelText("Nota")).toHaveValue("Tienda de mascotas");
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("85,00");
    expect(combobox).toHaveFocus();
  });

  it("duplicado muestra role=alert con el mensaje del dominio y conserva el nombre tecleado", async () => {
    const user = userEvent.setup();
    createTagMock.mockResolvedValueOnce({
      ok: false,
      message: 'Ya existe una etiqueta con el nombre "luz".',
    });
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "luz");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Ya existe una etiqueta con el nombre "luz".');
    expect(screen.getByLabelText("Nombre de la etiqueta")).toHaveValue("luz");
    expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled();
  });

  it("nombre vacío muestra «El nombre de la etiqueta es obligatorio.»", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.click(screen.getByRole("button", { name: "Crear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El nombre de la etiqueta es obligatorio.");
    expect(createTagMock).not.toHaveBeenCalled();
  });

  it("Enter en el input de nombre crea la etiqueta y NO envía el formulario del movimiento", async () => {
    const user = userEvent.setup();
    createTagMock.mockResolvedValueOnce({
      ok: true,
      tag: { id: 15, name: "Mascotas", slug: "mascotas" },
    });
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "Mascotas{Enter}");

    await waitFor(() => {
      expect(createTagMock).toHaveBeenCalledExactlyOnceWith("Mascotas");
    });
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("muestra «Creando…» y deshabilita la botonera durante la creación", async () => {
    const user = userEvent.setup();
    let resolveCreate: (value: unknown) => void = () => {};
    createTagMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "Mascotas");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(screen.getByRole("button", { name: "Creando…" })).toBeDisabled();
    const cancelTagCreation = screen
      .getAllByRole("button", { name: "Cancelar" })
      .find((button) => button.closest("div.flex.items-center.gap-2") !== null);
    expect(cancelTagCreation).toBeDisabled();

    resolveCreate({ ok: true, tag: { id: 15, name: "Mascotas", slug: "mascotas" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Nueva etiqueta" })).toBeInTheDocument();
    });
  });

  it("la captación permanece abierta e íntegra al cambiar Gasto↔Ingreso", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "Masc");

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.getByLabelText("Nombre de la etiqueta")).toHaveValue("Masc");
    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Gasto" }));
    expect(screen.getByLabelText("Nombre de la etiqueta")).toHaveValue("Masc");
  });

  it("deshabilita «+ Nueva etiqueta» mientras el movimiento se está guardando", () => {
    render(
      <MovementFormFields
        state={{ status: "idle" }}
        formAction={actionMock}
        isPending={true}
        tags={tags}
        accountId={1}
        accountType="personal"
      />,
    );

    expect(screen.getByRole("button", { name: "+ Nueva etiqueta" })).toBeDisabled();
  });
});

describe("MovementFormFields (modo edición)", () => {
  const initialValues = {
    date: "2026-09-14",
    note: "Mercadona",
    amountCents: 7_850,
    type: "expense" as const,
    nature: "personal" as const,
    tagId: 2,
  };

  function renderEditFields(
    overrides: Partial<Parameters<typeof MovementFormFields>[0]> = {},
  ) {
    return render(
      <MovementFormFields
        state={{ status: "idle" }}
        formAction={actionMock}
        isPending={false}
        submitLabel="Guardar cambios"
        tags={tags}
        initialValues={initialValues}
        {...overrides}
      />,
    );
  }

  it("prellena nota y etiqueta única desde initialValues", () => {
    renderEditFields();

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-14");
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("78,50");
    expect(screen.getByLabelText("Nota")).toHaveValue("Mercadona");
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Personal" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Etiqueta" })).toHaveTextContent("Vivienda");
  });

  it("no muestra selector de cuenta en edición", () => {
    renderEditFields();

    expect(screen.queryByRole("combobox", { name: "Cuenta" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cuenta")).not.toBeInTheDocument();
  });

  it("al cambiar el tipo a ingreso el bloque de naturaleza no se muestra", async () => {
    const user = userEvent.setup();
    renderEditFields();

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Compartido" })).not.toBeInTheDocument();
  });

  it("envía el formulario con los campos precargados vía la action proporcionada", async () => {
    const user = userEvent.setup();
    renderEditFields();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(actionMock).toHaveBeenCalledTimes(1);
    const formData = actionMock.mock.calls[0][0] as FormData;
    expect(formData.get("date")).toBe("2026-09-14");
    expect(formData.get("note")).toBe("Mercadona");
    expect(formData.get("amount")).toBe("78,50");
    expect(formData.get("type")).toBe("expense");
    expect(formData.get("nature")).toBe("personal");
    expect(formData.get("tagId")).toBe("2");
  });

  it("muestra los errores en línea con los mensajes compartidos del alta (FR-002)", () => {
    renderEditFields({
      state: {
        status: "error",
        errors: { amount: ["El importe es obligatorio."] },
        values: {
          date: "2026-09-14",
          note: "Mercadona",
          amount: "",
          accountId: "",
          type: "expense",
          nature: "personal",
          tagId: "2",
        },
      },
    });

    expect(screen.getByText("El importe es obligatorio.")).toBeInTheDocument();
  });
});
