import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/tag-category/CreateCategory", () => ({
  CreateCategory: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  createCategory,
  type CategoryActionState,
} from "@/infrastructure/primary/actions/create-category.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("name", "Alimentación");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<CategoryActionState> {
  return createCategory({ status: "idle" }, formData);
}

describe("createCategory (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida solo /tags", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Categoría creada" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ name: "Alimentación" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/tags");
  });

  it("Zod rechaza el nombre vacío tras trim sin delegar en el caso de uso", async () => {
    const state = await run(buildFormData({ name: "   " }));

    expect(state).toEqual({
      status: "error",
      message: "El nombre de la categoría es obligatorio.",
    });
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("mapea DuplicateCategoryNameError a su mensaje exacto", async () => {
    const { DuplicateCategoryNameError } = await import(
      "@/domain/tag-category/TagCategoryErrors"
    );
    executeMock.mockRejectedValueOnce(new DuplicateCategoryNameError("Alimentación"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: 'Ya existe una categoría con el nombre "Alimentación".',
    });
  });

  it("mapea InvalidCategoryError a su mensaje exacto", async () => {
    const { InvalidCategoryError } = await import("@/domain/tag-category/TagCategoryErrors");
    executeMock.mockRejectedValueOnce(new InvalidCategoryError());

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "El nombre de la categoría es obligatorio.",
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

  it("nunca lanza al cliente ante un error no de dominio", async () => {
    executeMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
