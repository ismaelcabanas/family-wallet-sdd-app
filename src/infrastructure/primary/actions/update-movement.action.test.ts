import { describe, expect, it, vi, type Mock } from "vitest";

const { updateExecuteMock } = vi.hoisted(() => ({
  updateExecuteMock: vi.fn(),
}));

vi.mock("@/application/movement/UpdateMovement", () => ({
  UpdateMovement: vi.fn().mockImplementation(function () {
    return { execute: updateExecuteMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  updateMovement,
  type UpdateMovementState,
} from "@/infrastructure/primary/actions/update-movement.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("movementId", "7");
  formData.set("date", "2026-09-10");
  formData.set("note", "Mercadona");
  formData.set("amount", "78,50");
  formData.set("type", "expense");
  formData.set("nature", "personal");
  formData.set("tagId", "2");
  formData.set("currentAccountId", "1");
  formData.set("currentMonth", "2026-09");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

async function run(formData: FormData): Promise<UpdateMovementState> {
  return updateMovement({ status: "idle" }, formData);
}

describe("updateMovement (Server Action)", () => {
  it("valida, edita con expectedAccountId y devuelve éxito en la vista actual", async () => {
    updateExecuteMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Movimiento actualizado" });
    expect(updateExecuteMock).toHaveBeenCalledExactlyOnceWith({
      movementId: 7,
      expectedAccountId: 1,
      type: "expense",
      date: "2026-09-10",
      note: "Mercadona",
      amountCents: 7_850,
      nature: "personal",
      tagId: 2,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/accounts/[accountId]", "page");
  });

  it("compone el aviso de mes movido (misma cuenta)", async () => {
    updateExecuteMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData({ date: "2026-08-15" }));

    expect(state).toEqual({
      status: "success",
      message: "Movimiento actualizado: ahora está en Agosto 2026",
    });
  });

  it.each([
    ["movementId", "abc"],
    ["movementId", "0"],
    ["currentAccountId", "abc"],
    ["currentMonth", "sep-2026"],
    ["currentMonth", "2026-13"],
  ])("rechaza %s inválido (%s) como error de formulario", async (field, value) => {
    const state = await run(buildFormData({ [field]: value }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar el movimiento. Inténtalo de nuevo.",
      ]);
    }
    expect(updateExecuteMock).not.toHaveBeenCalled();
  });

  it("rechaza el importe inválido con los mismos mensajes que el alta (FR-002)", async () => {
    const state = await run(buildFormData({ amount: "abc" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.amount).toEqual(["Introduce un importe válido (ej. 850,00)."]);
    }
    expect(updateExecuteMock).not.toHaveBeenCalled();
  });

  it("conserva los valores introducidos tras un error de campo", async () => {
    const state = await run(buildFormData({ note: "" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.values.note).toBe("");
      expect(state.values.amount).toBe("78,50");
    }
  });

  it("mapea el desajuste de cuenta al error de accountId del contrato", async () => {
    const { InvalidMovementError } = await import("@/domain/movement/MovementErrors");
    updateExecuteMock.mockRejectedValueOnce(
      new InvalidMovementError("accountId", "El movimiento ya no pertenece a esta cuenta."),
    );

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.accountId).toEqual([
        "El movimiento ya no pertenece a esta cuenta.",
      ]);
    }
  });

  it("mapea MovementNotFoundError al mensaje exacto y revalida la pantalla", async () => {
    const { MovementNotFoundError } = await import("@/domain/movement/MovementErrors");
    updateExecuteMock.mockRejectedValueOnce(new MovementNotFoundError());

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["El movimiento ya no existe."]);
    }
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/accounts/[accountId]", "page");
  });

  it("mapea una excepción inesperada a error de formulario", async () => {
    updateExecuteMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar el movimiento. Inténtalo de nuevo.",
      ]);
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
