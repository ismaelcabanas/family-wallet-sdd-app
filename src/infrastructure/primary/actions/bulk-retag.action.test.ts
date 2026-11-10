import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/movement/BulkRetagMovements", () => ({
  BulkRetagMovements: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  bulkRetag,
  type BulkRetagActionState,
} from "@/infrastructure/primary/actions/bulk-retag.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: { month?: string; movementIds?: string[] } = {}): FormData {
  const formData = new FormData();
  formData.set("accountId", "2");
  formData.set("month", overrides.month ?? "2026-02");
  formData.set("targetTagId", "5");
  for (const id of overrides.movementIds ?? ["1", "2", "3"]) {
    formData.append("movementIds", id);
  }
  return formData;
}

async function run(formData: FormData): Promise<BulkRetagActionState> {
  return bulkRetag({ status: "idle" }, formData);
}

describe("bulkRetag (Server Action)", () => {
  it("éxito sin descartes devuelve «3 movimientos actualizados» y revalida el layout", async () => {
    executeMock.mockResolvedValueOnce({ updatedCount: 3, skippedCount: 0 });

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "3 movimientos actualizados" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 2,
      month: "2026-02",
      movementIds: [1, 2, 3],
      targetTagId: 5,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("éxito singular compone «1 movimiento actualizado»", async () => {
    executeMock.mockResolvedValueOnce({ updatedCount: 1, skippedCount: 0 });

    const state = await run(buildFormData({ movementIds: ["7"] }));

    expect(state).toEqual({ status: "success", message: "1 movimiento actualizado" });
  });

  it("éxito con descartes compone «2 de 3 movimientos actualizados»", async () => {
    executeMock.mockResolvedValueOnce({ updatedCount: 2, skippedCount: 1 });

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "2 de 3 movimientos actualizados" });
  });

  it("Zod rechaza un mes malformado sin delegar en el caso de uso", async () => {
    const state = await run(buildFormData({ month: "2026-2" }));

    expect(state).toEqual({ status: "error", message: "El mes no es válido." });
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("Zod rechaza la selección vacía sin delegar", async () => {
    const state = await run(buildFormData({ movementIds: [] }));

    expect(state).toEqual({
      status: "error",
      message: "Selecciona al menos un movimiento.",
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("Zod rechaza ids no numéricos sin delegar", async () => {
    const state = await run(buildFormData({ movementIds: ["1", "abc"] }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("mapea ProtectedTagError a su mensaje exacto", async () => {
    const { ProtectedTagError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new ProtectedTagError("Aportación Común"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: 'La etiqueta "Aportación Común" pertenece al sistema y no puede modificarse.',
    });
  });

  it("mapea TagNotFoundError a su mensaje exacto", async () => {
    const { TagNotFoundError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new TagNotFoundError());

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "Una de las etiquetas seleccionadas ya no está disponible.",
    });
  });

  it("mapea InvalidMovementError a su mensaje exacto", async () => {
    const { InvalidMovementError } = await import("@/domain/movement/MovementErrors");
    executeMock.mockRejectedValueOnce(
      new InvalidMovementError("movementIds", "Selecciona al menos un movimiento."),
    );

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "Selecciona al menos un movimiento.",
    });
  });

  it("nunca lanza al cliente ante un error no mapeado", async () => {
    executeMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
