import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import type { ActiveTagGroupDTO } from "@/application/tag/dto";
import type { CreateMovementState } from "../actions/create-movement.action";

const tagGroups: ActiveTagGroupDTO[] = [
  {
    category: { id: 1, name: "General", isDefault: true },
    tags: [
      {
        id: 9,
        name: "Sin Clasificar",
        slug: "sin-clasificar",
        categoryId: 1,
        categoryName: "General",
      },
    ],
  },
  {
    category: { id: 2, name: "Hogar", isDefault: false },
    tags: [
      { id: 3, name: "Hipoteca", slug: "hipoteca", categoryId: 2, categoryName: "Hogar" },
      { id: 2, name: "Vivienda", slug: "vivienda", categoryId: 2, categoryName: "Hogar" },
    ],
  },
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
  contributionAvailable = false,
) {
  return render(
    <CreateMovementDialog
      accountId={account.accountId}
      accountName={account.accountName}
      accountType={account.accountType}
      tagGroups={tagGroups}
      contributionAvailable={contributionAvailable}
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

  it("las cabeceras de categoría son texto visible sin rol option (FR-005)", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Hogar")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "General" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Hogar" })).not.toBeInTheDocument();
  });

  it("cada etiqueta cuelga del grupo de su categoría y «Sin etiqueta» es ítem plano (FR-004)", async () => {
    const user = userEvent.setup();
    renderCreateDialog();

    await user.click(screen.getByRole("radio", { name: "Ingreso" }));
    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));

    const sinEtiqueta = screen.getByRole("option", { name: "Sin etiqueta" });
    expect(sinEtiqueta.closest('[data-slot="select-group"]')).toBeNull();

    const hipoteca = screen.getByRole("option", { name: "Hipoteca" });
    const hogarGroup = hipoteca.closest('[data-slot="select-group"]') as HTMLElement | null;
    expect(hogarGroup).not.toBeNull();
    expect(within(hogarGroup!).getByText("Hogar")).toBeInTheDocument();

    const sinClasificar = screen.getByRole("option", { name: "Sin Clasificar" });
    const generalGroup = sinClasificar.closest('[data-slot="select-group"]') as HTMLElement | null;
    expect(generalGroup).not.toBeNull();
    expect(within(generalGroup!).getByText("General")).toBeInTheDocument();
  });

  it("no pinta cabeceras de categorías sin etiquetas activas (esc. 8)", async () => {
    const user = userEvent.setup();
    render(
      <CreateMovementDialog
        accountId={1}
        accountName="Cuenta de Miembro A"
        accountType="personal"
        tagGroups={[tagGroups[1]]}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));

    expect(screen.getByText("Hogar")).toBeInTheDocument();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sin Clasificar" })).not.toBeInTheDocument();
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
      tag: { id: 15, name: "Mascotas", slug: "mascotas", categoryId: 1, categoryName: "General" },
    });
    render(
      <MovementFormFields
        state={{ status: "idle" }}
        formAction={actionMock}
        isPending={false}
        tagGroups={tagGroups}
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
      categoryId: 1,
      categoryName: "General",
    });
    expect(screen.queryByLabelText("Nombre de la etiqueta")).not.toBeInTheDocument();
    const combobox = screen.getByRole("combobox", { name: "Etiqueta" });
    expect(combobox).toHaveTextContent("Mascotas");
    expect(screen.getByLabelText("Nota")).toHaveValue("Tienda de mascotas");
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("85,00");
    expect(combobox).toHaveFocus();
  });

  it("la etiqueta inline creada aparece dentro del grupo de la genérica al desplegar (esc. 9)", async () => {
    const user = userEvent.setup();
    createTagMock.mockResolvedValueOnce({
      ok: true,
      tag: { id: 15, name: "Mascotas", slug: "mascotas", categoryId: 1, categoryName: "General" },
    });
    render(
      <MovementFormFields
        state={{ status: "idle" }}
        formAction={actionMock}
        isPending={false}
        tagGroups={tagGroups}
        accountId={1}
        accountType="personal"
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Nueva etiqueta" }));
    await user.type(screen.getByLabelText("Nombre de la etiqueta"), "Mascotas");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    const combobox = await screen.findByRole("combobox", { name: "Etiqueta" });
    await user.click(combobox);

    const mascotas = screen.getByRole("option", { name: "Mascotas" });
    const generalGroup = mascotas.closest('[data-slot="select-group"]') as HTMLElement | null;
    expect(generalGroup).not.toBeNull();
    expect(within(generalGroup!).getByText("General")).toBeInTheDocument();
    expect(within(generalGroup!).getByRole("option", { name: "Sin Clasificar" })).toBeInTheDocument();
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
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled();
    });
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
      tag: { id: 15, name: "Mascotas", slug: "mascotas", categoryId: 1, categoryName: "General" },
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

    resolveCreate({ ok: true, tag: { id: 15, name: "Mascotas", slug: "mascotas", categoryId: 1, categoryName: "General" } });
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
        tagGroups={tagGroups}
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
        tagGroups={tagGroups}
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

  it("edición con etiqueta inactiva: el input hidden conserva el tagId (comportamiento vigente)", async () => {
    const user = userEvent.setup();
    renderEditFields({
      initialValues: { ...initialValues, tagId: 99 },
    });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(actionMock).toHaveBeenCalledTimes(1);
    const formData = actionMock.mock.calls[0][0] as FormData;
    expect(formData.get("tagId")).toBe("99");
  });
});

