import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/tag/RenameTag", () => ({
  RenameTag: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  renameTag,
  type TagActionState,
} from "@/infrastructure/primary/actions/rename-tag.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("tagId", "1");
  formData.set("name", "Hogar");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<TagActionState> {
  return renameTag({ status: "idle" }, formData);
}

describe("renameTag (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida el layout", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Etiqueta renombrada" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ id: 1, name: "Hogar" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("Zod rechaza el nombre vacío tras trim sin delegar en el caso de uso", async () => {
    const state = await run(buildFormData({ name: "   " }));

    expect(state).toEqual({
      status: "error",
      message: "El nombre de la etiqueta es obligatorio.",
    });
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("Zod rechaza un tagId no numérico sin delegar", async () => {
    const state = await run(buildFormData({ tagId: "abc" }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it.each([
    ["InvalidTagError", "El nombre de la etiqueta es obligatorio.", "InvalidTagError"],
    ["DuplicateTagNameError", "Ya existe una etiqueta con el nombre \"Ocio\".", "Duplicate"],
  ])("mapea %s a su mensaje exacto", async (_label, message, kind) => {
    const { InvalidTagError, DuplicateTagNameError } = await import("@/domain/tag/TagErrors");
    const error =
      kind === "InvalidTagError"
        ? new InvalidTagError(message)
        : new DuplicateTagNameError("Ocio");
    executeMock.mockRejectedValueOnce(error);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "error", message });
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

  it("nunca lanza al cliente ante un error no de dominio", async () => {
    executeMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
