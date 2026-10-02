import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/movement/CreateMovement", () => ({
  CreateMovement: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  createMovement,
  type CreateMovementState,
} from "@/infrastructure/primary/actions/create-movement.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("date", "2026-09-03");
  formData.set("note", "Mercadona");
  formData.set("amount", "850,00");
  formData.set("accountId", "3");
  formData.set("type", "expense");
  formData.set("nature", "shared");
  formData.set("tagId", "2");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

async function run(formData: FormData): Promise<CreateMovementState> {
  return createMovement({ status: "idle" }, formData);
}

describe("createMovement (Server Action)", () => {
  it("valida y devuelve éxito con intent close por defecto", async () => {
    executeMock.mockResolvedValueOnce(1);

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "success",
      message: "Movimiento guardado",
      intent: "close",
    });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 3,
      type: "expense",
      date: "2026-09-03",
      note: "Mercadona",
      amountCents: 85_000,
      nature: "shared",
      tagId: 2,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/accounts/[accountId]", "page");
  });

  it("devuelve intent continue cuando el FormData lo pide", async () => {
    executeMock.mockResolvedValueOnce(1);

    const state = await run(buildFormData({ intent: "continue" }));

    expect(state).toEqual({
      status: "success",
      message: "Movimiento guardado",
      intent: "continue",
    });
  });

  it("normaliza un intent desconocido a close", async () => {
    executeMock.mockResolvedValueOnce(1);

    const state = await run(buildFormData({ intent: "nonsense" }));

    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.intent).toBe("close");
    }
  });

  it("tagId vacío viaja como null (ingreso sin etiqueta)", async () => {
    executeMock.mockResolvedValueOnce(1);

    const formData = buildFormData({ type: "income", tagId: "" });
    formData.delete("nature");

    const state = await run(formData);

    expect(state.status).toBe("success");
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 3,
      type: "income",
      date: "2026-09-03",
      note: "Mercadona",
      amountCents: 85_000,
      nature: null,
      tagId: null,
    });
  });

  it.each([
    ["", "El importe es obligatorio."],
    ["0", "El importe debe ser mayor que cero. Los abonos se registran como ingresos."],
    ["0,00", "El importe debe ser mayor que cero. Los abonos se registran como ingresos."],
    ["-5", "Introduce un importe válido (ej. 850,00)."],
    ["abc", "Introduce un importe válido (ej. 850,00)."],
    ["1.234,56", "Introduce un importe válido (ej. 850,00)."],
    ["850,005", "Introduce un importe válido (ej. 850,00)."],
  ])("rechaza el importe %j con su mensaje exacto", async (amount, message) => {
    const state = await run(buildFormData({ amount }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.amount).toEqual([message]);
    }
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("acepta importe con un decimal rellenado a dos (850,5 → 850,50)", async () => {
    executeMock.mockResolvedValueOnce(1);
    const state = await run(buildFormData({ amount: "850,5" }));
    expect(state.status).toBe("success");
    expect(executeMock.mock.calls[0][0].amountCents).toBe(85_050);
  });

  it("rechaza la nota vacía con el mensaje del contrato", async () => {
    const state = await run(buildFormData({ note: "   " }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.note).toEqual(["La nota es obligatoria."]);
    }
  });

  it("rechaza un gasto sin etiqueta con el error de tagId", async () => {
    const state = await run(buildFormData({ tagId: "" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.tagId).toEqual(["Selecciona una etiqueta para el gasto."]);
    }
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("rechaza la naturaleza ausente en un gasto", async () => {
    const formData = buildFormData();
    formData.delete("nature");

    const state = await run(formData);

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.nature).toEqual([
        "Selecciona la naturaleza del gasto (personal o compartido).",
      ]);
    }
  });

  it("rechaza la naturaleza presente en un ingreso", async () => {
    const state = await run(buildFormData({ type: "income", tagId: "" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.nature).toEqual(["Los ingresos no llevan naturaleza."]);
    }
  });

  it("rechaza fechas que no son de calendario real", async () => {
    const state = await run(buildFormData({ date: "2026-02-30" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.date).toEqual(["Indica una fecha válida."]);
    }
  });

  it("conserva los valores introducidos tras un fallo", async () => {
    const state = await run(buildFormData({ note: "" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.values).toEqual({
        date: "2026-09-03",
        note: "",
        amount: "850,00",
        accountId: "3",
        type: "expense",
        nature: "shared",
        tagId: "2",
      });
    }
  });

  it("nada se persiste cuando la validación falla", async () => {
    executeMock.mockClear();
    await run(buildFormData({ amount: "abc" }));
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("mapea una excepción inesperada a error de formulario", async () => {
    executeMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar el movimiento. Inténtalo de nuevo.",
      ]);
    }
  });

  it("mapea la tag inactiva al error de tagId del contrato", async () => {
    const { InactiveTagError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new InactiveTagError());

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.tagId).toEqual([
        "Una de las etiquetas seleccionadas ya no está disponible.",
      ]);
    }
  });

  it("mapea el error de dominio de gasto sin tag al campo tagId", async () => {
    const { InvalidMovementError } = await import("@/domain/movement/MovementErrors");
    executeMock.mockRejectedValueOnce(
      new InvalidMovementError("tagId", "Selecciona una etiqueta para el gasto."),
    );

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.tagId).toEqual(["Selecciona una etiqueta para el gasto."]);
    }
  });
});