describe("MovementFormFields (tipo «Aportación común», 032)", () => {
  const protectedTagGroups: ActiveTagGroupDTO[] = [
    {
      category: { id: 1, name: "General", isDefault: true },
      tags: [
        {
          id: 100,
          name: "Aportación Común",
          slug: "aportacion-comun",
          categoryId: 1,
          categoryName: "General",
        },
        {
          id: 9,
          name: "Sin Clasificar",
          slug: "sin-clasificar",
          categoryId: 1,
          categoryName: "General",
        },
      ],
    },
  ];

  it("el radio «Aportación común» solo se ofrece con config activa (contributionAvailable)", () => {
    renderCreateDialog(personalAccount, false);
    expect(screen.queryByRole("radio", { name: "Aportación común" })).not.toBeInTheDocument();

    cleanup();
    renderCreateDialog(personalAccount, true);
    expect(screen.getByRole("radio", { name: "Aportación común" })).toBeEnabled();
  });

  it("elegir el tipo oculta naturaleza y etiqueta, y envía type=contribution sin naturaleza ni etiqueta", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce({
      status: "success",
      message: "Aportación registrada",
      intent: "close",
    });
    renderCreateDialog(personalAccount, true);

    await user.click(screen.getByRole("radio", { name: "Aportación común" }));

    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Compartido" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Etiqueta" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Importe (€)"), "300,00");
    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    expect(actionMock).toHaveBeenCalledTimes(1);
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("type")).toBe("contribution");
    expect(formData.get("nature")).toBeNull();
    expect(formData.get("tagId")).toBeNull();
  });

  it("la etiqueta protegida «Aportación Común» no es seleccionable en el flujo de gasto genérico (FR-001)", async () => {
    const user = userEvent.setup();
    render(
      <MovementFormFields
        state={{ status: "idle" }}
        formAction={actionMock}
        isPending={false}
        tagGroups={protectedTagGroups}
        accountId={1}
        accountType="personal"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Etiqueta" }));

    expect(screen.queryByRole("option", { name: "Aportación Común" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sin Clasificar" })).toBeInTheDocument();
  });

  it("edición de una aportación: identidad bloqueada y type=contribution vía input oculto", async () => {
    const user = userEvent.setup();
    render(
      <MovementFormFields
        state={{ status: "idle" }}
        formAction={actionMock}
        isPending={false}
        submitLabel="Guardar cambios"
        tagGroups={protectedTagGroups}
        contributionOption="locked"
        initialValues={{
          date: "2026-09-14",
          note: "Aportación septiembre",
          amountCents: 30_000,
          type: "expense",
          nature: "personal",
          tagId: 100,
        }}
      />,
    );

    expect(screen.getByRole("radio", { name: "Aportación común" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Aportación común" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Gasto" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Ingreso" })).toBeDisabled();
    expect(screen.queryByRole("radio", { name: "Personal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Etiqueta" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const formData = actionMock.mock.calls[0][0] as FormData;
    expect(formData.get("type")).toBe("contribution");
    expect(formData.get("nature")).toBeNull();
    expect(formData.get("tagId")).toBeNull();
  });

  it("el error de duplicado se muestra con role=alert y conserva el importe tecleado", async () => {
    const user = userEvent.setup();
    actionMock.mockResolvedValueOnce(
      errorState({
        errors: { _form: ["Ya existe una aportación registrada para este mes."] },
        values: {
          date: "2026-09-14",
          note: "",
          amount: "300,00",
          accountId: "1",
          type: "contribution",
          nature: "",
          tagId: "",
        },
      }),
    );
    renderCreateDialog(personalAccount, true);

    await user.click(screen.getByRole("radio", { name: "Aportación común" }));
    await user.type(screen.getByLabelText("Importe (€)"), "300,00");
    await user.click(screen.getByRole("button", { name: "Guardar y seguir" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ya existe una aportación registrada para este mes.");
    expect(screen.getByLabelText("Importe (€)")).toHaveValue("300,00");
    expect(screen.getByRole("radio", { name: "Aportación común" })).toBeChecked();
  });
});
