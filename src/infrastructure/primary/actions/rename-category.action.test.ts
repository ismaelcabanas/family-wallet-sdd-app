import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/tag-category/RenameCategory", () => ({
  RenameCategory: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  renameCategory,
  type CategoryActionState,
} from "@/infrastructure/primary/actions/rename-category.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("categoryId", "2");
  formData.set("name", "Comida");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<CategoryActionState> {
  return renameCategory({ status: "idle" }, formData);
}

describe("renameCategory (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida solo /tags", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Categoría renombrada" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ categoryId: 2, name: "Comida" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/tags");
  });

  it("Zod rechaza el nombre vacío tras trim sin delegar", async () => {
    const state = await run(buildFormData({ name: "   " }));

    expect(state).toEqual({
      status: "error",
      message: "El nombre de la categoría es obligatorio.",
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("Zod rechaza un categoryId no numérico sin delegar", async () => {
    const state = await run(buildFormData({ categoryId: "abc" }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
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

  it("mapea DuplicateCategoryNameError a su mensaje exacto", async () => {
    const { DuplicateCategoryNameError } = await import(
      "@/domain/tag-category/TagCategoryErrors"
    );
    executeMock.mockRejectedValueOnce(new DuplicateCategoryNameError("Comida"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: 'Ya existe una categoría con el nombre "Comida".',
    });
  });

  it("mapea cualquier otro DomainError al mensaje genérico", async () => {
    const { DomainError } = await import("@/domain/shared/DomainError");
    executeMock.mockRejectedValueOnce(new (class extends DomainError {})("falla inesperada"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
