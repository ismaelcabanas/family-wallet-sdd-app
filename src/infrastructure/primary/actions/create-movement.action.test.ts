import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/movement/CreateMovement", () => ({
  CreateMovement: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
  DEFAULT_TAG_SLUG: "sin-clasificar",
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  createMovement,
  type CreateMovementState,
} from "@/infrastructure/primary/actions/create-movement.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string | string[]> = {}): FormData {
  const formData = new FormData();
  formData.set("date", "2026-09-03");
  formData.set("concept", "Mercadona");
  formData.set("description", "");
  formData.set("amount", "850,00");
  formData.set("accountId", "3");
  formData.set("type", "expense");
  formData.set("nature", "shared");
  formData.append("tagIds", "2");
  formData.append("tagIds", "3");
  for (const [key, value] of Object.entries(overrides)) {
    formData.delete(key);
    if (Array.isArray(value)) {
      for (const item of value) formData.append(key, item);
    } else if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

async function run(formData: FormData): Promise<CreateMovementState> {
  return createMovement({ status: "idle" }, formData);
}

describe("createMovement (Server Action)", () => {
  it("valida y devuelve éxito con movimiento válido", async () => {
    executeMock.mockResolvedValueOnce(1);

    const state = await run(buildFormData());

    expect(state.status).toBe("success");
    expect(state).toEqual({ status: "success", message: "Movimiento guardado" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 3,
      type: "expense",
      date: "2026-09-03",
      concept: "Mercadona",
      description: null,
      amountCents: 85_000,
      nature: "shared",
      tagIds: [2, 3],
    });
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/");
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

  it("rechaza el concepto vacío con el mensaje del contrato", async () => {
    const state = await run(buildFormData({ concept: "   " }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.concept).toEqual(["El concepto es obligatorio."]);
    }
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
    const state = await run(buildFormData({ type: "income" }));

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
    const state = await run(buildFormData({ concept: "" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.values).toEqual({
        date: "2026-09-03",
        concept: "",
        description: "",
        amount: "850,00",
        accountId: "3",
        type: "expense",
        nature: "shared",
        tagIds: ["2", "3"],
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

  it("mapea la tag inactiva al error de tagIds del contrato", async () => {
    const { InactiveTagError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new InactiveTagError());

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.tagIds).toEqual([
        "Una de las etiquetas seleccionadas ya no está disponible.",
      ]);
    }
  });
});
