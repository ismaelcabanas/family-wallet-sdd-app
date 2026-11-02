import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/tag-category/DeleteCategory", () => ({
  DeleteCategory: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  deleteCategory,
  type CategoryActionState,
} from "@/infrastructure/primary/actions/delete-category.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("categoryId", "2");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<CategoryActionState> {
  return deleteCategory({ status: "idle" }, formData);
}

describe("deleteCategory (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida solo /tags", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Categoría eliminada" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ categoryId: 2 });
    expect(revalidatePathMock).toHaveBeenCalledWith("/tags");
  });

  it("Zod rechaza un categoryId no numérico sin delegar", async () => {
    const state = await run(buildFormData({ categoryId: "abc" }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("mapea CategoryNotEmptyError a su mensaje exacto", async () => {
    const { CategoryNotEmptyError } = await import("@/domain/tag-category/TagCategoryErrors");
    executeMock.mockRejectedValueOnce(new CategoryNotEmptyError("Comida"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message:
        'La categoría "Comida" tiene etiquetas asignadas. Muévelas a otra categoría antes de eliminarla.',
    });
  });

  it("mapea ProtectedCategoryError a su mensaje exacto", async () => {
    const { ProtectedCategoryError } = await import("@/domain/tag-category/TagCategoryErrors");
    executeMock.mockRejectedValueOnce(new ProtectedCategoryError("General"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message:
        'La categoría "General" es la categoría por defecto y no puede eliminarse.',
    });
  });

  it("mapea CategoryNotFoundError a su mensaje exacto", async () => {
    const { CategoryNotFoundError } = await import("@/domain/tag-category/TagCategoryErrors");
    executeMock.mockRejectedValueOnce(new CategoryNotFoundError());

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "La categoría seleccionada ya no está disponible.",
    });
  });

  it("mapea cualquier otro DomainError al mensaje genérico y nunca lanza", async () => {
    const { DomainError } = await import("@/domain/shared/DomainError");
    executeMock.mockRejectedValueOnce(new (class extends DomainError {})("falla inesperada"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
