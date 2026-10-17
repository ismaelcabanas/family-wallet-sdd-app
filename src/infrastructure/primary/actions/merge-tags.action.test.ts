import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/tag/MergeTags", () => ({
  MergeTags: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  mergeTags,
  type TagActionState,
} from "@/infrastructure/primary/actions/merge-tags.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("absorbedId", "2");
  formData.set("targetId", "1");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<TagActionState> {
  return mergeTags({ status: "idle" }, formData);
}

describe("mergeTags (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida el layout", async () => {
    executeMock.mockResolvedValueOnce({ reassignedMovements: 3 });

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Etiquetas fusionadas" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ absorbedId: 2, targetId: 1 });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("Zod rechaza ids no numéricos sin delegar", async () => {
    const state = await run(buildFormData({ absorbedId: "abc" }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("mapea InvalidTagError («Elige dos etiquetas distintas.») a su mensaje exacto", async () => {
    const { InvalidTagError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new InvalidTagError("Elige dos etiquetas distintas."));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "Elige dos etiquetas distintas.",
    });
  });

  it("mapea ProtectedTagError (absorbida o resultante) a su mensaje exacto", async () => {
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

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("Una de las etiquetas seleccionadas ya no está disponible.");
    }
  });

  it("mapea cualquier otro DomainError al mensaje genérico", async () => {
    const { DomainError } = await import("@/domain/shared/DomainError");
    executeMock.mockRejectedValueOnce(new (class extends DomainError {})( "falla inesperada"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
